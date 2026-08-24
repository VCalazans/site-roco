# Decision Log — ROCO
> Registro de decisões arquiteturais importantes. Nunca deletar entradas — apenas adicionar.
> Formato: Data | Decisão | Alternativas | Justificativa | Impacto

---

## 2026-07-13 — Stack e estrutura base
**Decisão**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind v4, com estrutura
`src/{app,core,modules,shared,i18n}`.
**Alternativas**: Astro/Vite estático; estrutura flat sem `modules`.
**Justificativa**: Espelhar os projetos de referência da mesma casa (`site-autotec`,
`archicodesite`) garante consistência, reuso de padrões e evolução previsível.
**Impacto**: Base modular pronta para crescer sem retrabalho estrutural.

## 2026-07-13 — i18n por middleware (pt padrão, en secundário)
**Decisão**: i18n próprio via `middleware.ts` + segmento `[locale]` + dicionários JSON tipados.
**Alternativas**: next-intl; site pt-only.
**Justificativa**: Mesmo padrão das referências; ROCO é BR (pt padrão) mas a base já suporta en.
**Impacto**: Todo texto visível deve vir dos dicionários; rotas prefixadas por locale.

## 2026-07-13 — Página "Em breve": render do .psd como arte + foreground vivo
**Decisão**: Usar o render 3D do `.psd` como imagem de fundo cinematográfica e reconstruir
como HTML vivo apenas as camadas separáveis (nav, headline, parágrafo) + hotspots clicáveis
sobre os botões neon "assados" no render.
**Alternativas**: (a) usar o composite achatado inteiro como imagem estática (sem i18n/SEO/
responsivo); (b) recriar toda a cena em CSS (perderia a fidelidade do render 3D).
**Justificativa**: O wordmark central, a barra de navegação e os botões neon são geometria 3D
intrínseca ao render (camada única "Camada 2"), não separáveis. Manter o render preserva a
fidelidade; extrair headline/parágrafo (camadas próprias no `.psd`) mantém copy traduzível,
selecionável e indexável.
**Impacto**: Desktop usa caixa `aspect-[3224/1724]` + `containerType: inline-size` (texto em
`cqw`) para alinhar overlays ao render em qualquer largura; mobile reconstrói o foreground
empilhado com botões neon em CSS. Coordenadas medidas do `.psd` ficam em `coming-soon-hero.tsx`.

## 2026-07-13 — Extração de assets do .psd via Node (ag-psd)
**Decisão**: Extrair camadas/cores com `ag-psd` + `@napi-rs/canvas`.
**Alternativas**: `psd-tools` (Python) — inviável (sem `pip`/`ensurepip` no ambiente); ImageMagick — sem delegate PSD.
**Justificativa**: Node disponível e confiável; `ag-psd` lê a árvore de camadas e dados raster.
**Impacto**: Pipeline de reextração reproduzível documentado em techContext.

## 2026-07-13 — "Entre em contato": modal + formulário Mautic embutido
**Decisão**: O CTA "Entre em contato" (nav) abre um **modal** que embute o formulário do
**Mautic** (`https://mautic.roco.com.br/form/generate.js?id=1`). Padrão de provider/contexto
em `src/shared/components/contact-form/` (ContactFormProvider → ContactModal), espelhando o
lead-form dos projetos de referência.
**Alternativas**: página `/contato` dedicada (Bootstrap, como no HTML enviado); link `mailto`.
**Justificativa**: Modal mantém o usuário na landing "Em breve"; reaproveita o Mautic já
existente da ROCO (id=1). Não usamos Bootstrap (conflita com Tailwind) — o form do Mautic é
estilizado via `.mautic-form-wrap` no `globals.css`, no tema dark/neon.
**Impacto**: O script do Mautic é injetado **lazy** (só ao abrir, uma vez) dentro do container;
o modal fica montado (opacity/pointer-events) para preservar o form entre abre/fecha. URL do
Mautic hardcoded em `contact-modal.tsx` (`MAUTIC_FORM_SRC`) — parametrizar via env se necessário.

## 2026-07-13 — Fontes: Inter (corpo) + Poppins (display)
**Decisão**: Pareamento via `next/font/google`.
**Alternativas**: Geist (referências) — menos alinhado ao visual industrial da ROCO.
**Justificativa**: Poppins (geométrica) aproxima a headline do `.psd`; Inter para leitura.
**Impacto**: Variáveis `--font-inter`/`--font-poppins` consumidas pelo `@theme`.

## 2026-07-19 — Refatoração da landing + nova barra de nav do PSD + resolução centralizada de destinos
**Decisão**: (1) Quebrar monolito `coming-soon-hero.tsx` (~259 linhas) em componentes modulares:
`hero-layout.ts` (constantes/tipos), `nav-items.tsx` (renderizador de itens), `cta-hotspot.tsx`
(hotspot transparente), `mobile-menu.tsx` (hambúrguer); (2) Integrar nova barra de nav do PSD
`docs/Novos ícones_OK.psd` (4 itens: Home, Ligamos pra você, Solicite um orçamento, Entre em
contato) com ícones lucide-react (PhoneCall, Headset); (3) Centralizar resolução de destino via
`resolveDestination(href)` em `src/core/config/site.ts` (mapeia `#produtos`/`#catalogo` para env).
**Alternativas**: Manter monolito (menos manutenível); hardcodar ícones; resolver destino em N componentes.
**Justificativa**: Modularização facilita reuso e testes futuros; ícones lucide garantem fidelidade
ao PSD sem assets adicionais; centralização evita duplicação de lógica.
**Impacto**: Componentes menores e focados; nav escalável (container-query desktop + mobile
hambúrguer); destinos mapeáveis via env sem tocar código. **Premissas em aberto**: Os 3 itens de
contato abrem o MESMO modal Mautic (id=1) — confirmar se "Ligamos pra você" vai para WhatsApp.
Copy EN provisório; labels desktop em 1 linha (PSD mostra 2) — afinar.

## 2026-07-19 — Validação de CNPJ + enhancement client-side do formulário Mautic
**Decisão**: Criar camada de "enhancement" client-side para o form Mautic (injetado em runtime).
Arquivos novos em `src/shared/components/contact-form/`: `cnpj.ts` (funções puras de validação/
formatação com suporte alfanumérico desde jul/2026 — base de 12 chars com A–Z/0–9 + 2 DV numéricos)
e `use-mautic-enhancements.ts` (hook + função DOM pura que aplica máscara de CNPJ/telefone,
validação inline via `aria-invalid`, e **bloqueia submit de CNPJ inválido** usando listener na fase
de CAPTURA do evento submit no container — antes do AJAX/POST do Mautic).
**Alternativas**: (a) deixar validação só no servidor Mautic (sem feedback imediato); (b) reescrever
form em React (perde manutenibilidade); (c) validar mas não bloquear (menos UX).
**Justificativa**: Mautic injeta HTML em runtime (não é React); enhancement via DOM oferece máscara,
feedback visual e bloqueio de submit inválido **antes** de atingir Mautic. Rejeita comprimento
errado, sequências repetidas. Usa `MutationObserver` para achar campos assincronamente.
**Impacto**: (1) Campos inválidos não disparam AJAX/POST — previne rejeição no Mautic. (2) Validação
só se preenchido — obrigatoriedade é responsabilidade do Mautic. (3) Integração em `contact-modal.tsx`
via hook. (4) Novo CSS em `globals.css` (`input[aria-invalid="true"]`). (5) Dicionários ampliados.
Verificação manual: unit CNPJ 10/10 + simulação DOM 9/9 (happy-dom). Débito: test runner formal.

## 2026-08-04 — Tracking de visitantes: Mautic `mtc.js` self-hosted + pageview por rota
**Decisão**: Adotar o tracking do **Mautic** (`mtc.js`) como analytics do site, mas **sem carregar o
script do servidor Mautic**: cópia verificada e self-hosted em `public/vendor/mautic-tracking.js`,
consumida por `src/shared/components/analytics/mautic-tracking.tsx` (client component montado em
`app/[locale]/layout.tsx`). A CSP mantém `script-src 'self'`; foi adicionado apenas o domínio do
Mautic ao `img-src`. Flag `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED` (produção: ligado salvo `"false"`;
desenvolvimento: desligado salvo `"true"`).
**Alternativas**: (a) snippet oficial carregando `https://mautic.roco.com.br/mtc.js` — exigiria
devolver o domínio do Mautic ao `script-src`, reabrindo exatamente o vetor fechado após o ClickFix;
(b) GA4/GTM — mais relatórios, mas cookies de terceiros, banner de consentimento e ainda assim
liberação de CSP para domínios Google; (c) analytics cookieless (Umami/Plausible) — melhor para LGPD,
porém não amarra a visita ao lead que já existe no Mautic.
**Justificativa**: O funil da ROCO (catálogo e contato) já vive no Mautic; o pixel liga visita ↔ lead
sem ferramenta nova. Self-hosting preserva a garantia pós-ClickFix: mesmo com o servidor Mautic
reinfectado, nenhum script de fora executa nesta origem — só *dados* do hit saem.
**Auditoria da cópia** (2026-08-04, SHA-256 `d4378644…d6d4dc7f000`, 100.654 bytes): zero indicadores
de ClickFix/ofuscação (`clipboard.writeText`, `execCommand`, `powershell`, `mshta`, `eval(`,
`new Function`, `atob`, `fromCharCode`, `unescape`, `document.write`). Os dois caminhos que
injetariam script remoto são inertes aqui: `initGatedVideo()` aborta sem `<video>` na página, e o
loader de `mautic-form.js` só roda ao renderizar slot de *Dynamic Web Content* — o site não tem
nenhum dos dois. Detalhes em `public/vendor/README.md`.
**Impacto**: (1) O hit sai por `POST /mtc/event` (caminho principal) **ou** pelo pixel
`mtracking.gif` (fallback). O `mtc.js` manda `X-Requested-With` + `withCredentials=true`, então o
navegador exige preflight; o Mautic responde corretamente (`Access-Control-Allow-Credentials: true`
+ eco da origem), **mas sua allowlist de CORS contém somente `https://roco.com.br`** — `www` e
qualquer outro host recebem preflight sem headers. Como hoje `roco.com.br` **e** `www.roco.com.br`
servem o site (nenhum canonicaliza), visitantes em `www` caem no pixel: o hit é registrado, porém
`setTrackedContact` não roda e os cookies `mtc_id`/`mtc_sid` não são gravados no cliente — a visita
não é amarrada ao contato. Por isso o `img-src` é load-bearing, não enfeite. **Correção a fazer:**
adicionar `https://www.roco.com.br` às "CORS Valid Domains" do Mautic, ou canonicalizar o site em um
único host por redirect. (2) SPA: o hit automático do
`mtc.js` cobre só a primeira view, então o componente emite um pageview por `pathname` novo,
deduplicado por variável de MÓDULO (`lastTrackedPath`) — sobrevive à remontagem do layout na troca
de locale e absorve a dupla invocação de efeitos do StrictMode. (3) **LGPD em aberto**: o `mtc.js`
grava cookies de primeira parte (`mtc_id`, `mtc_sid`, `mautic_device_id`) + `localStorage` e
identifica o visitante, e **não há banner de consentimento** — decisão de opt-in ficou pendente com
o stakeholder; a flag desliga tudo sem editar código se o jurídico exigir.

## 2026-08-09 — Portal interno/CRM como monolito Next.js (mesmo app do site)
**Decisão**: O portal interno (início da estrutura de CRM) vive DENTRO do mesmo app Next.js 16 do
site institucional — rotas `/portal/*` (representantes + time interno) e `/admin/*`, mesmo deploy,
1 Dockerfile, 1 domínio.
**Alternativas**: (a) monorepo Nx estilo Valora (apps/web Next.js + apps/api NestJS + worker
separado) — projeto de referência usa esse padrão; (b) híbrido com worker NestJS separado só para
sync ERP.
**Justificativa**: Consistência com o briefing, operação mais simples (1 container), o time é
pequeno e o escopo MVP não justifica infra de microserviços; o padrão modular do repo
(src/modules/<feature>) comporta o portal como módulos.
**Impacto**: Novas rotas em src/app/[locale]/(portal) e (admin); Route Handlers e tRPC no mesmo
deploy; escalar depois para API separada se o CRM crescer.

## 2026-08-09 — Autenticação: Auth.js v5 (NextAuth) + Google SSO
**Decisão**: Auth.js v5 com provider Google (SSO) como método primário de login do portal;
sessões via Drizzle Adapter no Postgres; middleware protege /portal/* e /admin/*.
**Alternativas**: Lucia v3 (mais controle, mais boilerplate), Clerk (SaaS, vendor lock-in, custo
por MAU), Supabase Auth (acopla vendor).
**Justificativa**: Stack oficial do ecossistema Next, SSO Google nativo, integração com RBAC em
callbacks de sessão, sem custo por usuário.
**Impacto**: Novas env vars (AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET); tabelas de auth no
schema Drizzle; rota /api/auth/[...nextauth].

## 2026-08-09 — Persistência: PostgreSQL + Drizzle ORM
**Decisão**: PostgreSQL como banco do portal/CRM, Drizzle ORM (type-safe, migrations via
drizzle-kit).
**Alternativas**: Prisma (mais maduro, porém runtime maior — e o Valora usa Prisma), SQLite (só
dev), Supabase.
**Justificativa**: Type-safety end-to-end com TS strict, leve em serverless/standalone, adapter
oficial do Auth.js.
**Impacto**: Pasta src/db (schema, migrations), serviço Postgres no docker-compose, env
DATABASE_URL.

## 2026-08-09 — RBAC granular (resource + action) desde a concepção
**Decisão**: Modelo de permissões granular — Role → RolePermission → Permission(resource, action)
— com roles seed (admin, sales_manager, representative, viewer) e helper requirePermission();
audit log de mutações sensíveis.
**Alternativas**: Role única por usuário hardcoded (estilo Valora: 'admin' | 'appraiser'); CASL.
**Justificativa**: Requisito explícito do stakeholder ("alto controle de granularidade de
acessos"); o portal recebe públicos distintos (representantes em onboarding vs time interno
gerindo produtos).
**Impacto**: Tabelas roles/permissions/user_roles/audit_logs; checagem em tRPC procedures e
Server Actions; sessão carrega permissões.

## 2026-08-09 — Imagens de produto: Cloudflare R2 com presigned URLs
**Decisão**: Upload direto do browser para R2 via presigned PUT (fluxo 2-step: presign → upload
→ confirm com validação HEAD antes do INSERT), keys namespaced por produto.
**Alternativas**: AWS S3 (egress pago), upload proxy pelo servidor (banda/latência).
**Justificativa**: Requisito do stakeholder (bucket Cloudflare); R2 sem egress fee; padrão
presigned já validado no projeto Valora (modules/storage).
**Impacto**: Env vars S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY; CSP img-src ganha
domínio do R2; tabela product_images.

## 2026-08-09 — Sync ERP: fila assíncrona BullMQ + Redis, worker in-process
**Decisão**: Sincronização de produtos do ERP via BullMQ sobre Redis, com idempotência por
externalId, retry exponencial e DLQ; worker roda in-process no app Next (registrado via
instrumentation), com trigger por webhook do ERP + botão "Sincronizar agora" no admin.
**Alternativas**: Polling HTTP; webhook sem fila; sync manual + cron; pg-boss (fila no Postgres).
**Justificativa**: Resiliência (ERP fora do nosso controle), observabilidade de jobs, sem processo
extra para operar no MVP.
**Impacto**: Redis no docker-compose; env REDIS_URL; endpoint /api/webhooks/erp + /api/admin/sync.

## 2026-08-09 — API de produtos: tRPC interno + REST público, cache por revalidateTag
**Decisão**: Portal consome tRPC v11 (type-safe, mesmo repo); o site público consome os dados de
produto via Route Handlers REST no MESMO app (mesma origem, sem CORS), com unstable_cache +
revalidateTag("products") invalidado nas mutações e no sync ERP.
**Alternativas**: REST puro com OpenAPI; API NestJS dedicada; GraphQL; PostgREST.
**Justificativa**: Type-safety no portal sem boilerplate; site público mantém SSG/ISR com
invalidação sob demanda; requisito novo do stakeholder: "o site vai precisar ter comunicação
direta com as APIs para listagem de produtos".
**Impacto**: src/server/trpc (routers), src/app/api/products (REST público read-only); páginas de
catálogo passam a poder listar produtos do banco.

## 2026-08-09 — UI do portal: MUI com tema centralizado dark/light
**Decisão**: Portal usa Material UI (CSS variables theme, colorSchemes dark/light, toggle
persistido) com tokens da marca ROCO (neon cyan #3ec6f0 / amber #f5a33c) centralizados em um
único theme; convive com Tailwind v4 (site público permanece Tailwind/dark-only).
**Alternativas**: shadcn/ui + Tailwind (mais coeso com o site, menos componentes prontos de
data-grid/forms); Archicode Design System puro (dark-only, referência Valora).
**Justificativa**: Requisito explícito do stakeholder ("Use MUI para componentes, e conceba o
projeto com tema centralizado já com Darkmode/Light já na concepção"); MUI DataGrid acelera o
CRUD de produtos.
**Impacto**: Deps @mui/material + @mui/material-nextjs + @emotion; src/core/theme com o theme
único; portal isolado do CSS do site institucional.

## 2026-08-09 — Sessão JWT com revalidação de staleness (5min) e maxAge 8h
**Decisão**: Sessões Auth.js usam JWT com estratégia de revalidação: `maxAge` 8h, `UPDATE`
trigger a cada 5 min; usuário desativado derruba a sessão em ≤5min sem esperar expiração.
**Alternativas**: (a) database strategy (custo de query por request); (b) JWT 30d default
sem revalidação (sem revogação efetiva).
**Justificativa**: Pós-security-scan, garantir que acesso revogado (desativação, mudança de
role) valide e derrube a sessão rapidamente — essencial para representantes em onboarding.
**Impacto**: Callback `jwt()` valida `user.active` a cada 5min; `session` carrega roles/
permissions atualizados; tablela `users.active` booleano. Verifica staleness vs timestamp.

## 2026-08-09 — Next.js 16.0.3 → 16.3.0 (CVE RCE + middleware bypass)
**Decisão**: Atualizar Next.js de 16.0.3 para 16.3.0 por vulnerabilidades críticas: RCE de
código arbitrário + bypasses de middleware descobertos e patchados em versão posterior.
**Alternativas**: Pinnar 16.0.3 e monitorar CVE (risco operacional).
**Justificativa**: Segurança de produção; `npm audit --omit=dev` chegou a 0 vulns após atualização.
**Impacto**: Build continua passando; nenhuma breaking change API; docker-compose usa node:22-alpine.

## 2026-08-09 — Testes: Vitest 4 como runner oficial
**Decisão**: Vitest 4 como test runner padrão do projeto (substitui Jest/manual); 208 testes
configurados, 100% de cobertura da lógica pura (rbac, cnpj, slugify, job-id, db-error,
permissions, phone).
**Alternativas**: Jest (mais maduro, ecossistema; overhead de config), descentralizado (manual).
**Justificativa**: ESM/TypeScript nativo, rápido (Vite), setup mínimo; débito do MVP resolvido.
**Impacto**: Vitest 4 em devDependencies; scripts `npm run test`, `test:watch`, `test:coverage`;
alias `@/*` vivo em testes via stub de `server-only`.

## 2026-08-09 — Login tradicional (Credentials + bcrypt) ao lado do Google SSO
**Decisão**: Adicionar **método tradicional de login** (e-mail + senha) em paralelo ao Google SSO,
usando Auth.js v5 Credentials provider com hash bcrypt (bcryptjs 3, custo 12) armazenado em coluna
`users.passwordHash` (nullable — contas só-SSO não têm senha). Bootstrap de admin via `npm run db:seed`
usando env vars `PORTAL_ADMIN_EMAIL` e `PORTAL_ADMIN_PASSWORD` (mínimo 12 chars, sem padrão hardcoded).
**Alternativas**: (a) Só SSO (Google Workspace); (b) Magic link por e-mail; (c) Oauth terceiro (Microsoft/GitHub).
**Justificativa**: Acesso de usuários que não usam Google Workspace (ex.: parceiros); bootstrap de
admin sem depender de OAuth pré-configurado no GCP; bcryptjs puro JS evita binário nativo (argon2)
em alpine (docker); estratégia existing/non-existing genérica (sem revelar se e-mail existe).
**Impacto**: (1) Migration drizzle/0002: coluna `users.passwordHash` nullable. (2) UI nova em
`/portal/login`: card com campos e-mail/senha + divisor "ou" + botão Google; erro genérico
`?error=credentials` sem revelar se e-mail/senha inválidos. (3) Dicionários: `portal.login.{emailLabel,
passwordLabel,signInButton,orDivider,invalidCredentials}` pt/en. (4) `npm run db:seed` idempotente:
cria/atualiza hash de admin se envs definidas (segurança: rejeita senha <12 chars). (5) Scripts
`db:seed` e `db:import-catalog` migraram para `tsx` (devDependency) — Node 20 local sem `--experimental-strip-types`.
**Risco**: Com login por senha, rate limiting no endpoint de credenciais ficou URGENTE (brute force) —
já estava no backlog de segurança; recomendação: `@upstash/ratelimit` sobre Redis existente no login.

## 2026-08-10 — MUI unlayered: remoção do enableCssLayer
**Decisão**: Remover `enableCssLayer: true` do Emotion config em `src/core/theme/portal-providers.tsx`.
O MUI passa a usar CSS _unlayered_ (global scope) em vez de `@layer mui`, vencendo qualquer camada
do Tailwind por especificidade bruta (regra CSS padrão, não layer).
**Alternativas**: (a) Manter enableCssLayer e fixar ordem manualmente com statements @layer —
inviável, Tailwind v4 ainda consome statements @layer do developer no globals.css (não permite
reordenar); (b) manter layers e aceitar que inputs encolhem no dark → rejeitado (bug crítico).
**Justificativa**: A CSS layer _order_ é definida pela **primeira aparição no documento** (não por
declaração). Emotion (MUI) rodava primeiro em SSR → `@layer mui` era declarado antes das layers do
Tailwind (@theme/@base/@components/@utilities) → preflight (@layer base, zera padding/border) VENCIA
o MUI (especificidade global < layer local). Solução: remover `@layer` do MUI garante que CSS
unlayered vence qualquer layer, mantendo inputs/labels corretos em qualquer esquema de cores.
**Impacto**: (1) MUI CSS servido sem camadas — especificidade bruta, mas previne buracos de
especificidade. (2) Route groups isolam o escopo: (site) usa só Tailwind (layered), (internal) usa
MUI (unlayered) — nunca compartilham componentes. (3) Padrão para o projeto: quando misturar layer
e unlayered, usar route groups e garantir fronteiras lógicas. (4) Verificação realizada: inputs
aparecem corretamente, labels alinhados, light/dark mode consistente.

## 2026-08-10 — Boas-vindas como homepage do representante + padrão anti-Tooltip em disabled
**Decisão**: A página `/portal/boas-vindas` é a **homepage autêntica** do representante (role
`representative` sem `staff`). Rota `/portal` redireciona para `/portal/boas-vindas`. A página
renderiza welcome-hero (copy ROCO oficial, 34 chaves i18n pt/en), seções de atalhos e materiais
"Em breve" visíveis como **Chip** com label "Em breve no portal" (não Tooltip em Button disabled).
**Alternativas**: (a) Usar Tooltip em Button disabled (padrão MUI) — causa hydration mismatch em
SSR (clone do filho diverge); (b) Button disabled sem rótulo — UX ruim, não evidente por quê
desabilitado (especialmente em touch).
**Justificativa**: **Padrão descoberto**: Tooltip renderiza um Popper que clona o filho para
medir/posicionar → em SSR, o cloneElement pode divergir do original (ex.: aria-describedby).
Mesmo sem style inline, a reação do React é hydration mismatch. Para elementos disabled em árvore
SSR, usar Chip ou texto visível em vez de Tooltip. Chip tem semântica melhor (affordance clara,
touch-friendly).
**Impacto**: (1) Componentes: `src/modules/portal/components/welcome/{welcome-hero,welcome-section-card,
welcome-dw-system-card,welcome-closing,onboarding-status-alert}.tsx` em `(internal)/portal/boas-vindas/page.tsx`.
(2) Copy em portal.welcome (pt/en). (3) CTA catálogo baixa `/downloads/catalogo-roco-2026.pdf`
(hoje placeholder). (4) Materiais sem asset (contactos, política, logística, vídeo DW) com Chip
visível (não Tooltip). (5) **Padrão de projeto**: nunca Tooltip em elemento disabled em SSR; usar
Chip, Badge ou texto inline.

## 2026-08-11 — Canal público de aquisição de representantes (pré-cadastro no site, CNPJ obrigatório)
**Decisão**: O cadastro inicial do representante se dá pelo SITE PÚBLICO em `/{locale}/representantes`
(nav "Força de Vendas" reativada — item já existia estacionado com `hidden: true` e ícone `sales`).
O pré-cadastro exige **CNPJ obrigatório e válido** + dados principais (nome, e-mail, telefone, razão
social, senha) e cria `user` (bcrypt 12) + `representatives` já em **status `submitted`** — direto na
fila de aprovação do admin (`/portal/representantes`, fluxo de review existente, que concede a role).
O **primeiro acesso pós-aprovação** completa o restante: wizard em "modo conclusão" (território +
documentos) via nova mutation `completeProfile` (só status `approved`; presign/confirm de documentos
liberados para `approved` — `DOCUMENT_STATUSES`). CNPJ/razão social ficam imutáveis pós-aprovação.
**Alternativas**: (a) manter onboarding só pós-login (fluxo original draft→submit→review) — não
atende "cadastro inicial pelo site"; (b) aprovar só após perfil completo — atrasa a esteira comercial;
(c) convite por e-mail/WhatsApp — sem infra de e-mail no MVP.
**Justificativa**: Requisito do stakeholder: canal padrão de cadastro acessível pelo site, com CNPJ
obrigatório e aprovação da administração; o resto preenchido no primeiro acesso. Senha no form é o
único método de login funcional hoje (Google OAuth ainda sem credentials); SSO Google passa a
funcionar automaticamente com o mesmo e-mail quando configurado.
**Impacto**: (1) Rota pública `POST /api/representatives/register`: rate limit 5/10min por IP +
30/5min global, honeypot (`website`, sucesso silencioso), dedupe e-mail (409 `email_exists`) e CNPJ
(409 `cnpj_exists` — enumeração aceita como trade-off de UX, mitigada por rate limit), transação
user+representative+audit (`representatives.register`, ator = próprio usuário, IP registrado).
(2) Schema zod em `src/server/lib/representative-register.ts` (puro, testável — 10 testes novos,
236 total). (3) `formatPhoneBR`/`isValidPhoneBR` movidos para `src/shared/lib/phone.ts` (site +
portal; portal re-exporta). (4) Estilos de input neon ganharam alias `.form-neon` no globals.css
(antes presos a `.mautic-form-wrap`). (5) Novo módulo `src/modules/representatives/` (form client +
tipos de dicionário); página com glows dual-tone (sem arte nova). (6) Dicionários: namespace raiz
`representatives` (~35 chaves), `portal.onboarding.completion`, `portal.login.registerPrompt/Link`;
sitemap + `resolveDestination("#representantes")`. (7) Wizard: `ProfileCompletion` quando
`approved && !region`; alerta de boas-vindas convida a completar o cadastro no mesmo caso.

## 2026-08-11 — Site institucional completo inspirado na IA da WEG (retirada da landing "Em breve")
**Decisão**: A home (`/{locale}`) deixa de ser a página de espera (`ComingSoonHero`) e passa a ser uma home de site de marketing completo, com organização de informação (IA) inspirada em https://www.weg.net (nav já existente + hero cinematográfico + bloco institucional "Quem é a ROCO" + vitrine de categorias reais do catálogo + vitrine de produtos em destaque + CTA "Portal ROCO" + rodapé completo), mantendo a identidade visual ROCO (dark industrial, neon dual-tone cyan/amber, Inter/Poppins). `ComingSoonHero`/`modules/landing` são retirados de uso (removidos do roteamento; histórico preservado no git).
**Alternativas**: (a) manter a landing "Em breve" e só adicionar `/produtos` (não atende ao pedido do stakeholder de "atualizar a estrutura... usando a WEG de referência"); (b) clonar a WEG 1:1 (fora de escopo — WEG é multinacional com CMS de notícias/RI/carreiras que a ROCO não tem).
**Justificativa**: Pedido explícito do stakeholder; a WEG referencia um padrão de IA testado (hero → institucional → soluções por segmento → produtos em destaque → CTA → rodapé) que se adapta bem ao catálogo real já existente (10 categorias, 737 produtos).
**Impacto**: `src/app/[locale]/(site)/page.tsx` passa a compor `src/modules/home/components/*`; chave de dicionário `comingSoon` renomeada para `home` (árvore pt/en reestruturada); `SiteHeader` ganha variante para páginas sem hero de fundo (fundo sólido no scroll) — usada pelas novas páginas.

## 2026-08-11 — Nova rota `/produtos` (listagem + detalhe) distinta de `/catalogo` (PDF)
**Decisão**: Criar `/{locale}/produtos` (listagem, grid + busca + filtro por categoria + paginação, consumindo o catálogo real via `/api/products`) e `/{locale}/produtos/[slug]` (detalhe), em `src/modules/products/`. A rota `/{locale}/catalogo` (form Mautic + download do PDF) é mantida sem alterações — propósito distinto (geração de lead). O placeholder `#produtos` em `resolveDestination()` passa a apontar para `/{locale}/produtos` por padrão (em vez de `siteLinks.products` vazio).
**Alternativas**: (a) reaproveitar `/catalogo` para a listagem — colidiria com o fluxo de captura de lead já existente e mudaria seu propósito; (b) `/produtos` como alias de `/catalogo`.
**Justificativa**: Pedido explícito ("criar a página de listagem de produtos com base no que já temos cadastrado na API"); a API pública já suporta paginação/busca/filtro por categoria (`getPublicProductList`).
**Impacto**: `src/core/config/site.ts` ganha `PRODUCTS_SEGMENT`/`productsPath()`; `sitemap.ts` ganha `/produtos` e, por enquanto, sem entradas por produto individual (catálogo muda com frequência — ver próxima decisão); nav "Portal ROCO" inalterada.

## 2026-08-11 — Páginas de produto renderizam dinamicamente (sem `generateStaticParams` para `[slug]`)
**Decisão**: `/produtos` e `/produtos/[slug]` NÃO usam `generateStaticParams` para o catálogo (só o segmento `[locale]`, quando aplicável, sem tocar banco). As páginas renderizam por requisição, usando funções já envolvidas em `unstable_cache` (tag `"products"`, revalidate 300s, invalidada por `revalidateTag` nas mutações do admin/sync ERP).
**Alternativas**: (a) `generateStaticParams` completo (locale × slug) — exigiria `DATABASE_URL` disponível durante `docker build`/`next build`, o que contraria o padrão do projeto de tratar segredos de runtime como runtime-only (nunca no build da imagem) e infla o tempo de build para 737+ produtos × 2 idiomas; (b) ISR com `generateStaticParams` parcial (top N produtos) — complexidade extra sem ganho real, já que `unstable_cache` entrega o mesmo benefício de cache com invalidação sob demanda.
**Justificativa**: Consistência com o padrão já estabelecido para `/api/products` (cache por tag, não por build); evita acoplar o build da imagem Docker ao Postgres.
**Impacto**: Página de produto é SSR cacheado (não SSG); primeira visita após deploy/rebuild ainda é rápida (cache compartilhado entre requisições via `unstable_cache`). **Desvio registrado** da regra geral "toda página em `[locale]/` exporta `generateStaticParams`" (CLAUDE.md) — aplicável apenas às rotas cujo conteúdo vem do Postgres.

## 2026-08-11 — Rodapé institucional (`SiteFooter`) para todo o grupo `(site)`
**Decisão**: Criar `src/shared/components/footer/site-footer.tsx`, renderizado no layout de `(site)` (todas as páginas públicas: home, `/produtos`, `/produtos/[slug]`, `/catalogo`, `/representantes`). Estrutura inspirada na WEG (colunas de links, redes sociais, selo de copyright) mas com o sitemap real da ROCO (sem colunas fictícias como "Investidores"/"Ética" que a WEG tem e a ROCO não).
**Alternativas**: manter sem rodapé (estado atual) — inconsistente com "site robusto".
**Justificativa**: Pedido do stakeholder; toda página do site carecia de rodapé até aqui.
**Impacto**: `src/i18n/dictionaries/{pt,en}.json` namespace `footer` expandido (era só `rights`); `(site)/layout.tsx` passa a renderizar `<SiteFooter>`.

## 2026-08-11 — Conteúdo institucional só com dados reais (sem estatísticas/notícias fabricadas)
**Decisão**: A seção institucional da nova home usa apenas fatos verificáveis: dados do próprio catálogo (contagem real de produtos/categorias publicados) e informação pública da ROCO levantada pelo `researcher` (site oficial, redes sociais). NÃO replicamos os blocos "Notícias" e "Newsletter" da WEG (exigiriam CMS/E-mail marketing inexistentes) nem números fictícios de colaboradores/engenheiros como a WEG exibe.
**Alternativas**: inventar números "de efeito" (rejeitado — falso, risco de CDC/propaganda enganosa); replicar 1:1 a seção de notícias da WEG usando dados mockados (rejeitado — mockar conteúdo institucional é enganoso e vira débito técnico).
**Justificativa**: Compliance (CDC/LGPD) citado no papel do `copywriter`; a ROCO não tem CMS de notícias nem newsletter integrada hoje.
**Impacto**: Home mostra "vitrine de categorias" e "produtos em destaque" citando números reais (ex.: "X produtos em N categorias", carregado do banco); seções "Notícias"/"Newsletter" ficam no backlog pós-MVP (registrar em progress.md) até existir fonte de conteúdo real.

## 2026-08-11 — `next/image` remoto para fotos de produto no site público (R2)
**Decisão**: `next.config.ts` ganha `images.remotePatterns` apontando para o host de `R2_PUBLIC_URL` (mesma origem já liberada no `img-src` da CSP). `Dockerfile`/`docker-build.cmd` passam a aceitar `R2_PUBLIC_URL` como build-arg (necessário porque `next build` resolve `images.remotePatterns` e `headers()` em build-time).
**Alternativas**: continuar usando `<img>` cru nas páginas novas (mais simples, mas contraria a regra "imagens sempre via next/image" e perde otimização/lazy-loading no site público, que é indexado publicamente — diferente do portal interno, onde isso já é um débito técnico conhecido).
**Justificativa**: `/produtos` e `/produtos/[slug]` exibem fotos reais dos produtos (quando existentes) vindas do R2; sem `remotePatterns` o otimizador do Next rejeita a URL.
**Impacto**: Build da imagem Docker precisa do build-arg `R2_PUBLIC_URL` a partir de agora para exibir fotos reais localmente; sem ele, as páginas caem no estado "sem foto" (placeholder), sem quebrar.

## 2026-08-11 — Política de publicação do catálogo: importador nasce `published=false`; ambiente local publicado em massa via SQL para demonstração
**Decisão**: O importador de catálogo (`npm run db:import-catalog`) mantém `published=false` por padrão — comportamento original, por design (curadoria manual do admin em `/admin/produtos` antes de cada produto ir ao ar no site público). Para o ambiente LOCAL de desenvolvimento/demonstração — onde só 5 dos 737 produtos importados estavam `published=true`, fazendo a nova página `/produtos` mostrar um catálogo quase vazio — foi executado manualmente `UPDATE products SET published = true` direto no Postgres local (732 linhas afetadas; 737/737 produtos publicados, 16 categorias ativas). Essa é uma mudança SÓ DE DADOS no ambiente local (volume Docker `roco_postgres_data`), não uma mudança de código, schema ou do comportamento do importador.
**Alternativas**: (a) manter só os produtos já publicados manualmente e aceitar uma listagem quase vazia até o admin publicar item a item — inviável para validar/demonstrar a feature de listagem pública; (b) mudar o IMPORTADOR para `published=true` por padrão — mudaria o comportamento também em produção, onde cada novo produto sincronizado do ERP iria direto ao ar sem revisão (risco: produto sem foto, descrição incompleta, preço desatualizado exposto publicamente sem curadoria).
**Justificativa**: A feature de listagem pública (`/produtos`) precisa de dados reais para ser útil/testável localmente; a curadoria admin-driven continua sendo o modelo correto para produção. A decisão de PRODUÇÃO permanece em aberto — ver pendência abaixo.
**Impacto**: Ambiente local reflete o catálogo completo (737 produtos publicados, 16 categorias). **Pendência para o stakeholder decidir antes do deploy em produção**: (1) manter `published=false` por padrão no importador, publicando em produção via curadoria do admin (item a item ou em lote deliberado); ou (2) mudar o importador para publicar por padrão também em produção, aceitando o catálogo do ERP como fonte de verdade sem revisão prévia individual. Até essa decisão, `npm run db:import-catalog` em qualquer ambiente (inclusive produção) continua respeitando `published=false` por padrão — o UPDATE em massa de hoje foi um ato manual pontual no banco local, não uma mudança de código.

## 2026-08-12 — Hero com vídeo institucional (YouTube nocookie) + nav uniforme sem ícones (padrão WEG)
**Decisão**: (1) A primeira dobra da home passa a usar o **vídeo institucional da ROCO**
(https://www.youtube.com/watch?v=rqn-okkh0ww) como fundo full-bleed em cover, via embed
`youtube-nocookie.com` (autoplay mudo, loop, sem controles, `playsinline`, `pointer-events: none`),
com pôster (`hero-stage.jpg` esmaecido) atrás e conteúdo vivo CENTRALIZADO (eyebrow + headline +
parágrafo + 2 CTAs `.btn-neon`) — um único layout para todos os breakpoints, padrão WEG. Os hotspots
sobre os botões "assados" no render (`CtaHotspot` + `POS` medidos do .psd) foram aposentados.
(2) A CSP ganha `frame-src https://www.youtube-nocookie.com` — enquadrar ≠ executar script na nossa
origem; `script-src 'self'` segue intacto (garantia pós-ClickFix). (3) Os itens da nav perdem os
ícones lucide (PhoneCall/Headset/Package) e os text-glows: rótulos uniformes em caixa alta, tracking
constante, todos brancos; o único diferencial do item ativo é o tom ciano da marca.
**Alternativas**: (a) MP4 self-hosted em `public/videos/` — preferível a prazo (sem terceiro, sem
tracking), mas o arquivo não existe no repo e baixar do YouTube viola o ToS mesmo sendo dono do
conteúdo; pedido do stakeholder foi explícito: "por hora vamos usar o vídeo institucional" via
YouTube. (b) embed `youtube.com` padrão — mais cookies/tracking que o modo privacidade-avançada.
(c) manter o render estático — não atende "bem parecida com a da WEG". (d) manter ícones na nav —
stakeholder reportou desalinhamento por conta deles ("hoje estão desalinhados por conta dos ícones").
**Justificativa**: Pedido explícito do stakeholder (2026-08-12): "primeira seção bem parecida com a
da WEG… vamos usar o vídeo institucional… site altamente harmônico… mesmas configurações para os
itens do menu". O embed nocookie minimiza tracking (LGPD) e mantém a CSP de script intocada.
**Impacto**: `home-hero.tsx` reescrito (um layout, CTAs reais); `hero-layout.ts` só com as variants
de animação; `cta-hotspot.tsx`, `.hero-board` e `.icon-glow-*` removidos (histórico no git);
`navLabelClass` uniformizada (testes atualizados); `next.config.ts` frame-src. **Follow-ups**:
substituir o embed por MP4 self-hosted quando o stakeholder fornecer o arquivo (remove o terceiro da
CSP e o playerzinho do YouTube em conexões lentas); avaliar `prefers-reduced-motion` (pôster já cobre
autoplay bloqueado). O campo `icon` segue nos dicionários/`NavLink` (ignorado) para não quebrar copy.

## 2026-08-23 — Vitrine de categorias da home fiel ao PSD (6 macro-famílias com arte extraída do composite)
**Decisão**: A vitrine de categorias da home deixa de ser um grid data-driven das 16 categorias de
topo do ERP (ícones lucide genéricos) e passa a reproduzir o design do PSD
`docs/Layout pag Produtos_OK_01.psd`: 6 cards verticais (aspect ~45:82) com moldura neon em
gradiente ciano→âmbar (`.card-neon` no globals.css, `color-mix` sobre os tokens da marca), arte
line-art neon de produto no miolo e rótulo vivo em caixa alta (`.card-neon-label`). As artes foram
RECORTADAS do composite achatado do PSD (a cena é um render 3D em camada única — ilustrações não
separáveis, mesmo caso do hero de 2026-07-13): medição das molduras por perfil de luminância
(tubos = runs contínuos verticais; molduras têm linha dupla em algumas bordas e leve perspectiva),
recorte do interior SEM a moldura e patch do rótulo assado (faixa limpa do próprio interior com
feather) → 6 JPEGs q90 (~400×770, 37–77 KB) em `public/images/home/categorias/`. Os 6 cards são
MACRO-FAMÍLIAS de marketing (Hidrossanitários, Hidráulica, Reparos, Conexões, Gás, Flexíveis) — não
categorias do ERP; o mapa card→destino vive nos dicionários (`home.categories.items[].href`):
conexões/gás/flexíveis têm categoria exata (39/130/83 produtos), hidrossanitários→caixa-acoplada
(43, a arte É a válvula de caixa acoplada), hidráulica→hidro-latao (31), reparos→`?search=reparo`
(173, cobre mvs-reparo + outros-reparo; `search=` é o parâmetro real da listagem). Helper puro
`resolveCategoryCardHref` (`src/modules/home/lib/category-cards.ts`, 6 testes) valida `?category=`
contra os slugs reais e degrada para `/produtos` se a categoria sumir do catálogo.
**Alternativas**: (a) manter grid data-driven e só embelezar — não atende "fiel ao PSD" (pedido
explícito do stakeholder 2026-08-23); (b) usar o card inteiro assado (com moldura e rótulo) como
imagem — rótulo PT assado quebraria o EN e a moldura raster não teria hover/estados; (c) recriar as
ilustrações em SVG — infiel ao render 3D com glow.
**Impacto**: `home-categories.tsx` reescrito (sem lucide/PublicCategory; prop nova `categorySlugs`);
página home passa `categoryList.map(c => c.slug)`; dicionários +24 chaves por locale
(`home.categories.items`). As 16 categorias reais continuam expostas no filtro de `/produtos`.
Se o catálogo ganhar novas famílias com arte no PSD, extrair novo asset e adicionar item no
dicionário (pipeline documentado no script da sessão; ver activeContext).

## 2026-08-23 — Selo GPTW oficial no rodapé (arte licenciada com vigência)
**Decisão**: O badge textual de certificação no rodapé (Award + texto, 2026-08-12) é substituído
pela ARTE OFICIAL do selo GPTW fornecida pelo stakeholder ("Certificada FEV 2026 – FEV 2027,
Brasil"): fundo claro removido por flood-fill a partir das bordas (tolerância 30 sobre a cor dos
cantos) → PNG transparente aparado (382×640, ~113 KB) em
`public/images/certifications/gptw-certificada-2026-2027.png`; original de referência preservado em
`docs/selo-gptw-fev2026-fev2027.jpeg`. O rodapé renderiza o selo via `next/image` (h-16) dentro do
card glassy existente, com label + vigência ao lado; itens de `footer.certifications.items` sem
`image` caem no ícone Award (fallback preservado para selos futuros sem arte).
**Alternativas**: (a) JPEG original com fundo claro — retângulo branco destoante no rodapé dark;
(b) tile branco atrás do selo — mais "seguro" de brand guideline, porém visualmente pesado no tema
neon; o selo colorido sobre o card glassy mantém contraste (topo vermelho + texto branco legíveis).
**Impacto**: Risco de compliance CDC do claim GPTW RESOLVIDO (prova com vigência); nome do arquivo
carrega a vigência para forçar revisão na renovação (fev/2027 — substituir asset + notas dos
dicionários). Dicionários: `note` ganha vigência, campos novos `image`/`alt` por locale.

## 2026-08-23 — Carga inicial de imagens de produto: script batch 100% compatível com o fluxo do portal
**Decisão**: A primeira carga das fotos de produto (`docs/PRODUTOS/`, ~745 imagens nomeadas por SKU,
não versionadas) sobe por um script batch novo — `npm run db:import-images`
(`src/db/import/import-product-images.ts`, padrão do `import-catalog`: fora do bundler, clients
Drizzle/S3 próprios, carrega `.env.local`/`.env` sozinho) — que reproduz EXATAMENTE o contrato do
fluxo presign/confirm do portal: chave `products/{sku}/{uuid}.{ext}` (mesma validação de prefixo do
`confirmImageUpload`), INSERT em `product_images` com contentType permitido (png/jpg/webp), teto de
10MB, `altPt`/`altEn` = nome do produto e `sortOrder` da galeria. Assim o time gerencia
(lista/adiciona/substitui/exclui) as imagens seed pelo portal como qualquer upload manual.
Matching: exato por stem === sku + fallback por prefixo numérico (≥3 dígitos) para variantes com
sufixo (`1122_v2`, `1263_01`, ...), que entram como imagens secundárias (arquivo exato = sortOrder 0,
variantes em ordem alfabética). Idempotente por (produto, filename) — re-execução não duplica nem
sobrescreve curadoria posterior do time. Dry-run: 613 imagens → 593 produtos (19 variantes);
132 arquivos sem produto no catálogo atual (faixas 1906–1919, 2237–2280, 3068–3179 ausentes do
import de 2026-08) + 11 com nome livre (BLISTER, CAIXA, Cunha_*, ...) para mapear manualmente.
**Alternativas**: (a) subir via UI do portal (593 produtos × presign manual — inviável); (b) INSERT
com chave própria (ex.: `seed/{sku}.png`) — quebraria a validação de prefixo do confirm e a
exclusão/substituição pelo portal; (c) exigir mapeamento manual dos 132 não casados antes da carga —
atrasa o go-live do acervo; ficam para segunda rodada.
**Impacto**: Comando novo `db:import-images` (package.json); envs R2 reais em `.env.local`/`.env`
(gitignored — bucket `roco-test`). **BLOQUEIO no ato**: as credenciais fornecidas autenticam mas
retornam 403 AccessDenied em TODAS as operações (put/head/list/listBuckets, endpoints padrão e EU) —
token da API R2 sem permissão "Object Read & Write" no bucket, escopo em outro bucket, ou bucket
inexistente. Aguardando correção do token pelo stakeholder; o script roda com um comando depois.
**Pendências ligadas**: `R2_PUBLIC_URL` (habilitar acesso público r2.dev ou domínio custom no
bucket) para o SITE exibir as fotos — entra na CSP `img-src` e no `images.remotePatterns`
(build-arg do Docker); sem ela as páginas caem no placeholder "sem foto" por design.

## 2026-08-23 — Hero slideshow admin (slides configuráveis no /portal/hero)
**Decisão**: A 1ª seção do site sai do hero hard-coded e vira uma coleção
ordenada de slides, cada um com mídia (YouTube OU upload para R2), copy
bilíngue (PT/EN), CTAs, janela de loop opcional, auto-advance opcional,
muted obrigatório para autoplay, agendamento (starts_at/ends_at) e ordem
configurável — gerenciada pelo admin do portal em `/{locale}/portal/hero`.
**Alternativas**: (a) continuar hard-coded no componente (vai contra o
pedido explícito do stakeholder de "configurável por marketing"); (b) usar
JSON estático em `public/config` (só devs editam, sem curadoria); (c)
Contentful/Sanity externo (overkill para 1 seção + acoplamento SaaS).
**Justificativa**: O stakeholder pediu explicitamente "quantos slides for
possível / aceitável" e "configurar até em que parte o vídeo ficará em loop".
A solução precisa de (1) banco (persistência), (2) admin (UX de edição) e
(3) cache (perf). Uma tabela dedicada `hero_slides` cobre os três com
~30 colunas e cache tag "hero" revalidada por mutação.
**Impacto**: Tabela `hero_slides` (migration 0003) + tabela genérica
`site_settings` (migration 0004, abriga `catalog.pdf-url` e futuras
configurações). tRPC `heroSlides` (list/create/update/reorder/delete/presign/
confirm). Admin `/portal/hero` com reorder + dialog tabs. Refatoração do
`home-hero.tsx` para usar `getCachedActiveHeroSlides(locale)` + novo
`HeroSlider` (auto-advance + crossfade + pause-on-hover + indicadores).
`/catalogo` virou direct download (lê `getCatalogPdfUrl()` com fallback DB→env→constante).

## 2026-08-23 — Mautic sai, RD Station entra
**Decisão**: Tracking de marketing migrado do Mautic (que ficou self-hosted
após o incidente ClickFix em 2026-07) para o RD Station, plataforma
anterior que o stakeholder está voltando a usar. Stub desativado por
padrão (`NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED=false`); liga via env quando
as URLs/IDs do RD forem fornecidos.
**Alternativas**: (a) manter Mautic (cripto-vendor sem auditoria recente);
(b) Google Analytics 4 (grátis, mas sem lead scoring integrado); (c) sem
tracking até o jurídico aprovar base legal (perde a atribuição de lead).
**Justificativa**: O stakeholder decidiu voltar ao RD Station em 2026-08-23;
o Mautic foi o plano B técnico após o ClickFix e não tem mais razão de ser.
O RD Station carrega de `/vendor/rdstation.js` self-hosted (mesmo padrão
do antigo `mtc-tracking.js`), mantendo `script-src 'self'` intacto.
**Impacto**: 11 arquivos removidos (componentes Mautic + scripts + helpers
de form/SDK). `next.config.ts` tira `mautic.roco.com.br` de todas as
diretivas CSP (mantém `youtube-nocookie.com` porque o admin pode criar
slide YouTube no carrossel). Stub `RdStationTracking` + flag
`NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED`. Items "contato" da nav viraram
links para `/contato` (página a criar). Banner LGPD stub
(`ConsentBanner` + flag `NEXT_PUBLIC_CONSENT_ENABLED`).

## 2026-08-23 — Sidebar colapsável do portal (persistido por usuário)
**Decisão**: Drawer lateral do `/portal/*` ganha botão de recolher/expandir
no AppBar (só visível em md+; mobile segue com hambúrguer). Estado
persistido por usuário em `localStorage` (`portal_sidebar_collapsed`),
sobrevive a refresh e troca de aba. Largura: 260px expandido, 72px
recolhido.
**Alternativas**: (a) sempre expandido (não atende ao pedido de "menu
lateral colapsável"); (b) collapsed-by-default (atrapalha quem usa 1
item só); (c) per-session em cookie (sobrevive mas exige SSR). Decidi
localStorage: UX consistente entre sessões e SSR-safe via lazy
`useState(() => …)` que evita hydration mismatch e o flash do drawer
expandido.
**Impacto**: `src/modules/portal/components/portal-shell.tsx` ganha estado
+ efeito de persistência. Constantes `DRAWER_COLLAPSED_WIDTH=72` e
`SIDEBAR_COLLAPSE_STORAGE_KEY`. Inicialização lazy em `useState(() => …)`
para cumprir `react-hooks/set-state-in-effect`. Chevron toggle via MUI
`Tooltip` no AppBar (`xs:hidden md:inline-flex`).

## 2026-08-23 — Hardening de segurança (rate-limit fail-closed + proxy.ts exact-match)
**Decisão**: Dois ajustes cirúrgicos em pontos que viraram incidente real
no checklist de 2026-08-12: (1) `checkRateLimit` ganha flag `productionSafe`
nas `RateLimitOptions`; quando `true`, sem Redis o request é NEGADO
(503) em vez de liberado — a escolha de disponibilidade do fail-open
continua válida para `products.list` e `presignImageUpload`, mas rotas de
auth (login/register/webhook) DEVEM passar `productionSafe: true`; (2) `proxy.ts`
troca `pathname.includes("/api")` (substring match, abria buraco para qualquer
path futuro como `/portal/api-docs`) por `pathname.split("/")[1] === "api"`
(match exato de segmento).
**Alternativas**: (a) exigir Redis em produção via guard de boot (fail
loud, mas exige Redis disponível antes do primeiro deploy); (b) Circuit
Breaker que libera quando Redis recupera (overhead, 2 endpoints com
auth não justifica); (c) para o proxy: lista de allowlist de paths
explícita (menos robusto que match de segmento — esquece um e cria
o mesmo buraco).
**Justificativa**: Trade-off explícito disponibilidade vs segurança.
Auth routes NUNCA podem operar sem rate-limit em produção; rota de
produto pode tolerar 5min sem proteção durante deploy. O bug do
proxy é latente (nenhum path bate hoje, mas a primeira página
`/portal/api-docs` nasceria pública silenciosamente).
**Impacto**: `src/server/lib/rate-limit.ts` (assinatura nova, 3 callers
afetados — auth/register/webhook precisam passar `productionSafe: true`
em um commit de hardening de chamadas; este fica aberto como follow-up).
`proxy.ts` linha do gate de sessão. Não muda CSP nem auth.

## 2026-08-23 — Tabela `site_settings` (configurações genéricas chave-valor)
**Decisão**: Tabela `site_settings(key, value jsonb, type, description,
is_public, updated_by, updated_at)` para configurações 1-por-site que
não cabem em env (editáveis pelo admin sem deploy). Primeira chave
usada: `catalog.pdf-url` — o link do PDF de catálogo exibido na landing
`/catalogo`, hoje em `NEXT_PUBLIC_CATALOG_PDF_URL`. O getter
`getCatalogPdfUrl()` lê em camadas: DB → env → constante.
**Alternativas**: (a) colunas dedicadas em `hero_slides` ou nova tabela
por config (inviável para N configs futuras); (b) JSON estático em
`public/config` (só devs editam); (c) feature flags no Redis
(acoplamento operacional desnecessário para um link de PDF).
**Justificativa**: O stakeholder pediu "link configurável pelo admin tb"
para o botão de catálogo. Padrão 1-por-site com `jsonb` cobre o caso
atual (string) e abre para tipos futuros (number, boolean, json) sem
migrations. `is_public = true` é o filtro de UI (admin só expõe chaves
públicas); flags internas continuam por env.
**Impacto**: Migration 0004 + tRPC `siteSettings` (list/set) + helper
`getCachedReadSetting(key)` (cache tag "site-settings", 60s).

## 2026-08-24 — Upload de mídia do hero (sem digitar chaves R2 à mão)
**Decisão**: Trocar os campos de texto cru onde o admin digitava a `r2Key`/`r2PosterKey` do slide
do hero à mão (`src/modules/portal/components/hero/hero-form-dialog.tsx`) por um componente de
upload genérico e reutilizável (`PortalFileUploader`, em `src/modules/portal/components/shared/`)
com seleção de arquivo, barra de progresso e preview — nunca expondo a chave do bucket ao usuário.
Corrigido também um bug real descoberto no backend: `presignUpload`/`confirmUpload` em
`src/server/trpc/routers/hero-slides.ts` só aceitavam tipos de vídeo (`ALLOWED_VIDEO_TYPES`)
mesmo quando o upload era do campo de **pôster** (que deveria aceitar imagem) — passam a existir
`ALLOWED_POSTER_TYPES`/`MAX_POSTER_BYTES` distintos de `ALLOWED_VIDEO_TYPES`/`MAX_VIDEO_BYTES`,
com o limite de tamanho aplicado conforme o tipo do campo (`poster: boolean` no input).
**Alternativas**: (a) manter o `<TextField>` cru — rejeitado, é exatamente a dor relatada pelo
stakeholder ("ninguém vai conhecer a estrutura do bucket"); (b) aceitar qualquer `contentType` sem
diferenciar vídeo de pôster — rejeitado, mantinha o bug de validação e abria a porta para upload
de tipo errado.
**Justificativa**: Pedido explícito do stakeholder.
**Impacto**: Novo componente compartilhado `PortalFileUploader` (usado também pelos materiais do
representante, ver Entrada 2, e pelo campo `uploadFileDirect` de `src/modules/portal/lib/upload-file.ts`
ganha suporte a progresso via XHR). `hero-slides.ts` ganha `ALLOWED_POSTER_TYPES`/`MAX_POSTER_BYTES`.
Nenhuma migration nova.

## 2026-08-24 — Materiais dinâmicos para representantes (linha do tempo, upload obrigatório)
**Decisão**: Nova tabela `materials` (migration `drizzle/0006_materials.sql`, schema
`src/db/schema/materials.ts`) para os materiais de apoio compartilhados com representantes. Campos:
título/descrição bilíngue (pt/en), categoria (texto livre orientado por opções sugeridas no
dicionário: política comercial, logística, contatos, treinamento, outro), `r2Key` **NOT NULL**
(upload é obrigatório — nunca se aceita URL externa colada), `published`/`publishedAt` (a ordenação
do feed é por `publishedAt DESC` — a "lógica de linha do tempo" pedida pelo stakeholder), autoria e
timestamps. Os arquivos são armazenados como **privados** (URL de leitura via
`getPresignedDownloadUrl`, gerada sob demanda a cada consulta — mesmo padrão já usado para os
documentos de onboarding de representante desde 2026-08-09), diferente do `R2_PUBLIC_URL` usado para
produtos/hero: material de vendas não deve ficar publicamente indexável/acessível sem login. CRUD
administrativo em nova rota `/portal/materiais` (permissões novas `materials:{create,read,update,delete}`
no seed), com o item de navegação "Materiais" liberado só para quem tem `materials:create` — assim o
representante (que ganha `materials:read` para poder consultar o feed) nunca cai na tela de CRUD
administrativa. O feed somente-leitura do representante fica embutido na página já existente
`/portal/boas-vindas` (novo componente `WelcomeMaterialsFeed`), **substituindo** os 4 cards estáticos
com CTA desabilitado "Em breve" que existiam ali para Contatos, Política Comercial, Logística e
Biblioteca de vídeos (`welcome.contacts`/`welcome.commercialPolicy`/`welcome.logistics`/`welcome.library`
saem do dicionário — eram promessas sem asset real), e removendo também o botão de CTA (igualmente
desabilitado) do card do Sistema DW — o vídeo do Sistema DW passa a ser só mais um item publicável
no feed de materiais, como qualquer outro. O card "Conheça a ROCO" (`welcome.about`, sem CTA) e o
card do Catálogo (`welcome.catalog`, que já baixa um PDF real de `public/downloads/`) NÃO são
tocados — não são "materiais sem asset", continuam como estavam.
**Alternativas**: (a) permitir colar uma URL externa em vez de upload — **rejeitado explicitamente
pelo stakeholder** ("tudo que é compartilhado com o representante deve ser upado"); (b) segmentar
materiais por representante individual (targeting) — fora do escopo pedido (o pedido é broadcast
para todos os representantes cadastrados); (c) reaproveitar o `R2_PUBLIC_URL` (mesmo padrão de
produtos/hero) — rejeitado, material comercial não deveria ficar acessível publicamente sem login.
**Justificativa**: Pedido explícito do stakeholder.
**Impacto**: Migration `0006_materials.sql` (primeira migration desde a `0005`); router tRPC novo
`src/server/trpc/routers/materials.ts`; `seed.ts` ganha as 4 permissões novas + `representative`
ganha `materials:read` + `sales_manager` ganha `materials:{create,read,update}` (mesma régua já
aplicada a `hero_slides` — sem delete); `nav-items.ts` e `portal-shell.tsx` (`PortalNavKey`) ganham
a chave `materials`; a página de boas-vindas perde 4 seções hardcoded. **Nota operacional**: como o
seed não roda automaticamente no boot (só migrations rodam via `scripts/migrate.mjs`), depois do
deploy é preciso rodar `npm run db:seed` (ou `npm run db:bootstrap-producao -- --so=seed`) em cada
ambiente (hoje `roco-test`; no futuro produção) para as novas permissões existirem de fato.

## 2026-08-24 — Perfis e permissões dinâmicos (roles editáveis, catálogo de permissões continua seed)
**Decisão**: O catálogo de PERMISSÕES (pares `resource:action`, tabela `permissions`) **continua
seed/código** — cada permissão corresponde a uma checagem `permissionProcedure(resource, action)`
hardcoded em algum router tRPC; criar uma permissão nova pela UI não teria nenhum efeito real,
porque nenhum código a verificaria. O que se torna **dado editável** pelo admin, numa nova tela
`/portal/perfis`, é: (1) **ROLES/"perfis"** — criar perfis customizados, editar nome/descrição
(não é permitido reaproveitar tabelas novas: reaproveita-se `roles`/`role_permissions`/`user_roles`,
já existentes desde 2026-08-09 — **nenhuma migration nova** para esta parte); (2) a **matriz
`role_permissions`** de qualquer perfil, inclusive os 4 perfis de sistema (`sales_manager`/
`representative`/`viewer`) — **exceto** `admin`, cuja matriz fica travada/somente-leitura na UI
porque `admin` tem bypass total hardcoded em `hasPermission()` (`src/core/auth/rbac.ts`) e `can()`
(`src/modules/portal/lib/permissions.ts`): editar a matriz do `admin` não mudaria nada, então a UI
nem oferece; (3) atribuição de perfis a usuários (`user_roles`), numa aba "Usuários" com busca.
O **slug** de qualquer perfil (de sistema ou customizado) é **imutável após a criação** — em
especial os 4 slugs de sistema (`admin`, `sales_manager`, `representative`, `viewer`) são literais
de string referenciados fora da tabela de permissões em vários pontos do código (`ADMIN_ROLE_SLUG`
em `rbac.ts`, `REPRESENTATIVE_ROLE_SLUG`/`STAFF_ROLE_SLUGS` em `permissions.ts`,
`INTERNAL_DEFAULT_ROLE`/`EXTERNAL_DEFAULT_ROLE` em `auth/index.ts`, `ADMIN_ONLY_ROLES` em
`proxy.ts`) — renomear um desses quebraria essa lógica silenciosamente. Perfis de sistema não podem
ser excluídos; perfis customizados só podem ser excluídos se não tiverem nenhum usuário atribuído.

Cinco guardas de segurança, implementadas como **funções puras testáveis** em
`src/server/lib/roles-guards.ts` (sem tocar banco — usadas pelo router tRPC): (a) bloquear exclusão
de perfil de sistema ou de perfil com usuários atribuídos; (b) bloquear edição da matriz de
permissões do perfil `admin`; (c) **autolockout**: se quem está editando NÃO tem a role `admin` e o
perfil que está editando é (um) dos seus próprios perfis, e a nova matriz removeria a permissão
`roles:manage` desse perfil, a mutação é bloqueada (evita o admin-delegado se trancar para fora da
própria tela); (d) **último admin**: remover a role `admin` de um usuário é bloqueado se isso
zerasse a contagem de usuários ATIVOS com a role `admin` no sistema; (e) **anti-escalonamento de
privilégio**: conceder a role `admin` a um usuário exige que quem está concedendo JÁ seja `admin` —
não basta ter a permissão genérica `roles:manage` delegada, impedindo que um perfil customizado com
`roles:manage` (mas sem ser admin) crie novos admins por conta própria.
**Alternativas**: (a) permissões totalmente dinâmicas (criar par `resource:action` novo pela UI) —
rejeitado, seria uma permissão "fantasma" sem checagem real em código nenhum; (b) travar também a
matriz dos 3 perfis de sistema não-admin — rejeitado, contraria o pedido explícito do stakeholder
de aplicar permissões "dinamicamente", que inclui recalibrar o que `sales_manager`/`representative`/
`viewer` podem fazer; (c) não implementar guardas de autolockout/último-admin/anti-escalonamento —
rejeitado, é exatamente o cenário clássico de "portal RBAC que ninguém mais consegue administrar"
ou "usuário comum vira admin por engano/abuso", citado como risco explícito no brief desta tarefa.
**Justificativa**: Pedido explícito do stakeholder; risco de auto-lockout e de escalonamento de
privilégio são reais e documentados nesta mesma sessão.
**Impacto**: Nenhuma migration nova (reaproveita `roles`/`permissions`/`role_permissions`/`user_roles`
do RBAC seed desde 2026-08-09). Router tRPC novo `src/server/trpc/routers/roles.ts`; helpers puros
`src/server/lib/roles-guards.ts` (alvo direto de testes unitários de borda). Nova permissão
`roles:manage` no catálogo do seed (só `admin` a recebe por padrão — um admin real pode delegá-la
a um perfil customizado depois, e as guardas (d)/(e) continuam valendo a partir daí). Nova rota
`/portal/perfis`, nova chave de nav `roles`. A revalidação de sessão via JWT já existente (staleness
de 5 min, decisionLog 2026-08-09) propaga mudanças de perfil/permissão automaticamente — nenhum
mecanismo novo de invalidação de sessão foi necessário. **Nota operacional**: mesma observação da
Entrada 2 — a permissão `roles:manage` só existe depois de rodar `npm run db:seed` em cada
ambiente após o deploy.

