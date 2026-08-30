# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-25


## Sessão 2026-08-25 (parte 2) — Capacidade: pool, webhook, worker e `/api/health`

### De onde veio
Teste de carga real no container local, não teoria. Números que orientam TODA decisão daqui:
- Site e portal são **UM processo Node, UM event loop**. Renderizar página satura ~1 core: **120% de
  CPU com 30 requisições SSR concorrentes**, e a home — que serve com ZERO queries, 100% cacheada —
  foi de **15–27 ms para p50 122 ms / p90 432 ms**, com **NENHUM erro HTTP**. Este é o modo de falha
  do sistema: LENTIDÃO SEM ERRO.
- **Postgres nunca foi o gargalo**: no máximo 10 conexões, todas `active=0`, contra
  `max_connections=100`, até 500 requisições concorrentes. O gargalo é CPU.
- **`/_next/image` é o endpoint mais caro**: 440% de CPU com 96 otimizações simultâneas (sharp em
  threads nativas). Resolve-se com CDN — CONFIGURAÇÃO do stakeholder, fora do escopo do pacote.

### O que entrou (4 mudanças)
1. **Pool** (`src/db/index.ts`): `statement_timeout: 15_000` + `max: 10` explícito (documenta a
   intenção; 10 já era o default). ⚠️ O `statement_timeout` conta **espera por lock**, então o
   `INSERT` do lead em `/api/contact` ganhou **um** retry no SQLSTATE `57014` — sem ele, um
   `CREATE INDEX` de migration rodando no boot mataria leads enquanto o container antigo serve.
2. **Webhook do ERP**: teto de 10 MB checado ANTES do `json()` (header + leitura contada em bytes,
   que vale também quando o header mente ou não vem). Sem `.max(N)` em `products` de propósito.
3. **`WORKERS_ENABLED`**: desliga o worker BullMQ sem tirar o `REDIS_URL` (que também é o backend do
   rate limit fail-closed de `/api/contact` — tirar o Redis desligaria a captação de leads junto).
4. **`GET /api/health`**: sem token, `{status:"ok"}` + 200 (liveness); com `x-health-token`, métricas.

### Correções da revisão (4 achados procedentes, 1 improcedente)
- **Histograma cego** (o mais grave): era acumulado desde o boot, então com 24 h de uptime — o estado
  normal — o p90/p99 diluía para o piso DURANTE a saturação, e o `maxMs` monotônico ficava alto para
  sempre. Agora `window` (janela de 60 s, zerada por timer `unref`-ado) + `cumulative`. Verificado no
  dev: sob 14 SSR concorrentes `window` foi a p99 70,8 / max 160,9 ms; 70 s depois, ocioso, `window`
  voltou ao piso (12,6 ms) enquanto `cumulative.maxMs` seguia 160,9 — a cegueira, reproduzida.
- **`?db=1` acusava o banco errado**: como o pool (corretamente) não tem `connectionTimeoutMillis`,
  `connect()` fica pendente para sempre quando não há slot — a rota reportava 503 "banco fora" com o
  banco impecável e deixava uma query órfã somando `waitingCount` a cada chamada (o health check
  inflando a própria métrica). Agora: pré-checagem de saturação, timeout próprio de aquisição com
  devolução do client atrasado, e `release` no `finally` da query. **Saturação nunca vira 503.**
- **Worker sumia em silêncio**: com a flag desligada e sem consumidor em lugar nenhum, o webhook
  segue respondendo `202 { queued: true }` ao ERP e a fila nunca é consumida. `/api/health` agora
  publica `workers: { running, reason }`; o `.env.example` foi corrigido (competing consumers são
  seguros no BullMQ; a razão da flag é isolar CPU, e env é por SERVIÇO, não por réplica).
- **Token de métricas**: comparava o valor CRU contra um guard que trimava — `\n` colado de painel
  fazia a rota mentir em silêncio. Agora compara trimado, com WARN no servidor (1/min) separando
  "env ausente" de "token inválido". A resposta ao chamador segue idêntica (nunca 401).
- **Improcedente**: fazer o caminho PÚBLICO reprovar. O diagnóstico é certo (ele não detecta
  migration quebrada, porque o `CMD` usa `||` de propósito), mas a correção mexeria no Dockerfile e a
  própria recomendação admite documentar. Ficou documentado em 3 lugares + backlog.

### Portões e fumaça
- lint ✓ · **934 testes ✓** (+20 nesta rodada: `pg-error` 15, `summarizeHistogram` 5) · build ✓.
- ⚠️ O container `site-roco` estava PARADO (a porta 3000 do host está com o API de OUTRO projeto,
  `ocrim-roteirizacao`). Subi só `site-roco-postgres` (5433) e `site-roco-redis` (6380) e validei em
  `npm run dev -p 3100`: `/pt` e `/pt/produtos` 200; `/api/health` sem token e com token ERRADO
  devolvem exatamente `{"status":"ok"}`; com token, métricas completas; `?db=1` ok em 1–3 ms com
  `waiting: 0` em 5 polls seguidos; `POST /api/contact` 201 com a linha gravada (retry do INSERT
  refatorado sem regressão — a linha de teste foi apagada depois). Dev server derrubado ao fim.

### ⛔ Duas recomendações REFUTADAS (não "consertar" achando que foi esquecimento)
1. `connectionTimeoutMillis` no pool — é um `setTimeout` cru no mesmo event loop saturado: dispara
   por CPU travada, não por pool cheio. E em `/api/contact` converteria "lead salvo, resposta lenta"
   em **LEAD PERDIDO** (o `catch` do INSERT responde 500 e aborta; o app não tem `error.tsx`).
2. Subir o `max` do pool (20/50/100) — o banco ficou ocioso até 500 concorrentes. Mais conexões só
   colocam mais trabalho disputando o mesmo core. Capacidade vem de réplicas e CDN.

### Pendente do stakeholder
- **CDN na frente de `/_next/image`** (maior alavanca de capacidade).
- `HEALTH_METRICS_TOKEN` em produção (sem ela, nenhuma métrica é exposta a ninguém).
- Serviço worker dedicado antes de escalar para 2+ réplicas web.

## Sessão 2026-08-25 — Rastreio de origem do lead, formulário do catálogo e revisão adversarial

### O que a feature entregou
- **Origem do lead (`?origem=`)**: módulo puro novo `src/shared/lib/lead-origin.ts` com lista
  FECHADA de 10 seções (`home-hero`, `home-sobre`, `home-categorias`, `home-destaques`,
  `home-portal`, `produtos-listagem`, `produto-detalhe`, `catalogo`, `menu`, `rodape`).
  `resolveDestination(href, locale, origin)` anexa o parâmetro SOMENTE quando o destino resolvido
  é `/contato` ou `/catalogo` (nunca a home, listagem ou URL externa de env). Vai ao RD Station em
  `cf_origem` e ao e-mail interno com rótulo humano (`LEAD_ORIGIN_LABELS`, `Record` tipado — origem
  nova sem rótulo quebra o build).
- **UTM**: `utm_source`/`utm_medium`/`utm_campaign` saneados (trim, 120 chars, sem CR/LF/NUL) →
  campos PADRÃO `traffic_source`/`traffic_medium`/`traffic_campaign` (não exigem nada no painel do
  RD). Origem = seção INTERNA; UTM = campanha EXTERNA; complementares, nunca se sobrescrevem.
- **4 `conversion_identifier`**: `orcamento_produto` / `download_catalogo` / `ligamos_pra_voce` /
  `contato_geral` (antes `call_back` e `general` colapsavam num só).
- **Retry gracioso do RD**: `cf_*` inexistente no painel faz o RD devolver 400 e perder a conversão
  INTEIRA. No 400 de campo (ou não classificável) reenvia UMA vez sem os `cf_*` e marca
  `contact_submissions.rd_station_error = validation_retry_ok` — o lead entra e o time descobre que
  o painel precisa de ajuste.
- **Formulário volta ao `/catalogo`**: PDF atrás de nome/e-mail/telefone/empresa + consentimento
  LGPD + honeypot, reaproveitando `POST /api/contact` com `subject: "catalog"`. Tailwind puro
  (`.form-neon`), sem MUI no `(site)`.
- **Migration `0008_contact_origin_utm.sql`**: colunas `origin`/`utm_source`/`utm_medium`/
  `utm_campaign` + valor `catalog` no enum `contact_subject`. Aplicada limpa no Postgres local
  (journal com 9 linhas, 4 valores no enum, 4 colunas novas conferidas).

### Revisão adversarial — 4 achados confirmados, todos corrigidos
1. **Catálogo refém do Redis** — com `productionSafe: true` (fail-closed), Redis fora derrubava
   100% das submissões e, como o form virou o único caminho de UI, matava o CTA de catálogo em todo
   o site (antes era `<a download>` e não dependia de backend). O painel de erro passa a exibir o
   link do PDF: perde-se o lead, nunca o download.
2. **Balde global compartilhado derrubava lead legítimo** — `contact:global` (40/5min) era cobrado
   ANTES do parse e em `Promise.all` com o teto de IP, então lixo, honeypot e request já barrada por
   IP consumiam o orçamento dos DOIS funis. Reproduzido: 41 POSTs de corpo vazio de um IP → balde em
   41 → lead legítimo de outro IP recebia 429. Agora IP primeiro, global só depois de honeypot +
   `safeParse`, teto 40 → 200. Reverificado: mesmo flood deixa o balde VAZIO e o lead responde 201.
3. **400 virava "tente novamente em instantes"** — o array `fields` era descartado e nenhum campo
   era marcado. Corrigido nos dois formulários (erro por campo com `aria-invalid`/`aria-describedby`,
   banner novo só quando o campo não é renderizado ali). Junto: o regex de e-mail duplicado deu lugar
   a `contactSchema.shape.email` (aceitava `joao@empresa.c`/`user@exa_mple.com`, que o zod reprova),
   e `message` deixou de ser bloqueado por CR/LF — é um `<textarea>`, apertar Enter reprovava a
   submissão inteira. `name`/`companyName`/`productSlug` continuam fechados a CR/LF (vão ao header
   `Subject`); `message` só bloqueia NUL.
4. **UTM nunca chegava ao RD** — era lida só no `searchParams` das páginas de formulário e nada a
   propagava (links internos são limpos; o redirect de locale descartava a querystring). Agora o
   middleware grava `roco_utm` (JSON, httpOnly, SameSite=Lax, 30 dias) na URL de ENTRADA e as páginas
   leem querystring → cookie (`resolveLeadUtm`). O redirect de locale passou a preservar
   `request.nextUrl.search`.

### Achado EXTRA da verificação de fumaça (não veio da revisão) — o mais grave da sessão
**O middleware NUNCA rodou.** `proxy.ts` estava na RAIZ do repo, mas o Next procura o proxy no mesmo
nível de `app/` — que aqui mora em `src/app`. O arquivo era compilado e nunca registrado
(`middleware-manifest.json` com `"middleware": {}`). Sintomas vivos em produção: `/contato`,
`/produtos`, `/portal` sem prefixo de locale davam **404** em vez de redirecionar; `NEXT_LOCALE`
nunca era gravado; o guard de sessão de `/portal`/`/admin` nunca executava (o que protegia essas
rotas era só o `requireAuth()` das páginas — por isso passou despercebido). Movido para
`src/proxy.ts` com aviso no topo. Sem isso a correção (4) seria inerte. Depois da mudança o build
imprime `ƒ Proxy (Middleware)`.

### Portões e verificação
- `npm run lint` ✓ · `npm run test` ✓ **847 testes** (baseline pré-feature: 623) · `npm run build` ✓.
- Fumaça em `npm run dev` na porta 3100 (3000 ocupada pelo container): `/pt`, `/en`, `/pt/contato`,
  `/pt/contato?origem=menu`, `/pt/contato?origem=lixo-invalido`, `/pt/catalogo`, `/en/catalogo`,
  `/pt/produtos` → todos **200**. Origem inválida não quebra a página (cai em `undefined`/fallback).
- Middleware conferido: `/contato` → 307 `/pt/contato`; `/pt/portal` → 307 login; `/pt/portal/login`
  → 200; `/pt/admin` → 307 login; `/api/products` → 200 (matcher segue pulando `/api`).
- Propagação de UTM ponta a ponta: pouso em `/pt?utm_source=google&utm_medium=cpc&utm_campaign=…`
  grava o cookie; `/pt/catalogo` SEM UTM na URL renderiza a campanha; outro visitante vê a dele;
  visitante sem cookie não vê nenhuma (sem contaminação cruzada).
- API conferida contra o banco: mensagem multilinha → 201 (antes 400); e-mail inválido → 400
  `{"error":"validation","fields":["email"]}`; NUL em `message` → 400 `fields:["message"]`; honeypot
  → 201 sem gravar; `subject: "catalog"` → 201; linha gravada com `origin`/`utm_*` preenchidos.
  Redis parado → **503 `{"error":"unavailable"}`** (não mais 429 "muitas tentativas"); Redis de volta
  → 201. Linhas de teste removidas do Postgres local ao fim.

### Pendências do stakeholder (bloqueiam o valor da feature, não o deploy)
1. **RD Station**: gerar a API Key (`RD_STATION_API_KEY`) e criar TRÊS campos personalizados no
   painel — `cf_cnpj`, `cf_produto_interesse` e **`cf_origem`** (novo). Sem eles o retry gracioso
   entrega o lead, mas sem CNPJ/produto/origem, e grava `validation_retry_ok` na coluna
   `rd_station_error`. Conferir essa coluna depois do go-live.
2. **Resend**: domínio verificado + `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`,
   `CONTACT_NOTIFICATION_EMAIL`.
3. **REDIS_URL em produção é obrigatória**: com `productionSafe: true` nos dois limites de
   `/api/contact`, sem Redis a rota responde 503 e NENHUM lead entra (o download do catálogo
   continua acessível pelo link do painel de erro, mas a captura para). A documentação antiga que
   dizia "sem Redis o rate limit desliga (fail-open)" não vale mais para esta rota.

## Sessão 2026-08-24 (parte 2) — Upload de mídia, materiais dinâmicos e RBAC editável
- **Pedido do stakeholder (3 partes)**: (1) upload de arquivo real (não chave bruta do R2) na config de mídia da home; (2) admin compartilha materiais com representantes via timeline, sempre upload (nunca URL externa); (3) admin cria perfis de acesso e aplica permissões por módulo dinamicamente.
- **Entregue**:
  - **Parte 1 — Upload de mídia do hero**: bug real corrigido em `presignUpload`/`confirmUpload` (routers hero-slides aceitavam só video mesmo para pôster). Novo helper puro `upload-limits.ts` (86 testes) centraliza tipo/tamanho por campo (`heroVideo`, `heroPoster`, `material`). Componente genérico reutilizável `portal-file-uploader.tsx` (dropzone, progresso XHR, preview, validação client-side).
  - **Parte 2 — Materiais dinâmicos**: tabela `materials` (migration 0006), router tRPC, admin CRUD em `/{locale}/portal/materiais` (item nav `materials` gate `materials:create`). Feed somente-leitura em boas-vindas. Arquivos sempre privados (presigned GET). 4 cards estáticos "Em breve" (Contatos, Política, Logística, Vídeos) substituídos por feed dinâmico; card DW perdeu botão morto (mantém conteúdo informativo).
  - **Parte 3 — Perfis e permissões dinâmicos**: 5 guardas puras em `roles-guards.ts` (51 testes: canDeleteRole, canEditRolePermissions, wouldSelfLockout, wouldRemoveLastAdmin, canGrantRole). Router tRPC routers/roles (CRUD + matriz). Tela `/{locale}/portal/perfis` (3 abas: perfis, permissões, usuários). Permissão nova `roles:manage` (admin only). Slug de perfil imutável pós-criação; perfil `admin` travado/RO.
- **Testes**: 348 → 485 testes (+137: `roles-guards.test.ts` 51, `upload-limits.test.ts` 86). Lint ✓, build ✓ (rotas dinâmicas ƒ).
- **Segurança — 2 achados ALTOS corrigidos**: (1) `materials.list` aceitava `materials:read` (devia ser `materials:create`) — representante lia rascunhos não publicados; trocado para gate correto. (2) `r2Key` bruta vazava no JSON (combinado com bucket público r2.dev) — omitido do retorno (só `downloadUrl`). Componentes consumidores ajustados (form prescindir de `r2Key` na update via patch parcial).
- **Paridade i18n**: 408 chaves portal.* (idênticas pt/en) verificadas programaticamente. Bug real corrigido na sessão: `site` → `welcome` (namespace consentimento LGPD). Não é regressão da feature; acidente de edit anterior.
- **Pendências de infra**: bucket R2 separado sem acesso público para conteúdo privado (antes de produção).
- Ver decisionLog 2026-08-24 (3 últimas entradas) para racional arquitetural completo. Commits ainda não feitos (decisão do usuário).

## Sessão 2026-08-24 (parte 3) — Página `/contato` e fluxo de recebimento de orçamento
- **Situação anterior**: site não tinha forma real de receber pedidos. 3 dos 6 itens do menu apontavam para `/contato` (404); botão "Solicite um orçamento" nas páginas de produto descartava contexto e mandava para PDF do catálogo. **Déficit crítico**: CRM da ROCO (RD Station) estava desconectado do site.
- **Entregue (8 arquivos novos + 7 editados)**:
  - **Rota `/contato`** (`src/app/[locale]/(site)/contato/page.tsx`): Server Component que lê `?produto=`/`?assunto=` de query params, resolve produto no servidor via `getPublicProductBySlug` (nunca aceita nome de produto cru do cliente — previne injeção). Form com fields: nome/e-mail/telefone obrigatórios, empresa/CNPJ opcionais, assunto (dropdown: call_back/quote/general), mensagem opcional, chip de contexto do produto (somente-leitura, removível), checkbox de consentimento LGPD obrigatório, honeypot.
  - **Rota `POST /api/contact`** (Route Handler síncrono, sem fila): (1) rate limit IP+global (`productionSafe: true` — fail-closed), honeypot, validação zod; (2) INSERT em `contact_submissions` (migration 0007 — tracking de lead com status por canal); (3) dispara RD Station + Resend em paralelo via `Promise.allSettled` com timeout 8s (best-effort, nunca lança); (4) responde ao visitante `201 { ok: true }` assim que INSERT funciona, independente do resultado dos canais (failsafe: lead sempre gravado primeiro).
  - **Tabela `contact_submissions`** (migration 0007): name, email, phone, company_name, cnpj, subject, product_slug, product_name_at_submit, consent_granted + consent_at (auditoria LGPD), rd_station_status/error, email_status/error, ip_address, submitted_at. UUID client_tracking_id UNIQUE = nossa dedupe (RD API não é idempotente).
  - **RD Station (Conversions API)**: payload `{ event_type, event_family, payload: { conversion_identifier, name, email, personal_phone, company_name, cf_cnpj, cf_produto_interesse, client_tracking_id, legal_bases } }`. Campos customizados `cf_cnpj`/`cf_produto_interesse` **precisam ser criados à mão** pelo stakeholder no painel do RD UMA VEZ (pesquisa anterior descartou auto-criação — caminho seguro). Sucesso = 200 com `event_uuid`; erro = 400 array com `errors`.
  - **Resend (e-mail transacional)**: notificação para time comercial (destino `CONTACT_NOTIFICATION_EMAIL` com fallback em `NEXT_PUBLIC_CONTACT_EMAIL`). Remetente verificado (`CONTACT_FROM_EMAIL`) — stakeholder configura domínio (ex.: `mail.roco.com.br`) antes do go-live.
  - **Consolidação do menu (entrada 6 do decisionLog)**: nav de 6 para 4 itens (Home, Produtos, Portal ROCO, Contato). As 3 intenções anteriores (call_back/quote/general) viram opções de dropdown `subject` no form. Bug corrigido: link "Contato" agora prefixado com locale via `resolveDestination("#contato")` — item "ativo" funciona corretamente em `/{locale}/contato`.
  - **Segurança**: anti-header-injection em `contact-submit.ts` — CONTROL_CHARS regex bloqueia `\r\n\0` em name/companyName/message/productSlug. Rate limit 8/10min IP + 40/5min global, ambos `productionSafe: true` (fail-closed). Honeypot campo "website".
- **Testes**: 484 → 623 testes (+139: `contact-submit.test.ts`, `rd-station.test.ts`, `contact-email.test.ts` — cobertura 100% lógica pura). Lint ✓, build ✓ (tsc detectou 6 erros que vitest perdeu — sempre rodar `npm run build` como portão final).
- **Arquivos novos**: `contact.ts` (schema), `contact-submit.ts` (zod puro + sanitização), `rd-station.ts`/`rd-station-send.ts` (payload + I/O), `contact-email.ts`/`contact-email-send.ts` (HTML + Resend), `contact-form.tsx` (client), `types.ts` (ContactDictionary), `route.ts` (POST /api/contact).
- **Pendências para stakeholder provisionar**:
  - **RD Station**: gerar API Key estático no painel (Integrações > API Key) → `RD_STATION_API_KEY`; criar campos customizados `cf_cnpj`/`cf_produto_interesse` (400 se faltar).
  - **Resend**: domínio de envio verificado (ex.: `mail.roco.com.br`) → `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_NOTIFICATION_EMAIL`.
  - Sem as credenciais: lead gravado localmente, canais skipped/logados WARN — nenhum risco de perda, testável offline.
- **Follow-ups registrados em progress.md**: endurecer `/api/contact` contra enumeração (captcha/honeypot + teto rígido), política de retenção `contact_submissions` (LGPD), reavaliar `getClientIp` confia em X-Forwarded-For (débito pré-existente, agora com superfície maior).
- Ver decisionLog 2026-08-24 (4 últimas entradas: RD Station / Resend / consolidação menu / contact_submissions / fluxo síncrono) para racional completo.

## Sessão 2026-08-24 (parte 1) — Deploy destravado: migrations dentro do container

- **Sintoma inicial (produção EasyPanel)**: build quebrava com `Invalid URL: ''` em
  `metadata.ts`; depois `ECONNREFUSED`; depois `42P01 relation "products" does not exist`.
  Três problemas distintos em sequência, cada um mascarando o próximo.
- **Fix 1 — build** (`2a32295`): `siteUrl` usava `??`, que não pega string vazia. O
  Dockerfile declara `ARG NEXT_PUBLIC_SITE_URL=` (default vazio), então sem o build-arg o
  `new URL("")` derrubava o build. Trocado por `trim() || fallback`.
- **Fix 2 — migrations** (`dd14c23`): o container não conseguia migrar de jeito nenhum.
  `drizzle-kit` é devDependency, o Turbopack **inlina** o `drizzle-orm` (o pacote nem existe
  em `.next/standalone/node_modules`; idem `bcryptjs`) e os `.sql` não eram copiados.
  Solução: `scripts/migrate.mjs` (usa o migrator interno do `drizzle-orm`, journal 100%
  compatível com `drizzle-kit migrate`) + três COPY no runner + script
  `db:migrate:container`. Ver techContext "Migrations em Produção".
- **Revisão adversarial** (Workflow, 30 agentes, 26 achados → 6 confirmados / 20 refutados):
  pegou um defeito **grave** que eu tinha deixado passar — o `catch` descartava
  `error.cause`, e como a primeira instrução do migrator é `CREATE SCHEMA`, QUALQUER falha
  de conexão/senha/SSL apareceria como problema de privilégio nesse CREATE SCHEMA. Também
  pegou o `countApplied` engolindo erro de conexão e reportando "Já aplicadas: 0", e o
  `package.json` da imagem continuar anunciando o `db:migrate` quebrado.
- **Extra achado em teste de container** (não veio da revisão): `AggregateError` com
  `.message` vazia — `localhost` resolve para 127.0.0.1 **e** ::1, o Node agrega as duas
  falhas. Era exatamente a forma do erro no diagnóstico original. Desempacotado.
- **Verificação**: 6 cenários contra Postgres real + imagem real (banco vazio → 20 tabelas;
  idempotência; `drizzle-kit` depois reconhece as 6; arquivos na imagem legíveis pelo
  usuário `nextjs`; `npm run db:migrate:container` dentro do container → 20 tabelas;
  ECONNREFUSED/EAI_AGAIN/28P01/3D000/sem-DATABASE_URL com mensagem correta e exit 1).
- **2ª rodada (mesmo dia)**: o passo manual não sobrevivia a redeploy — o deploy seguiu
  quebrado porque ninguém rodou o comando. Migrations passaram a rodar SOZINHAS no boot
  (`CMD` inline, `||` para não derrubar o servidor, `exec` mantendo o next-server como PID 1,
  `pg_advisory_lock` serializando réplicas). Bug pego em teste de container: `pool.connect()`
  estava fora do `try`, então erro de host/senha virava stack cru e ignorava o diagnóstico.
- Portões: lint ✓, 348 testes ✓, build ✓.

### Pendências imediatas do deploy (lado do stakeholder)
1. Redeploy — as migrations agora rodam sozinhas no boot; conferir no log do container as
   linhas `[migrate]`.
2. `db:seed` (roles/permissões/admin) — precisa de `tsx` + `src/`: roda da máquina local ou
   de um `node:22-alpine` com o repo montado na VPS. **Sem ele não há como logar no portal.**
3. `db:import-catalog` (769 produtos, nascem `published=false`) + **decisão de publicação**
   (em massa vs curadoria) — sem isso `/produtos` fica vazio mesmo com banco populado.
4. `db:import-images` — SÓ da máquina local (`docs/PRODUTOS/` é gitignored, ~1 GB).

## Sessão 2026-08-23 — Vitrine de categorias fiel ao PSD + selo GPTW oficial
- **Feedback do stakeholder**: (1) vitrine de categorias da home "bem simples", não parecia com o
  projetado no Photoshop; (2) forneceu a arte oficial do selo GPTW (vigência FEV 2026 – FEV 2027).
- **Categorias**: o design está em `docs/Layout pag Produtos_OK_01.psd` (preview =
  `docs/categorias.jpeg`): 6 cards verticais neon com ilustrações line-art. A cena é um render 3D
  ACHATADO (camada única "Cor e vibração 1") — ilustrações não separáveis; artes RECORTADAS do
  composite por medição de luminância (molduras têm linha dupla + leve perspectiva) com patch do
  rótulo assado → 6 JPEGs em `public/images/home/categorias/`. Componente reescrito
  (`.card-neon` + `.card-neon-label` no globals.css, `color-mix` sobre tokens); cards = 6
  macro-famílias do PSD (não as 16 categorias do ERP); destinos validados contra o catálogo real
  (`resolveCategoryCardHref` + 6 testes). Ver decisionLog 2026-08-23.
- **GPTW**: fundo claro removido (flood-fill) → PNG transparente em
  `public/images/certifications/gptw-certificada-2026-2027.png`; rodapé mostra o selo oficial +
  vigência (dicionários com image/alt). Risco CDC do claim RESOLVIDO; renovação em fev/2027.
  Original de referência: `docs/selo-gptw-fev2026-fev2027.jpeg`.
- **`docs/PRODUTOS/` (~1 GB de fotos de produto por externalId, PNGs)**: chegou do stakeholder,
  NÃO versionado (adicionado ao .gitignore). Próximo passo provável: pipeline de upload para o R2
  ligando foto → produto por externalId.
- Portões: lint ✓, 348 testes ✓ (+7), build ✓; imagem Docker rebuildada, smoke OK
  (/pt e /en com os 6 hrefs validados, assets 200, selo no rodapé dos dois locales).
- **Revisão adversarial** (Workflow, 11 agentes): 4 confirmados/3 refutados; 4 corrigidos na hora
  (guard URIError, scrim WCAG, alt decorativo, EN Fittings). Ver progress.md Métricas.
- **Carga inicial de imagens de produto (parte 2 da sessão) — CONCLUÍDA**: primeiro 403 (token sem
  permissão), stakeholder corrigiu; `npm run db:import-images` subiu 613 imagens (336 MB) → 593
  produtos, 0 falhas; idempotência verificada (re-run pula 613); objeto amostrado byte-idêntico;
  container web recriado com envs R2 (portal apto a presign/confirm/delete no `roco-test`).
  Envs R2_* em `.env.local`/`.env` (gitignored). `R2_PUBLIC_URL` (r2.dev) habilitada pelo
  stakeholder na sequência: envs + rebuild com build-arg → SITE exibe as fotos reais
  (otimizador next/image 200, CSP ok). Catálogo público com imagem no ar em localhost:3000.

## Sessão 2026-08-12 — Finalização: commits, revisão adversarial e correções
- Recuperação pós-stall do architect: trabalho da parte 3 verificado (hero/menu polish aplicado,
  `hero-stage.jpg` recortado sem a barra pintada, SiteHeader único ancorado à viewport em todas
  as páginas; listagem servindo 737 produtos). Portões verdes (334→340 testes, lint, build).
- 7 commits atômicos: fix rate-limit register (20/10min), feat(site) completo (39 arquivos),
  build(docker) R2_PUBLIC_URL, chore(tooling) psd-extract, docs (memory-bank + PSDs referência),
  fix(produtos) achados da revisão.
- **Revisão adversarial multi-agente** (Workflow, 13 agentes): 8 achados confirmados, 1 refutado,
  7 corrigidos (ver progress.md Métricas). Backlog novo: endurecer register (captcha/e-mail),
  busca por categoria.
- Imagem Docker rebuildada com o código final; smoke tests no container.
- **Rodada 2 (feedback do stakeholder)**: header fixo translúcido padrão WEG (blur, mais sólido ao
  rolar, filete ciano→âmbar, painel mobile full-width com backdrop e trava de scroll) e primeira
  dobra reprojetada: board COVER full-bleed (sem tarjas), copy centralizada nos dois eixos entre o
  wordmark e os botões neon (POS.copy top 50% + translate), tipografia cqw reescalada, indicador
  de scroll. Chave nova `home.hero.scrollCue` (345 chaves pt/en, paridade OK). Commit fe00ef8.
- **Rodada 3 (feedback do stakeholder)**: hero passa a usar o VÍDEO institucional da ROCO
  (youtube-nocookie, autoplay mudo em loop, cover full-bleed, pôster hero-stage esmaecido) com
  conteúdo centralizado e CTAs `.btn-neon` reais — `CtaHotspot`/`POS`/`.hero-board` aposentados.
  CSP: `frame-src` ganha youtube-nocookie (script-src intacto). Nav uniforme padrão WEG: sem
  ícones lucide, sem text-glows, caixa alta, ativo = ciano (navLabelClass; 341 testes).
  Ver decisionLog 2026-08-12. **Follow-up**: trocar embed por MP4 self-hosted quando houver arquivo.
- **Rodada 4 (feedback do stakeholder)**: headline visível do hero substituída pelo LOGOTIPO ROCO
  (texto do dicionário preservado como sr-only no h1 — SEO/a11y); rodapé ganhou bloco
  "Certificações e selos" com badge GPTW textual (`footer.certifications`, array extensível;
  347 chaves pt/en). Arte oficial do selo + ano seguem pendentes (ver risco no progress.md).
- **Rodada 5 (feedback do stakeholder)**: chrome do player do YouTube (título/traduções,
  legendas, marca-d'água, controles pausa/próximo da UI de playlist do loop) aparecia sobre o
  vídeo → iframe com OVERSCAN de 35% além do cover; o wrapper corta o chrome para fora da tela.
  Nenhum parâmetro de embed desliga isso de forma confiável — mitigação até o MP4 self-hosted.
  Commits da sessão: d12fb88..5d9cde7 (13 atômicos). Imagem Docker local atualizada e smoke OK.

## Decisões do stakeholder que condicionam o go-live (consolidado 2026-08-23)
1. **Política de publicação do catálogo** — importador nasce `published=false`; sem publicação em
   massa deliberada ou curadoria no admin, `/produtos` estreia VAZIO (decisionLog 2026-08-11).
2. **Bucket R2 definitivo** — `roco-test` é de teste; criar bucket de produção + token próprio +
   acesso público (preferir domínio custom `img.roco.com.br` ao r2.dev).
3. **Infra + envs de produção** — Postgres, Redis (sem ele rate limit desliga — fail-open),
   AUTH_SECRET, admin bootstrap, ERP_WEBHOOK_SECRET; Google OAuth pendente (credenciais funcionam).
4. **LGPD do tracking Mautic** — em produção liga por padrão; decisão do banner aberta desde 08/08.
Runbook completo do primeiro seed: techContext.md ("Runbook — Primeiro Deploy em Produção").

## Estado ao fim de 2026-08-12
- Branch `feat/porta-mais-site`, working tree limpo, 341 testes verdes, lint/build verdes.
- Site no ar em localhost:3000 (container): home WEG (vídeo + logo + CTAs centrais), header fixo
  translúcido, nav uniforme, /produtos (737), footer com selo GPTW.
- Aguardando do stakeholder: MP4 do vídeo institucional (YouTube Studio), arte oficial do selo
  GPTW com ano, decisão publicação do catálogo em produção, Google OAuth, infra de produção.

## Sessão 2026-08-11 (parte 2) — Canal público de aquisição de representantes
- **Pré-cadastro pelo site** em `/{locale}/representantes` (nav "Força de Vendas" reativada):
  CNPJ obrigatório/validado + nome, e-mail, telefone, razão social e senha (login por credenciais;
  Google SSO com o mesmo e-mail funciona quando configurado).
- `POST /api/representatives/register`: rate limit IP+global, honeypot, dedupe e-mail/CNPJ (409),
  transação user (bcrypt 12) + representative `submitted` + audit log. Schema puro testável
  (`representative-register.ts`, 10 testes novos → 236).
- **Fluxo**: site → fila de aprovação do admin (review existente concede role) → primeiro acesso
  completa território+documentos (`completeProfile`, wizard "modo conclusão"; docs liberados para
  `approved`). CNPJ/razão social imutáveis pós-aprovação.
- Compartilhado: `shared/lib/phone.ts` (site+portal), alias `.form-neon` no globals.css.
- Ver decisionLog 2026-08-11 para o racional completo.

## Sessão 2026-08-11 — Stack Docker local sempre no ar
- `docker compose up -d`: web (localhost:3000, produção standalone) + postgres (host 5433) +
  redis (host 6380), todos `restart: unless-stopped`. Dados preservados no volume (737 produtos).
- Portas do host remapeadas (5433/6380) para não conflitar com Postgres/Redis de outros projetos;
  `.env.local` atualizado. Container web usa `.env` (gitignored) + hosts internos do compose.
- **Bug BuildKit/Windows**: `compose build` falha com caminhos `[locale]`/`(site)` → workaround
  permanente em `scripts/docker-build.cmd` (contexto via tar/stdin) + `--no-build` no up.
- Tracking Mautic desativado no bundle da imagem local (build-arg `false` — flag é build-time).
- Smoke tests OK: /pt 200, /api/products com dados, /pt/portal/login 200, guard 307, login
  credentials E2E 302 + cookie de sessão.

## Fase Atual
Site institucional completo + portal CRM — home reformulada (marketing completo), listagem/detalhe de
produtos do catálogo real, rodapé institucional. Sessão 2026-08-11 (parte 3) entregou site público robusto.

## O Que Foi Feito (esta sessão — 2026-08-10)
### Rodada "Robustez e Consistência"
- **Página de boas-vindas do representante** (`src/app/[locale]/(internal)/portal/boas-vindas/page.tsx`):
  componentes modulares welcome-hero/welcome-section-card/welcome-dw-system-card/welcome-closing/
  onboarding-status-alert. Copy oficial da ROCO em portal.welcome (34 chaves pt/en). CTA catálogo
  baixa `/downloads/catalogo-roco-2026.pdf`; materiais "Em breve" visíveis como Chip (não Tooltip).
  Homepage do representante: (internal)/portal/page.tsx redireciona role representative sem staff.
- **Campos MUI consistentes**: MuiTextField/MuiFormControl medium + fullWidth + outlined. Densidade
  documentada em `src/core/theme/index.ts`. createPortalTheme(locale) com tradução interna MUI.
- **Light mode (secondary amber #b25e00, AA 4.7:1)** em scheme light.
- **Paginação real**: representatives.list + products.list ganham {total, page, perPage} +
  TablePagination funcional; products.stats/representatives.stats novos no dashboard.
- **Rate limiting Redis** (fixed-window, fail-open sem REDIS_URL) em `src/server/lib/rate-limit.ts`:
  login 5/5min por e-mail + 30/5min global; webhook ERP 60/min; /api/products* 120/min por IP;
  presigns 30/5min por usuário. 18 testes novos → 226 total.
- **Teste de representante** criado em dev: representante@exemplo.com.br.

### 7 Bugs Reais Encontrados & Fixados (commits b968656→e689522)
1. **`sx` como função não cruza fronteira Server→Client**: welcome-hero/welcome-closing usavam
   callback de tema → trocado por rgba(var(--mui-palette-primary-mainChannel) / 0.16).
2. **Tooltip em Button disabled cause hydration mismatch**: clone do filho divergia SSR↔cliente
   → REMOVIDO; rótulo "Em breve no portal" virou Chip visível (melhor UX, touch-friendly).
   **Padrão**: nunca Tooltip em elemento disabled em árvore SSR.
3. **Onboarding refetch da query me sobrescrevia entrada do usuário**: autosave + invalidate
   refaziam a cada focus na janela → guard booleano (hidrata UMA vez, form local = fonte verdade).
4. **saveOnboarding wizard**: autosalva form INTEIRO (campos futuros vazios) + zod min(1) rejeita
   → preprocess ""→undefined (draftField helper); obrigatoriedade só no submit.
5. **CSS layers CRÍTICO**: enableCssLayer do Emotion punha MUI em @layer mui (declarada ANTES
   layers Tailwind) → preflight (@layer base) VENCIA MUI → inputs encolhiam. Solução: enableCssLayer
   REMOVIDO (src/core/theme/portal-providers.tsx) — MUI unlayered vence layers; seguro por route groups.
6. **Light mode com miolo preto**: body herda dark do site (globals.css) → (internal)/layout.tsx
   pinta Box bgcolor background.default + minHeight 100dvh.
7. **Processo órfão dev server** (Windows, porta 3000): killall via taskkill antes de restart.

## Próximos Passos Imediatos
1. [ ] Subir PDFs das boas-vindas (contatos, política comercial, logística) e vídeo Sistema DW.
2. [ ] Google OAuth Client ID (stakeholder).
3. [ ] Validar fluxo onboarding→aprovação admin (manual + testes E2E).
4. [ ] LGPD/CORS Mautic (herdado), rate limiting (recém-implementado).
5. [ ] Deploy: provisionar Postgres + Redis + R2 + envs de produção.

## Bloqueadores
- PDFs/vídeo dos materiais das boas-vindas (links desabilitados).
- Google OAuth credentials production.
- Confirmação arquitetura deployment (RDS/ElastiCache vs docker-compose).

## Sessão 2026-08-11 (parte 3) — Site institucional completo: home reformulada + /produtos + rodapé
- **Home** (`src/app/[locale]/(site)/page.tsx` + `src/modules/home/components/`): hero
  cinematográfico reaproveitado, seção institucional "Quem é a ROCO" (dados verificáveis: Roco Indústria
  Metalplástica S.A., 2014, Blumenau/SC + Gaspar/SC, GPTW, exportação Paraguai/Bolívia), vitrine de
  categorias reais, vitrine de produtos em destaque (badge `top` + fallback recentes), CTA Portal ROCO.
  Copy EN revisada; dicionário `home` (~50 chaves pt/en) reestruturado.
- **`/{locale}/produtos`** (listagem): grid com busca (debounce 350ms), filtro por categoria, paginação.
  SSR cacheado via `unstable_cache` (tag `"products"`, revalidate 300s), sem `generateStaticParams`.
  Funções novas: `getPublicProductList`/`getPublicCategoryList` em `src/server/lib/public-products.ts`.
- **`/{locale}/produtos/[slug]`** (detalhe): galeria (R2 via `next/image` com `remotePatterns`), nome,
  código, categorias, descrição, embalagens, badges, CTA "Solicite um orçamento" (modal Mautic).
  Produtos relacionados por categoria.
- **`SiteFooter`** (`src/shared/components/footer/`): rodapé completo (colunas, redes, copyright) em
  (site) layout. Namespace `footer` (~20 chaves pt/en).
- **3 bugs fixados**: (a) `assembleProducts` não trazia `nameEn` de categorias → EN broken; (b)
  `home.about.cta.href` apontava para `/sobre` (404) → corrigido para `/produtos`; (c)
  `getRemotePatterns()` gerava `pathname: "//*"` malformado sem subpath → corrigido.
- **Infra**: `next.config.ts` + `Dockerfile`/`docker-compose.yml` ganharam suporte a `R2_PUBLIC_URL`
  como build-arg (resolução de `images.remotePatterns` em build-time).
- **90 testes novos** (produtos explorer, detalhes, funções puras) → suite verde.
- **Segurança OWASP**: revisão OK, nenhum achado crítico/alto introduzido. Ver progress.md novos riscos.
- Ver decisionLog 2026-08-11 decisões #7–#11 para detalhes arquiteturais.

## Decisões Pendentes
- Confirmação: seal GPTW (ano/validade) com stakeholder antes de produção.
- Fluxo completo validação (onboarding→admin review→acesso portal).
- LGPD/consentimento banner (herdado 2026-08-04).

## Sessão 2026-08-23 (parte 3) — Slider de hero editável + portal completo + segurança
- **Pedido do stakeholder** (2026-08-23): "Mautic sai, entra RD Station.
  Portal completo (CRUDs, sidebar colapsável). Site mais profissional
  possível. Marketing precisa editar partes chave do layout, ex.: primeira
  seção configurável com N slides (vídeo ou foto, YouTube ou upload, janela
  de loop configurável)."
- **Resposta** (3 commits atômicos, e47bc1d..203e4b9):
  - `feat(home): carrossel de slides do hero + admin de catálogo` —
    schema `hero_slides` (migration 0003) + schema `site_settings`
    (migration 0004), server lib + tRPC para os dois, admin
    `/portal/hero` com reorder + dialog com abas (mídia/copy/CTAs/
    playback/agendamento), `home-hero.tsx` reescrito, novo `HeroSlider`
    com auto-advance + crossfade + pause-on-hover, `/catalogo` virou
    direct download via `getCatalogPdfUrl()`.
  - `refactor(site): sai Mautic, entra RD Station + LGPD stub + hardening`
    — remove 11 arquivos Mautic, adiciona `RdStationTracking` stub +
    `ConsentBanner` stub (useSyncExternalStore, sem setState em
    effect), restaura `cnpj.ts`/`cnpj.test.ts` (helpers puros),
    consumers (footer-link, nav-items, site-header, mobile-menu,
    quote-cta-button) reescritos para apontar a `/contato` em vez do
    modal Mautic, `next.config.ts` tira `mautic.roco.com.br` de 4
    diretivas CSP (mantém `youtube-nocookie.com`), `proxy.ts` corrige
    match exato de `/api`, `rate-limit.ts` ganha flag `productionSafe`
    para fail-closed nas rotas de auth.
  - `feat(portal): sidebar colapsável (persistido por usuário)` —
    `portal-shell.tsx` ganha estado `collapsed` + toggle no AppBar com
    `Tooltip`, persistido em `localStorage`, inicialização lazy em
    `useState(() => …)` (evita hydration mismatch e o flash de
    drawer expandido).
- **Gates**: lint ✓, 348 testes ✓ (baseline restaurada após restaurar
  `cnpj.test.ts`), build ✓. 0 dirty files.
- **Pendências abertas** (ver decisionLog 2026-08-23 + progress.md):
  LGPD body text (jurídico preencher antes de ligar
  `NEXT_PUBLIC_CONSENT_ENABLED`); R2 bucket de produção + URL pública
  definitiva (hoje `roco-test` com r2.dev); OAuth Google (login
  funciona só por credentials); follow-up de hardening para passar
  `productionSafe: true` nos 3 callers de auth.
- Próxima sessão sugerida: front da vitrine de hero com prévia visual,
  mensagens de WhatsApp automáticas no ciclo de representantes, full-sync
  ERP (preço + estoque) — destrava o badge "pronta entrega" e a
  vitrine de catálogo.
