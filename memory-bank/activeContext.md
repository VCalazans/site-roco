# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-24

## Sessão 2026-08-24 — Deploy destravado: migrations dentro do container

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
- Portões: lint ✓, 348 testes ✓, build ✓.

### Pendências imediatas do deploy (lado do stakeholder)
1. Redeploy para a imagem pegar o migrator, então `npm run db:migrate:container` no container.
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
