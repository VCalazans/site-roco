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

## 2026-08-24 — Integração RD Station via Conversions API (formulário de contato)
**Decisão**: Página `/contato` envia leads ao RD Station via `POST https://api.rd.services/platform/conversions`
usando a Conversions API (não-OAuth, API Key estática em env `RD_STATION_API_KEY` server-only).
Autenticação: header `Authorization: Bearer <KEY>` — padrão recomendado pelo RD para integrações
internas. Rate limit RD: 120 req/min (irrelevante no volume da ROCO). Sem SDK (pacote abandonado);
implementação via `fetch` nativo + `zod`, padrão já usado em `representative-register.ts`.
Payload: `{ event_type: "CONVERSION", event_family: "CDP", payload: { conversion_identifier,
name, email, personal_phone, company_name, cf_cnpj, cf_produto_interesse, client_tracking_id,
legal_bases } }`. Sucesso = 200 com `event_uuid`; erro validação = 400 com array `errors`.
Campos customizados `cf_cnpj` e `cf_produto_interesse` precisam ser criados UMA VEZ à mão pelo
stakeholder no painel do RD (pesquisa anterior descartou auto-criação via API — caminho seguro).
`conversion_identifier` = `orcamento_produto` quando assunto é "Solicite um orçamento", ou
`contato_geral` para demais. Gera `client_tracking_id` (UUID) no backend a cada submissão
(deduplication nossa — API do RD não é idempotente). Produto opcionalmente resolvido servidor-side
a partir do slug (via `getPublicProductBySlug`, nunca aceito cru do cliente — previne injeção de
texto arbitrário no payload RD).
**Alternativas**: (a) webhook direto ao RD sem fila — perde lead em falha de rede; (b) Zapier/Make —
vendor lock-in + custo variável; (c) ignorar o RD nesta feature e usar só e-mail — rejeita requisito
explícito de integração ao CRM.
**Justificativa**: RD Station é o CRM da ROCO (stakeholder voltou a usar em 2026-08-23); Conversions API
é o contrato padrão da plataforma para eventos de lead. O INSERT em `contact_submissions` (ver entrada 7)
acontecer ANTES do envio garante que falha de rede não perde o lead — não há fila, envio é síncrono.
**Impacto**: Env `RD_STATION_API_KEY` (server-only); novo módulo `src/server/lib/rd-station.ts`
(schema puro testável, similar a `representative-register.ts`); rota `POST /api/contact` (Route Handler).
Não afeta CSP (apenas HTTP POST, sem externa).

## 2026-08-24 — Provedor de e-mail transacional: Resend via fetch nativo
**Decisão**: Formulário `/contato` dispara notificação de e-mail via Resend (`https://api.resend.com/emails`,
header `Authorization: Bearer RESEND_API_KEY`) — fetch nativo, sem novo SDK (padrão "fetch + zod"
já consolidado em representative-register.ts e RD Station). Resend é stateless, sem refresh token,
sem estado de sessão no banco.
Alternativas descartadas: (a) Nodemailer + SMTP — descobre/gerencia credenciais SMTP (operação
penosa, dependência de terceiro desconhecido), TLS/conexão persistente (overhead em serverless);
(b) AWS SES — exigiria credenciais AWS SEPARADAS das do R2 (Cloudflare), verificação de domínio,
saída de sandbox (dias) — mais fricção no go-live que Resend estateless.
Envs novas: `RESEND_API_KEY` (server-only), `CONTACT_FROM_EMAIL` (remetente verificado no painel
Resend), `CONTACT_NOTIFICATION_EMAIL` (destino do time comercial — fallback no código para
`NEXT_PUBLIC_CONTACT_EMAIL` se vazio). Domínio verificado pelo stakeholder antes do go-live
(ex.: `mail.roco.com.br` ou `roco.com.br`).
Padrão de robustez: sem credencial, a função loga WARN e retorna "skipped" (nunca lança). Lead já
foi gravado no banco (Entrada 7) — e-mail é best-effort, falha não apaga contato. Envio acontece
no mesmo request, via `Promise.allSettled` com timeout de 8s (não há fila).
**Alternativas**: (a) sem e-mail (só aviso no dashboard do portal) — perde noção de lead em tempo
real; (b) Mailgun/SendGrid — mais setup, curva operacional equivalente.
**Justificativa**: Stakeholder pediu "notificação de contato" + "best-effort"; Resend combina
simplicidade (stateless, sem gerência de conexão) com confiabilidade (Resend é especialista em
transacional, uptime 99.99%, integração Next.js idiomática).
**Impacto**: Env vars `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_NOTIFICATION_EMAIL`;
novo módulo `src/server/lib/contact-email.ts` (schema puro). Não afeta CSP.

## 2026-08-24 — Consolidação do menu (4 itens) + correção do bug de locale em `/contato`
**Decisão**: Menu público **sai de 6 para 4 itens**: Home, Produtos, Portal ROCO, Contato. As 3 intenções
que hoje ocupam 3 linhas do menu ("Ligamos pra você" / "Solicite um orçamento" / contato geral) viram
opções de **dropdown `subject`** dentro do form da página `/contato` (enum: `call_back | quote | general`).
Hoje `navigation.links` usa `isContactLink()` em `src/shared/lib/nav.ts` que renderiza
`<Link href="/contato">` **sem prefixo de locale** — resquício de 2026-07-13 quando o link abria um
modal (removido em 2026-08-23). A correção: `src/core/config/site.ts` ganha `CONTACT_SEGMENT = "contato"`,
`contactPath(locale)` e novo `case "#contato": return contactPath(locale);` em `resolveDestination()`.
Isso torna `isContactLink()` em nav-items.tsx/footer-link.tsx **obsoleta** (removida) — item "Contato"
passa a se comportar como qualquer outro link de nav (fica "ativo" quando a pessoa está em
`/{locale}/contato` — bug atual que nunca acontecia porque o item sempre renderizava sem prefix).
**Alternativas**: (a) manter 6 itens com destinos diferentes — não atende ao pedido explícito "consolidar
o menu"; (b) resolver o bug do locale SÓ em nav-items.tsx — deixaria a lacuna abrir de novo no footer
via footer-link.tsx ou em futura página que use `#contato`, já que o padrão `resolveDestination()` é o
lugar lógico/central para essa lógica.
**Justificativa**: Simplificar navegação (menos visual clutter); centralizar resolve destino como já feito
para `#produtos`/`#representantes` em 2026-07-19.
**Impacto**: `src/i18n/dictionaries/{pt,en}.json` — `navigation.links` reduzido (4 items com `label` +
`href="#contato"` mapeado via `resolveDestination`); `src/core/config/site.ts` ganha `contactPath()`;
`src/shared/lib/nav.ts` remove `isContactLink()`; `src/shared/components/nav/nav-items.tsx` e
`src/shared/components/footer/footer-link.tsx` usam `resolveDestination()` na rota comum, sem
especialização; `src/app/sitemap.ts` ganha entrada `/contato`. Testes de `resolveDestination()` ganham
case `#contato`.

## 2026-08-24 — Nova tabela `contact_submissions` (migration 0007): lead gravado ANTES de qualquer canal
**Decisão**: Tabela `contact_submissions(id, uuid client_tracking_id UNIQUE, name, email, phone,
company_name, cnpj, subject, product_slug, product_name_at_submit, consent_granted BOOLEAN,
consent_at, rd_station_status, rd_station_error, email_status, email_error, ip_address, submitted_at,
updated_at)` — grava o lead da página `/contato` **ANTES** de disparar RD Station ou Resend. Status por
canal (`rd_station_status`: pending/sent/failed/skipped; idem `email_status`) com mensagens de erro para
diagnóstico. `client_tracking_id` = UUID gerado no backend a cada submissão (coluna UNIQUE, nossa chave
de dedupe já que a API do RD não é idempotente). Produto resolvido servidor-side a partir do slug
(via `getPublicProductBySlug`, nunca cru do cliente — previne injeção). `consent_granted` boolean +
`consent_at` timestamp = trilha de auditoria LGPD do consentimento real que a pessoa marcou (checkbox
obrigatório no formulário `/contato`, DISTINTO do `ConsentBanner` que trata de cookies/tracking do site
como um todo — dois mecanismos por finalidade).
**Alternativas**: (a) sem persistência, só dispara RD/e-mail direto — rejeitado, falha de rede perde o
lead permanentemente; (b) reaproveitar a tabela `representatives` — rejeitado, é entidade de negócio
completamente diferente (onboarding com RBAC/aprovação/documentos vs lead transiente de contato).
**Justificativa**: Requisito explícito do pedido ("lead sempre gravado primeiro, canais são best-effort").
**Impacto**: Migration `drizzle/0007_contact_submissions.sql` (executada automaticamente no boot via
`scripts/migrate.mjs`). `src/db/schema/contact.ts` novo. Função de inserção + schema zod em
`src/server/lib/contact-submit.ts` (testável, similar a `representative-register.ts`). Rota `POST /api/contact`
(Route Handler) que (1) insere o lead, (2) dispara os dois canais em paralelo via `Promise.allSettled`, (3)
retorna `201 { ok: true }` ao visitante assim que o INSERT tenha funcionado, independente do resultado
dos canais (ver entrada 8 para detalhe de fluxo síncrono).

## 2026-08-24 — Correção: envio de contato é síncrono na própria requisição, sem fila
**Decisão**: Uma entrada anterior deste mesmo dia registrou por engano uma arquitetura de fila BullMQ
para o envio ao RD Station/e-mail — NUNCA foi decidida e é revertida aqui antes de qualquer
implementação a partir dela. O fluxo real: `POST /api/contact` (Route Handler comum, não tRPC) grava
o lead em `contact_submissions` de forma síncrona; só então dispara `Promise.allSettled` com os dois
canais (RD Station, Resend) em paralelo, cada um com timeout de 8s (via `AbortSignal.timeout(8000)`) e
sem lançar exceção; atualiza a linha com o resultado de cada canal (`rd_station_status`/`email_status`
+ erro se houver); responde ao visitante `201 { ok: true }` uma vez que o INSERT tenha funcionado,
independente do resultado dos canais (ambos são best-effort).
**Justificativa**: O app roda como processo Node persistente (standalone/Docker), não serverless —
esperar ~8s dentro da própria requisição é aceitável para um formulário público de baixo volume;
BullMQ/Redis faz sentido para o `erp-sync` (webhook de alto volume, terceiro), não aqui. Menos
infraestrutura para o mesmo requisito de "lead nunca se perde": a garantia já vem do INSERT
acontecer ANTES de qualquer tentativa de envio. Falha de rede após o INSERT não apaga o contato,
e o admin pode revisar o status dos canais em `contact_submissions` — não há fila/DLQ/retry nova.
**Impacto**: Route Handler `src/app/api/contact/route.ts` com lógica síncrona (sem fila/worker/DLQ
novos). Sem mudanças em migrations ou schema — a tabela `contact_submissions` (entrada 7) e os
envs de RD/Resend (entradas 4–5) permanecem como projetados.


## 2026-08-25 — Rastreio de origem de lead (`?origem=` + UTM), 4 `conversion_identifier`, retry gracioso do RD e volta do formulário no catálogo
**Decisão**: Todo lead que chega ao RD Station passa a carregar DUAS dimensões de aquisição,
complementares e que nunca se sobrescrevem:
1. **ORIGEM** — a seção INTERNA do site de onde partiu o clique (`?origem=`, parâmetro
   `LEAD_ORIGIN_PARAM`), com **lista FECHADA** de 10 valores em `src/shared/lib/lead-origin.ts`
   (`home-hero`, `home-sobre`, `home-categorias`, `home-destaques`, `home-portal`,
   `produtos-listagem`, `produto-detalhe`, `catalogo`, `menu`, `rodape`). Valor fora da lista
   (visitante editou a URL, link antigo, bot) vira `undefined` → NULL no banco: é taxonomia
   nossa, não texto livre de terceiro. Vai ao RD no campo CUSTOMIZADO `cf_origem` —
   deliberadamente NÃO em `traffic_source`, que é território de UTM e colidiria com campanha
   paga de verdade.
2. **CAMPANHA EXTERNA (UTM)** — `utm_source`/`utm_medium`/`utm_campaign` lidos da URL, apenas
   saneados (trim, teto de 120 chars, sem CR/LF/NUL), enviados nos campos **PADRÃO**
   `traffic_source`/`traffic_medium`/`traffic_campaign` da Conversions API, que não exigem
   nenhuma configuração no painel do RD.

O ponto central de anexação é `resolveDestination(href, locale, origin)` em
`src/core/config/site.ts`: a origem só acompanha o destino quando ele é uma das DUAS páginas
internas de captura (`contactPath`/`catalogPath`) — nunca a home, a listagem de produtos ou uma
URL de terceiro vinda de `NEXT_PUBLIC_PRODUCTS_URL`/`NEXT_PUBLIC_CATALOG_URL`, onde vazaria
taxonomia interna e poderia colidir com um parâmetro do destino. `withLeadOrigin` preserva
querystring e fragmento pré-existentes (o CTA do detalhe de produto já chega como
`?produto=slug&assunto=quote`) e é idempotente (o primeiro emissor vence).

**`conversion_identifier` vai a QUATRO valores**, um por intenção de negócio:
`quote → orcamento_produto`, `catalog → download_catalogo`, `call_back → ligamos_pra_voce`,
`general → contato_geral`. Antes `call_back` e `general` colapsavam em `contato_geral`. É string
livre na API (ao contrário dos `cf_*`, não exige cadastro prévio), então separar custa zero e o
funil do RD passa a distinguir as quatro. Nada estava em produção — o RD sequer tem credencial —,
então não há histórico a preservar.

**Retry gracioso do RD** (`rd-station-send.ts`): campo customizado que ainda não existe no painel
faz a API responder 400 e a conversão INTEIRA se perde, não só aquele campo. Como
`cf_cnpj`/`cf_produto_interesse`/`cf_origem` são criados À MÃO pelo stakeholder, esquecer UM
derrubaria TODOS os leads. Num 400 que aparente ser de campo — ou que não dê para classificar
(`classifyRdStationValidationError` → `custom_field` | `unknown`) —, reenviamos UMA vez só com os
campos padrão. O desfecho fica distinguível em `contact_submissions.rd_station_error`
(`validation_retry_ok` / `validation_retry_failed`), gravado MESMO no caminho feliz: é assim que o
time descobre que falta criar um `cf_*` sem perder lead nenhum. Nome, e-mail e telefone valem mais
que os campos extras.

**Formulário volta ao catálogo**: `/{locale}/catalogo` volta a exigir dados antes de liberar o PDF
(comportamento pré-Mautic que o próprio comentário em `site.ts` ainda descrevia). Campos: nome,
e-mail, telefone, empresa (opcional), consentimento LGPD obrigatório e honeypot. Reaproveita
`POST /api/contact` com `subject: "catalog"` — rate limit, gravação e os dois canais de saída já
vivem lá, e uma rota própria seria uma segunda superfície pública para manter em dia. Tailwind
puro (`.form-neon`), como todo o route group `(site)`.

**Banco**: migration `drizzle/0008_contact_origin_utm.sql` — colunas `origin`, `utm_source`,
`utm_medium`, `utm_campaign` (text, nullable) em `contact_submissions` e o valor `catalog` somado
ao enum `contact_subject`. Aplicada limpa num banco que já tinha as 7 anteriores (journal com 9
linhas, incluindo a 0000).

**Alternativas**: (a) mandar a origem em `traffic_source` — rejeitado, sobrescreveria a campanha
real de mídia paga; (b) origem como texto livre — rejeitado, poluiria o CRM e abriria injeção de
conteúdo arbitrário no `cf_origem`; (c) rota `/api/catalog` própria para o formulário do catálogo
— rejeitado, duplicaria rate limit, honeypot e persistência; (d) manter dois
`conversion_identifier` — rejeitado, perde a intenção que o menu antes separava em itens distintos;
(e) falhar alto quando um `cf_*` não existe — rejeitado, o custo é perder 100% dos leads até
alguém notar.

**Impacto**: módulo puro novo `src/shared/lib/lead-origin.ts` (sem `server-only`, sem I/O — é
consumido por schema de servidor, resolução de destino e componentes client) com testes próprios;
`src/modules/catalog/` novo (form client + lógica pura + tipos de dicionário); `contactSchema`
ganha `origin`/`utmSource`/`utmMedium`/`utmCampaign`, todos DESCARTADOS em silêncio quando
inválidos — um parâmetro de rastreio malformado jamais pode impedir a captura de um lead real.
`LEAD_ORIGIN_LABELS` em `contact-email.ts` é um `Record` TIPADO: acrescentar origem sem dar rótulo
quebra o build, em vez de mandar slug cru ao time comercial. **Pendência do stakeholder**: criar
`cf_origem` no painel do RD, ao lado de `cf_cnpj` e `cf_produto_interesse` (documentado no
`.env.example`).

## 2026-08-25 — Achados da revisão adversarial: middleware que nunca rodou, balde global compartilhado, espelho de validação e propagação de UTM
**Decisão**: Quatro correções sobre a feature acima, mais uma quinta descoberta ao verificá-las.

**(0) `proxy.ts` sai da raiz e vai para `src/proxy.ts` — o middleware NUNCA rodou.** Descoberto na
verificação de fumaça desta sessão: `curl /contato` respondia **404** em vez do redirect para
`/pt/contato`, nenhuma resposta trazia o cookie `NEXT_LOCALE`, e
`.next/server/middleware-manifest.json` saía com `"middleware": {}`. O Next procura o proxy "no
mesmo nível de `app/`" — e aqui `app/` mora em `src/app`, então o arquivo na raiz era compilado
mas nunca registrado. Consequências que estavam vivas em produção: (a) toda URL sem prefixo de
locale dava 404 (`/contato`, `/produtos`, `/portal`); (b) a resolução de locale por
Accept-Language/cookie nunca aconteceu; (c) o guard de sessão de `/portal`/`/admin` nunca executou
— o que protegia essas rotas era só o `requireAuth()` dentro das páginas (defesa que seguiu
funcionando, e por isso o problema passou despercebido). Depois da mudança o build imprime
`ƒ Proxy (Middleware)` e o `functions-config-manifest.json` registra o matcher. Verificado:
`/contato` → 307 `/pt/contato`, `/pt/portal` → 307 login, `/pt/portal/login` → 200,
`/api/products` → 200 (o matcher segue pulando `/api`). O arquivo carrega um aviso no topo para
ninguém devolvê-lo à raiz. **Sem isso a correção (4) abaixo seria inerte** — o cookie de UTM nunca
seria gravado.

**(1) Falha NOSSA não pode confiscar o catálogo.** Enquanto `/catalogo` era um `<a download>`, uma
queda de Redis não afetava o download; com o formulário, o único caminho de UI passou a ser
`POST /api/contact`, cujos limites são `productionSafe: true` (fail-closed). Redis fora = 100% das
submissões negadas = CTA de catálogo morto em todos os pontos do site. O painel de erro do
formulário passa a exibir o link do PDF ao lado da mensagem: **perde-se o lead, nunca o download**.
É coerente com a premissa já declarada na própria página — "o gate é de MARKETING, não de acesso;
o arquivo sempre foi público" (o portal interno o linka direto em `/downloads/…`). Alternativa
rejeitada: afrouxar o `productionSafe` de `/contato`, que enfraqueceria uma rota pública de escrita
para resolver um problema do catálogo.

**(2) O balde GLOBAL passa a ser cobrado só de submissão plausível, e sobe para 200/5min.** Os dois
formulários públicos dividem a chave única `contact:global`. A checagem rodava em `Promise.all` com
a de IP e ANTES do parse, então requisição malformada, bot pego no honeypot e request JÁ barrada
por IP incrementavam o contador do mesmo jeito (o `INCR` é incondicional). Reproduzido: 41 POSTs de
corpo vazio de um único IP deixavam o balde em 41 e um lead legítimo de outro IP recebia 429 —
estourar o balde saía mais barato do que usá-lo, e o visitante lia "muitas tentativas em sequência"
sem ter tentado nada. Agora: teto por IP primeiro (é a chave que o abusador não compartilha, então
cobra qualquer request), depois honeypot e `safeParse`, e só então o teto global. Teto de 40 → 200
porque ele virou backstop de DOIS funis, um deles alvo de disparo de e-mail marketing. Verificado:
o mesmo flood de 41 deixa o balde global VAZIO e o lead legítimo responde 201.

**(3) Erro de validação vira erro POR CAMPO, e o espelho client deixa de divergir.** A rota devolve
`{ error: "validation", fields: [...] }` e o array era descartado: qualquer 400 virava "Tente
novamente em instantes" — mensagem de falha TRANSITÓRIA para um erro permanente que só o visitante
podia corrigir, sem marcar campo nenhum. Ele reenviava o mesmo valor e lia a mesma frase. Três
frentes: (a) os dois formulários passam a traduzir `fields` em erro por campo (`aria-invalid` +
`aria-describedby` já derivam desse estado), caindo num banner novo só quando o campo culpado não é
renderizado ali; (b) o regex de e-mail duplicado dá lugar ao PRÓPRIO campo do schema
(`contactSchema.shape.email`) — o espelho aproximado aceitava `joao@empresa.c` e
`user@exa_mple.com`, que o zod reprova, e `contact-submit` já estava no bundle client dos dois
formulários, então não custa nada; (c) `message` deixa de ser bloqueado por CR/LF. Esta última era
a instância de maior frequência: o campo é um `<textarea>` e apertar Enter — o gesto mais natural
ao escrever um pedido de orçamento — reprovava a submissão inteira. `CONTROL_CHARS` (CR/LF/NUL)
continua valendo para `name`/`companyName`/`productSlug`, que são interpolados no cabeçalho
`Subject` do e-mail; `message` só entra no CORPO (escapado, dentro de `<pre>`) e passa a usar
`BODY_CONTROL_CHARS` (só NUL). A fronteira está fixada em teste.

**(4) UTM persistida em cookie de primeira parte.** A UTM só era lida no `searchParams` das duas
páginas de formulário, e nada a propagava durante a navegação: `resolveDestination`/`siteNavLinks`
montam caminhos limpos e o redirect de locale descartava a querystring inteira. Na prática ela só
sobreviveria se o anúncio apontasse DIRETO para `/{locale}/contato` — o sintoma seria `traffic_*`
sempre vazio e o marketing concluindo que a integração está quebrada. Agora o middleware captura os
três parâmetros na URL de ENTRADA e grava `roco_utm` (JSON, `httpOnly`, `SameSite=Lax`, 30 dias,
sem dado pessoal); as páginas de captura leem querystring → cookie nessa ordem (`resolveLeadUtm`,
`src/server/lib/lead-utm.ts`). Último toque vence; URL sem campanha nunca apaga a anterior; cookie
corrompido ou forjado vira objeto vazio e passa pelo mesmo saneamento da querystring. O redirect de
locale passou a preservar `request.nextUrl.search` (`new URL(path, base)` descartava tudo), o que
também conserta `/contato?produto=…` sem locale. Verificado ponta a ponta: pouso em
`/pt?utm_source=google&utm_medium=cpc&utm_campaign=…` → `/pt/catalogo` SEM UTM na URL renderiza a
campanha; visitante com outra campanha vê a dele; visitante sem cookie não vê nenhuma (sem
contaminação cruzada).

**Alternativas**: para (4), `sessionStorage` num client component do layout `(site)` — rejeitado,
poria o cliente como fonte da atribuição, contrariando a doutrina declarada em `contato/page.tsx`
("o cliente nunca é a autoridade"); e propagar a UTM link a link — rejeitado, exigiria enfiar a
campanha em nav, rodapé, hero e CTAs de produto. Para (2), gravar o lead e só pular os canais
quando o teto global estoura — adiado: os dois ajustes já eliminam o lockout reproduzido.

**Impacto**: `src/proxy.ts` (movido, com aviso de localização no topo); `rate-limit.ts` ganha
`RateLimitResult.unavailable` para separar "teto estourado" (429 `rate_limited`) de "limitador fora
do ar" (503 `unavailable`) — sem isso a primeira tentativa de alguém numa janela de instabilidade
do Redis era respondida acusando-o de repetição, e o suporte investigaria a coisa errada;
`contact-submit.ts` ganha `optionalMultilineField`; dicionários ganham
`{contact,catalog}.validation.invalid` e `{contact,catalog}.errors.{validation,unavailable}` (pt/en
em paridade); `lead-origin.ts` ganha `captureUtm`/`readUtmCookie`/`serializeUtmCookie`, que dão a
`UTM_PARAMS` o consumidor de produção que faltava.

## 2026-08-25 — Capacidade: teto de query no pool, teto de corpo no webhook, flag do worker e `/api/health` (com DUAS recomendações REFUTADAS)

**Decisão**: quatro mudanças cirúrgicas de capacidade/observabilidade, derivadas de um teste de
carga real no container local, e o registro explícito de duas recomendações que foram REFUTADAS com
prova e **não devem ser implementadas** (ver seção própria abaixo — não é esquecimento).

**(1) Teto de duração de query no pool** (`src/db/index.ts`): `statement_timeout: 15_000` e
`max: 10` EXPLÍCITO (10 já é o default do `pg-pool`; está escrito para registrar a intenção). Sem o
teto o servidor roda com `statement_timeout = 0` — uma query descontrolada prende um dos 10 slots
indefinidamente. Verificado no `pg` 8.23 (`getStartupConf()` em `pg/lib/client.js`) que a opção é de
fato repassada ao servidor por conexão, e que nenhuma carga longa passa por este pool (`db:seed`,
`db:import-*`, `scripts/migrate.mjs`, `bootstrap-producao` abrem cada um o seu `new Pool`).
⚠️ **O relógio inclui espera por LOCK** — o Postgres conta do momento em que o comando chega ao
servidor. Um `INSERT` trivial parado atrás de um `ACCESS EXCLUSIVE` (um `CREATE INDEX` de migration
no boot de um container novo, com o antigo ainda servindo tráfego) morre com `57014` sem ter feito
trabalho nenhum. Por isso o único ponto que não pode perder a escrita — o `INSERT` do lead em
`POST /api/contact`, cujo `catch` responde 500 e aborta — tenta **uma** segunda vez nesse código
específico (`isStatementTimeout`, `src/server/lib/pg-error.ts`). Sem esse retry, o teto
reintroduziria por uma porta estreita a mesma falha "LEAD PERDIDO" usada para recusar o
`connectionTimeoutMillis`.

**(2) Teto de corpo no webhook do ERP** (`src/app/api/webhooks/erp/route.ts`): Route Handler não tem
limite de corpo e `request.json()` bufferiza tudo antes de qualquer validação. Agora o
`Content-Length` é checado ANTES do parse (10 MB, `checkContentLength`) e a leitura conta bytes e
aborta no teto (`readBodyTextWithLimit`) — garantia válida também quando o header mente ou não vem
(`Transfer-Encoding: chunked`). Header duplicado ("10, 20", assinatura de request smuggling) → 400.
O segredo compartilhado já era verificado ANTES, então o risco coberto é ERP mal configurado, não
atacante anônimo. **NÃO** foi posto `.max(N)` no `products`: o `jobId` é `erp-sync:YYYYMMDDHHMM`
(um job por minuto, throttle deliberado) e o BullMQ descarta em silêncio job com `jobId` existente —
forçar paginação converteria "um job grande" em PERDA SILENCIOSA da segunda página em diante.

**(3) `WORKERS_ENABLED`** (`src/core/queue/{workers-enabled,register-workers}.ts`): desliga o worker
BullMQ in-process apenas com o valor exato "false" (default LIGADO — nenhum ambiente muda por
omissão). Antes, a única forma de não subir worker era não definir `REDIS_URL`, o que também derruba
o rate limit fail-closed de `POST /api/contact` (503) — isto é, "desligar o worker" significava
"desligar a captação de leads". A flag separa as duas coisas. Serve para **isolar CPU** (o worker
processa no mesmo event loop que renderiza página); **não** para evitar "job duplicado", que não
existe (o BullMQ entrega cada job a um único worker).

**(4) `GET /api/health`** (novo): o modo de falha deste sistema é LENTIDÃO SEM ERRO, invisível sem
métrica. Sem token responde só `{ status: "ok" }` + 200; com `x-health-token` (comparado em tempo
constante pelo mesmo helper do webhook) devolve uptime, atraso do event loop, contadores do pool e
estado do worker. `waitingCount` e atraso de event loop são um ORÁCULO DE SATURAÇÃO — por isso são
autenticados. Token errado devolve a MESMA resposta de quem não mandou token (401 confirmaria que
existe segredo e viabilizaria força bruta), com aviso apenas no log do servidor (throttle de 1/min).

**Alternativas**:
- Para (1): deixar sem teto — rejeitado, uma query presa esvazia o pool; teto menor (5 s) —
  rejeitado, encosta demais no trabalho legítimo de lote (`inArray` do `assembleProducts`).
- Para (2): limitar número de itens — rejeitado pelo throttle de `jobId` acima; ler só o header e
  confiar nele — rejeitado, o cliente pode mentir.
- Para (3): exigir container de worker desde já — fora de escopo; deixar `REDIS_URL` como único
  interruptor — rejeitado, derruba a captação de leads junto.
- Para (4): métricas públicas (Prometheus aberto) — rejeitado pelo oráculo de saturação; devolver
  503 sob lentidão — rejeitado, o orquestrador mataria justamente o container ocupado, virando
  lentidão temporária em queda (e crash loop no pior caso).

**Justificativa (números medidos no teste de carga)**: site e portal são UM processo Node, UM event
loop. Renderizar página satura ~1 core: **120% de CPU com 30 requisições SSR concorrentes**, com a
home — que serve com ZERO queries, 100% cacheada — indo de **15–27 ms para p50 122 ms / p90 432 ms**,
e **nenhum erro HTTP**. O Postgres **nunca foi o gargalo**: no máximo 10 conexões, todas com
`active=0`, contra `max_connections=100`, até 500 requisições concorrentes. O endpoint mais caro é
`/_next/image` (sharp em threads nativas): **440% de CPU com 96 otimizações simultâneas** — a maior
alavanca de capacidade é **CDN na frente de `/_next/image`**, que é CONFIGURAÇÃO do stakeholder e
está fora deste pacote.

**⛔ DUAS RECOMENDAÇÕES REFUTADAS — não "consertar" isto depois achando que foi esquecimento**:
1. **`connectionTimeoutMillis` no pool.** O timeout do `pg-pool` é um `setTimeout` cru que corre no
   MESMO event loop saturado: ele dispara por CPU travada, não por pool cheio (reproduzido com o
   pool ocioso). Pior: em `POST /api/contact` o `catch` do INSERT responde 500 e aborta sem retry,
   então isso converteria "lead salvo, resposta lenta" em **LEAD PERDIDO** — e o app não tem nenhum
   `error.tsx`, então o visitante veria a tela de erro crua do Next.
2. **Subir o `max` do pool para 20/50/100.** Sem mecanismo: o banco ficou ocioso até 500
   concorrentes. Mais conexões só colocariam mais trabalho disputando o mesmo core. Capacidade se
   ganha com réplicas e CDN, não com pool maior.

**Impacto**: envs novas `WORKERS_ENABLED` e `HEALTH_METRICS_TOKEN` (ambas opcionais, documentadas no
`.env.example`; sem a segunda as métricas não existem para ninguém). Módulos puros novos e testados:
`server/lib/request-size.ts`, `server/lib/timing-safe.ts` (reaproveitado pelo webhook — nunca
duplicar comparação de segredo), `server/lib/event-loop-metrics.ts`, `server/lib/event-loop-monitor.ts`,
`server/lib/pg-error.ts`, `core/queue/workers-enabled.ts`. `/api/health` está fora do matcher do
proxy — conferido. **O que este endpoint NÃO detecta**: o caminho público é LIVENESS, incondicional
por desenho; ele responde 200 mesmo com MIGRATION QUEBRADA, porque o `CMD` do Dockerfile usa `||` de
propósito para o servidor subir mesmo se `scripts/migrate.mjs` falhar (o incidente
`42P01 relation "products" does not exist` daria 200 aqui). Readiness de verdade exigiria um sinal
do passo de migração — fica registrado como pendência, não como bug.

## 2026-08-25 — Achados da revisão do pacote de capacidade: histograma cego, ping que acusa o banco errado e worker que some em silêncio

**Decisão**: quatro correções sobre o pacote acima, todas verificadas no código real antes de mexer.

**(1) O histograma do `/api/health` era ACUMULADO desde o boot — cego para o incidente EM CURSO.**
Com `resolution` de 20 ms são ~50 amostras/s, ~4,3 milhões em 24 h de uptime (o estado normal de um
container `restart: unless-stopped`); um incidente de 5 min são ~15 mil amostras (0,35%), longe de
mover o p90 (precisa >10%) ou o p99 (precisa >1%). E o `max` acumulado é monotônico: um engasgo de
GC da véspera o deixa alto para sempre, indistinguível de agora. Ou seja, o endpoint criado para
tornar visível a LENTIDÃO SEM ERRO responderia "saudável" no meio dela. Agora são DOIS histogramas:
`window` (zerado por timer `unref`-ado a cada 60 s — é o AGORA, e é por ele que se decide se há
incidente) e `cumulative` (linha de base, e o `maxMs` histórico). O reset é por TEMPO e não por
request de propósito: zerar na leitura faria um chamador estragar a leitura do outro. `window.seconds`
acompanha o valor para o operador saber de quanto tempo é a janela lida. **Verificado no dev server**:
sob 14 requisições SSR concorrentes, `window` foi a p99 70,8 ms / max 160,9 ms; 70 s depois, ocioso,
`window.maxMs` voltou a 12,6 ms (piso do tick do Windows) enquanto `cumulative.maxMs` seguia 160,9 ms
e o `cumulative.p90` já havia diluído de volta para o piso — exatamente a cegueira descrita.

**(2) `?db=1` acusava o BANCO quando o problema era o POOL, e deixava resíduo.** O ping usava
`db.execute` contra um `Promise.race` de 2 s. Como o pool (corretamente) não tem
`connectionTimeoutMillis`, `connect()` empurra o pedido para `_pendingQueue` e ele fica pendente
INDEFINIDAMENTE — não rejeita (verificado no código do `pg-pool`). Resultado: com os slots ocupados
a rota reportava `reachable: false` + 503 com o banco impecável, E deixava uma query órfã na fila a
cada chamada, somando `waitingCount` — o health check inflando a própria métrica que publica como
"sinal de pressão real", e furando a fila na frente de requisição de visitante quando o slot
liberasse. Agora: (a) se o pool está cheio e sem ocioso, nem tenta — responde `pool_saturated`;
(b) a aquisição tem timeout próprio e o client que chega atrasado é devolvido na hora; (c) a query
tem timeout próprio e o `release` mora no `finally` dela, nunca com comando em voo. **Saturação e
timeout respondem 200**; só falha REAL de conexão (recusa/DNS/auth) vira `degraded` + 503 — mesmo
argumento do caminho público. Verificado: 5 polls seguidos com `?db=1` mantiveram `waiting: 0` e
`total: 1`, sem crescimento.

**(3) `WORKERS_ENABLED=false` criava um buraco negro silencioso.** A flag desliga só o CONSUMIDOR:
`POST /api/webhooks/erp` continua enfileirando e respondendo `202 { queued: true }`, o ERP registra
sucesso em todo envio e ninguém processa — o catálogo para de sincronizar sem um único erro, e a
evidência é a ausência de linhas em `sync_runs`, que ninguém monitora. (Com `REDIS_URL` ausente isso
não acontecia: o webhook falhava alto, 503.) Agora o estado é observável: `getWorkerRuntimeState()`
grava em `globalThis` (quem escreve é o `instrumentation.ts`, quem lê é o Route Handler — bundles
diferentes do mesmo processo) e `/api/health` publica `workers: { running, reason }` no ramo
autenticado; o log de boot com a flag desligada virou WARN e diz explicitamente que o webhook segue
respondendo 202. **Verificado**: com `WORKERS_ENABLED=false` a rota devolve
`workers: { running: false, reason: "disabled-by-flag" }`. O texto do `.env.example` também foi
corrigido — ele descrevia *competing consumers* como defeito ("N réplicas = N consumidores
concorrendo"), quando esse é o modo normal e seguro do BullMQ (reivindicação atômica, e ainda há o
`jobId` por minuto deduplicando). O motivo real da flag é ISOLAR CPU, e a receita correta é um
SERVIÇO web com a flag desligada + um SERVIÇO worker dedicado: env é definida por serviço, não por
réplica, então "algumas réplicas com a flag" não existe.

**(4) Falha de autenticação das métricas era indistinguível e o segredo esperado não era trimado.**
O guard usava `expected.trim().length === 0` mas comparava o valor CRU — um `HEALTH_METRICS_TOKEN`
colado em painel de deploy com quebra de linha no fim passava no guard e nunca casaria com header
nenhum (valor de header HTTP não carrega `\n`), deixando a rota mentindo em silêncio. Agora compara
contra `expected.trim()`, e há WARN **no servidor** (throttle de 1/min, nunca registra o valor
recebido) distinguindo "env ausente" de "token inválido". A resposta ao chamador continua idêntica
nos dois casos — log de servidor não é oráculo para quem tenta.

**Improcedente, e por quê**: a recomendação de fazer o caminho PÚBLICO do health reprovar (readiness
de verdade, com marcador de migration falha gravado pelo `CMD` do Dockerfile). O diagnóstico está
certo — o caminho público é uma tautologia e não detecta migration quebrada — mas a correção mexeria
no `CMD` do Dockerfile (que usa `||` deliberadamente para o servidor subir e permitir diagnóstico) e
ela própria admite a alternativa de apenas registrar a limitação. Ficou documentado no `route.ts`, no
`.env.example` e na entrada anterior deste log; a probe da plataforma deve continuar apontando para o
caminho público, que é liveness por desenho.

**Impacto**: `server/lib/event-loop-metrics.ts` ganha `summarizeHistogram` (puro, testado com duplo,
inclusive `percentile()` que LANÇA em histograma vazio — health check nunca pode ser causa de 500);
novo `server/lib/event-loop-monitor.ts` (singleton em `globalThis`, HMR-safe, timer `unref`-ado);
novo `server/lib/pg-error.ts` (`isStatementTimeout`, 15 testes); `register-workers.ts` exporta
`getWorkerRuntimeState()`; `db/index.ts` exporta `DB_POOL_MAX_CONNECTIONS` para o health distinguir
"pool saturado" de "banco fora do ar" sem repetir o número. Testes: 914 → 934.

## 2026-08-30 — Chrome de navegação: escala de nav fixa em 14px, seletor de idioma, login separado de "Portal ROCO" e rodapé em duas bandas

**Decisão**: quatro mudanças na moldura de navegação do site público (`(site)`, Tailwind-only),
mais as correções da revisão adversarial que se seguiu (última seção desta entrada).

**(a) `--type-nav` deixa de escalar e fixa em 14px.** Era
`clamp(0.875rem, 0.82rem + 0.24vw, 1.0625rem)` — 14px em telas pequenas subindo a **17px** no
desktop. Os rótulos da nav são CAIXA ALTA com tracking positivo, e é aí que a conta engana: caixa
alta não tem descendentes nem variação de altura-x, então cada rótulo lê como um bloco de altura
constante, e o tracking multiplica a largura por caractere. 17px em versalete com espaçamento pesa
visualmente muito mais que 17px em caixa baixa — a referência de mercado para nav em caixa alta é
13–14px. O tracking também caiu de 0.06em para **0.04em** pelo mesmo motivo. A escala continua sendo
a FONTE ÚNICA (`:root` → `@theme inline` em `globals.css`): a correção mora no papel `nav`, não num
`className` de tamanho solto no header — que é exatamente o que a arquitetura da escala existe para
impedir. O papel `nav` só é consumido pelo chrome de navegação (barra, painel mobile, seletor de
idioma), então nenhuma página muda fora do header. O MOBILE é papel à parte e NÃO encolheu: o alvo
de toque do painel vem do `py-3.5` (14px × leading 1.25 + 28px = 45,5px, acima dos 44px do WCAG
2.5.5), não do tamanho da fonte — havia inclusive um `text-ui` no painel que nunca se aplicava,
porque `text-ui` e `text-nav` caem no mesmo grupo `font-size` do `cn()` e o segundo descartava o
primeiro em silêncio.

**(b) Seletor de idioma PT ⇄ EN — troca do PRIMEIRO SEGMENTO do pathname.** Não existem rotas
traduzidas: `CONTACT_SEGMENT` é `"contato"` nos dois locales, e `/pt/produtos` e `/en/produtos`
compartilham o mesmo segmento. Logo trocar de idioma é trocar o primeiro segmento e preservar TODO
o resto — caminho, querystring e fragmento (`switchLocalePath`, `src/shared/lib/locale-path.ts`,
com testes próprios). Padrão de UI: USWDS "two languages" — um link que mostra o idioma de DESTINO
no PRÓPRIO idioma de destino ("English" numa página pt), sem bandeira (o W3C é explícito: bandeiras
são países, não idiomas), sem sigla de duas letras (alvo de tradução automática do navegador) e sem
globo (o rodapé já usa o globo do lucide para outra coisa).
Três detalhes que não são estética:
  - **`<a>` cru, navegação de documento inteiro, de propósito.** O `<html lang>` é emitido no root
    layout, ACIMA do segmento `[locale]` e COMPARTILHADO por `/pt/*` e `/en/*`; numa navegação
    client-side do App Router os layouts compartilhados não re-renderizam, então a página trocaria
    de idioma com o `lang` antigo grudado (SC 3.1.1). O `<a>` resolve por construção.
  - **O cookie `NEXT_LOCALE` NÃO é gravado pelo componente** — confirmado lendo `src/proxy.ts`: o
    middleware o regrava na requisição seguinte, e a navegação de documento inteiro garante que
    essa requisição aconteça. Sem isso o seletor precisaria escrever o cookie por conta própria.
  - **Sem `useSearchParams`**, que obrigaria fronteira `<Suspense>` em toda página pré-renderizada.
    O `href` renderizado carrega só o CAMINHO; o clique simples lê a URL VIVA (`window.location`) —
    o que ainda captura o que o `history.replaceState` do explorador de produtos escreveu, invisível
    para `useSearchParams`. Clique com modificador (nova aba) cai no href cru, sem os filtros: é a
    degradação aceitável; o inverso (href com query congelada no SSR) mentiria.

**(c) Acesso ao login do portal, separado do item "Portal ROCO".** O item de nav "Portal ROCO"
aponta para `/{locale}/representantes` — PRÉ-CADASTRO público, que não é login. Quem já é
representante não tinha nenhum caminho para `/{locale}/portal/login` a partir do site. Entra um
botão só de ícone (`LogIn` do lucide) com nome acessível vindo do dicionário
(`navigation.portalLogin`), na barra em TODOS os tamanhos — é destino de tarefa de quem já tem
conta e vale o toque único.

**(d) Rodapé reorganizado em DUAS BANDAS sobre a mesma grade.** Antes: UMA coluna de `1.5fr`
acumulava logo + tagline + telefone + e-mail + endereço da matriz + descrição da filial + redes, ao
lado de três colunas de 1–2 links. Medido com as métricas reais do Inter servido pelo `next/font`,
o desnível era de 291–330px em toda largura — e o pior caso era ao GANHAR espaço: cruzando
1023→1024px a coluna perdia 39% da largura e ficava mais ALTA. Agora: banda 1 = marca + 3 colunas
de links; banda 2 = contato (canais, matriz, unidade fabril, redes), cada bloco com RÓTULO próprio
— a descrição da filial era um parágrafo solto colado sob o endereço da matriz e lia como
continuação dele, ou como erro. Todo bloco de prosa passou a compartilhar a constante `PROSE_BLOCK`
(`max-w-xs`), um teto que não depende do container; antes só a tagline tinha limite, e eram
justamente os dois endereços sem teto que empurravam a coluna para 10 linhas. Desnível final:
42–66px (banda 1) e 27–66px (banda 2). `footer.addressLabel` ("Blumenau e Gaspar — Santa Catarina,
Brasil") era CÓDIGO MORTO desde a entrada dos endereços dinâmicos — nenhum componente o lia — e foi
removido dos dois dicionários.

**Alternativas**: (a) resolver o tamanho da nav com `className` no header — rejeitado, fura a escala
e reabre a divergência que ela existe para fechar; (b) `<select>` nativo de idioma — destoa do tema
dark neon e força um `onChange` com navegação programática, perdendo o "abrir em nova aba"; rotas
traduzidas por locale (`/en/products`) — fora de escopo e exigiria mapa de segmentos + sitemap
duplo; (c) reaproveitar o item "Portal ROCO" para o login — rejeitado, são públicos diferentes
(candidato a representante vs. representante com conta); (d) manter 4 colunas e só apertar a
primeira — rejeitado, o desnível cresce justamente quando há mais espaço.

**Justificativa**: pedido explícito do stakeholder em 2026-08-30 (fonte da nav grande demais,
rodapé quebrando, falta de seletor de idioma e de acesso ao login). `localeNames` já existia em
`src/i18n/config.ts` desde a fundação do projeto e nunca havia sido usado.

**Impacto**: componentes novos `src/shared/components/nav/{language-switcher,portal-login-link}.tsx`
e módulo puro `src/shared/lib/locale-path.ts` (com testes); `site-header.tsx` ganha o bloco de
controles à direita da nav, separado por um divisor; `mobile-menu.tsx` hospeda o seletor de idioma
abaixo de `lg` (ação rara, e a barra de 320px já divide espaço entre logotipo, login e hambúrguer);
dicionários ganham `navigation.language.action`, `navigation.portalLogin` e
`footer.contact.{title,headquartersLabel,plantLabel}`, e perdem `footer.addressLabel`.
**O breakpoint de colapso segue em `lg` (1024px), agora por MEDIDA e não por impressão**: com os
dois controles novos o conjunto (5 rótulos + divisor + seletor + botão) mede 728px em pt e 709px em
en a 1024px, contra 868px disponíveis — folga de 140/159px; a barra só deixaria de caber abaixo de
~900px. Subir para `xl` seria esconder uma barra que cabe.

### Correções da revisão adversarial deste mesmo pacote (2026-08-30)

**(1) O menu mobile trancava a rolagem da página ao cruzar o breakpoint.** `MobileMenu` é escondido
por CSS (`<div className="lg:hidden">` no `SiteHeader`), e `display:none` **não desmonta o React**:
`open` ficava preso em `true`, o cleanup do efeito nunca rodava e o `<body>` seguia com
`overflow:hidden`. Como o botão, o backdrop e o painel estão TODOS dentro do subárvore escondido,
não sobrava nenhum controle visível para destravar — TODA rota de `(site)` ficava sem rolagem.
Reproduz girando um iPad de retrato para paisagem com o menu aberto (1024px é exatamente o iPad Pro
em retrato), ou arrastando a janela do desktop de 1000 → 1100px. Correção: o efeito passa a
observar `window.matchMedia("(min-width: 64rem)")` e fecha o painel ao cruzar. Escolhida em vez de
uma classe `max-lg:overflow-hidden` porque esta dependeria do scanner do Tailwind v4 gerar o
utilitário a partir de um literal em `.tsx`. **A trava de scroll entrou nesta mesma branch**, então
a armadilha inteira é nova em relação à `main` — não é dívida herdada.

**(2) O `aria-label` do seletor de idioma anulava o `<span lang>`.** Pelo algoritmo de nome
acessível, `aria-label` (passo 2C) encerra a computação antes do conteúdo da subárvore (passo 2F):
o `<span lang="en">` nunca era consultado e o nome virava uma string plana no idioma do DOCUMENTO —
"English" pronunciado com fonemas portugueses, exatamente o que o docblock do componente afirmava
ter resolvido. Marcação morta prometendo o que não entregava. Correção: remover o `aria-label` e
deixar o nome vir do CONTEÚDO (`<span class="sr-only">` com a ação + `<span lang>` com o autônimo).
O nome acessível resultante é BYTE-IDÊNTICO ao anterior ("Mudar idioma: English"), então não há
regressão de WCAG 2.5.3 (Label in Name). `aria-labelledby` teria o mesmo defeito — também achata
para string única. O separador vive DENTRO do texto `sr-only` porque dois `<span>` adjacentes são
conteúdo "phrasing" e a composição do nome não insere espaço entre eles.

**(3) O telefone do rodapé abria o WhatsApp com o nome acessível "(47) 3335-2012" e ícone de
telefone.** O mesmo `href` (`wa.me/…`) aparecia DUAS vezes no rodapé com nomes diferentes — uma como
o número (ícone `Phone` do lucide, `aria-hidden`) e outra como "ROCO no WhatsApp" no bloco de redes.
Isso é 3.2.4 (Identificação Consistente) e 2.4.4 (propósito do link pelo nome). A duplicação é NOVA
nesta branch: o `readSetting` anterior fazia `String(v)` sobre o jsonb → `"[object Object]"` → o
`JSON.parse` lançava → `{}`, e o bloco de redes nunca renderizava. Correção: `aria-label` composto
("ROCO no WhatsApp: (47) 3335-2012", reaproveitando `footer.socialNames.whatsapp`, que já existia
nos dois locales) e troca do ícone `Phone` pelo `WhatsappIcon` já desenhado no arquivo. **NÃO virou
`tel:`**: `src/db/seed.ts` descreve `contact.phone` como canal de WhatsApp da matriz, não linha de
voz — discar poderia dar em nada.

**(4) "Ligamos pra você" no RODAPÉ apontava para o mesmo destino de "Fale conosco".** Este pacote
criou o placeholder `#ligamos` justamente porque o caminho literal no dicionário estava quebrado
(404 em EN, sem prefixo de locale em PT), e migrou o item da NAV — o link do RODAPÉ com o rótulo
idêntico ficou em `#contato`. Dois links de rótulos diferentes e destino byte-idêntico, e o de
callback perdia a intenção: o lead chegava ao RD Station como `contato_geral` em vez de
`ligamos_pra_voce`. Correção: `footer.columns[2].links[1].href` → `"#ligamos"` nos dois dicionários.
Aproveitado para uniformizar o rótulo EN, que aparecia como "We call you" na nav e "We'll call you"
no rodapé — mesmo item com dois nomes na mesma página.

**Não corrigido, e por quê**: a descrição da unidade fabril renderiza em PORTUGUÊS na versão em
inglês, sem `lang="pt"` (SC 3.1.2). É real, mas PRÉ-EXISTE a este pacote byte a byte (vem de
`692ae7c`) e não tem correção local: `site_settings` é chave-valor SEM dimensão de locale, então
hoje não existe caminho para traduzir o dado. Fica em `progress.md` como backlog, pelo mesmo
critério com que a revisão de 2026-08-25 recusou o achado do "fail-closed sem Redis".

**Verificação**: TUDO por medida e por HTML servido — **não houve verificação visual nesta sessão**
(a extensão do navegador estava desconectada; ninguém abriu a página). Larguras de barra calculadas
com as métricas reais do arquivo Inter servido pelo `next/font` (hmtx + HVAR em wght 500); o resto
por `curl` + parse dos anchors, cabeçalhos e `<option>` do HTML real. O julgamento estético do
resultado continua PENDENTE DE OLHO HUMANO.

## 2026-08-30 — Carrinho de cotação multi-produto: modelo de dados, RD Station, resolução server-side, hidratação, WhatsApp, nav e rate limit

**Contexto**: pedido do stakeholder — "carrinho basico de montagem de produtos para envio de dúvidas,
que será formatado para enviar ao e-mail/whatsapp/RD Station... de inicio pode ficar em cache no
próprio navegador do usuário, mas que tenha um carrinho no próprio menu tbm". É um carrinho de
COTAÇÃO/DÚVIDAS, não e-commerce: sem preço, sem checkout. A pessoa junta N produtos navegando e
dispara UMA submissão com a lista inteira ao time comercial, reaproveitando o caminho de captura de
lead já construído em `POST /api/contact` (INSERT síncrono ANTES dos canais, RD Station + Resend
best-effort em paralelo, rate limit fail-closed) em vez de inventar um segundo caminho.

**(1) Modelo de dados: tabela filha `contact_submission_items`, não jsonb nem texto livre.**
`contact_submissions` guarda hoje UM produto em três colunas soltas (`product_slug`/`product_name`/
`product_sku`). Para N itens, a decisão é uma tabela filha `contact_submission_items` (id uuid,
`submission_id` FK `contact_submissions.id` com `onDelete: cascade`, `product_slug`, `product_name`
— snapshot resolvido no servidor, nunca cru do cliente —, `product_sku`, `quantity` integer NOT NULL
default 1, `sort_order` integer NOT NULL default 0 para preservar a ordem de montagem do carrinho,
`created_at`). O `contact_subject` enum ganha o valor `"cart"` **no FIM da lista**
(`["call_back","quote","general","catalog","cart"]`) — mesma regra já documentada no comentário de
topo de `src/db/schema/contact.ts` (valor no meio força recriação completa do tipo pelo drizzle-kit).
Migration nova `drizzle/0009_*.sql` (gerada por `npm run db:generate`), aplicada sobre a 0008 mais
recente.
**Alternativas**: (a) coluna `jsonb` com o snapshot da lista inteira — rejeitada: o projeto usa jsonb
em UM único lugar (`site_settings`), e ali é DELIBERADAMENTE genérico (config chave-valor 1-por-site);
para dado transacional e relacional como itens de um pedido de cotação, toda a base do projeto é
tabela relacional normalizada (representatives, materials, hero_slides, contact_submissions em si) —
uma tabela filha é o padrão da casa, não uma exceção; também abre a porta, de graça, a um relatório
futuro (`GROUP BY product_slug` = produtos mais cotados), que jsonb exigiria migrar depois. (b)
serializar a lista dentro de `message` (texto livre) — rejeitada de propósito: perde toda estrutura,
inviabiliza validação de quantidade por item, e o próprio `message` já tem um contrato diferente (é
o corpo livre opcional do formulário, não um payload estruturado).
**Justificativa**: consistência com o restante do schema (tabelas relacionadas, nunca blobs para dado
que tem forma própria); baixo custo (uma tabela pequena, sem índices além da FK); mantém intacto tudo
que já existe para os 4 assuntos atuais (nenhuma coluna de `contact_submissions` muda de sentido).
**Impacto**: `src/db/schema/contact.ts` ganha a tabela + o valor de enum; barrel `src/db/schema/
index.ts` já reexporta `./contact` (sem mudança ali). Nova migration só ADITIVA (nenhuma coluna
existente é alterada/removida).

**(2) RD Station: campo customizado NOVO `cf_produtos_carrinho` (STRING) + `conversion_identifier`
próprio — nenhum limite oficial documentado, ancorado no único número que a API do RD publica perto
do assunto.** Pesquisa dedicada (WebFetch em `developers.rdstation.com/reference/conversao` e
`/reference/post_platform-contacts-fields`) confirmou: a Conversions API não documenta NENHUM limite
de tamanho para o VALOR de um campo `cf_*`; o único `data_type` com suporte a múltiplos valores é
`STRING[]`, mas sem nenhum exemplo de uso via `POST platform/conversions` — arriscado adotar sem
sandbox para validar. Decisão: criar `cf_produtos_carrinho` como `STRING` simples (não `STRING[]`),
populado com a lista concatenada (`"SKU 123 - Produto A (x2); SKU 456 - Produto B (x1)"`), truncada
em **1000 caracteres** com sufixo `"; (+ lista completa por e-mail)"` quando ultrapassa — o teto vem
do único número real que a doc do RD publica nas vizinhanças (`label` do campo tem máx. 1000 chars;
NÃO é prova de que o VALOR aceita exatamente isso, é o ponto de ancoragem disponível). Assunto `cart`
ganha `conversion_identifier: "carrinho_cotacao"` (string livre, sem exigir cadastro prévio — mesmo
padrão dos 4 identificadores existentes em `CONVERSION_IDENTIFIERS`).
**Alternativas**: (a) reaproveitar `cf_produto_interesse` (já existente, single-product) também para
o carrinho — rejeitada: o campo teria semântica inconsistente no painel do RD (às vezes "nome do
produto", às vezes "lista de N produtos separada por ponto-e-vírgula"), dificultando relatório/filtro
de quem consome o CRM depois; (b) `STRING[]` desde já — adiada por falta de exemplo documentado,
reavaliar se o suporte/sandbox do RD confirmar o contrato; (c) não truncar — rejeitada, ausência de
teto documentado é exatamente o motivo de definir um teto de engenharia, não de dispensá-lo.
**Impacto**: `cf_produtos_carrinho` é UM CAMPO NOVO que o stakeholder precisa criar À MÃO no painel do
RD (Configurações > Campos personalizados), ao lado de `cf_cnpj`/`cf_produto_interesse`/`cf_origem`
já pendentes (nenhum dos quatro tem credencial provisionada ainda — RD Station API Key segue
pendente). Baixo risco: o retry gracioso já existente em `rd-station-send.ts` (2026-08-25) já trata
QUALQUER `cf_*` ausente removendo todos e reenviando — o carrinho herda essa proteção sem mudança de
código ali. Números 1000/1900(ver item 5) são de ENGENHARIA, não contrato oficial — registrar para
revisitar se o suporte de qualquer uma das duas plataformas confirmar um teto real.

**(3) O servidor nunca confia na lista do carrinho — resolução em lote, nunca N idas ao banco por
item avulso.** Nova função `getPublicProductsBySlugs(slugs: string[])` em `src/server/lib/
public-products.ts`, reaproveitando `assembleProducts` (o mesmo helper já usado por listagem/detalhe)
com `inArray(products.slug, slugs)` + os mesmos filtros `published && active` — UMA query com `IN`,
não um loop de `getPublicProductBySlug`. `contactSchema` ganha `items: z.array(z.object({ slug:
z.string(), quantity: z.number().int().min(1).max(9999) })).min(1).max(20)`, exigido só quando
`subject === "cart"` (`superRefine`); os demais assuntos continuam com o `productSlug` singular de
sempre, sem nenhuma mudança de contrato. Na rota, slug que não resolve (produto removido, despublicado,
ou forjado) é DESCARTADO em silêncio da lista final — mesmo critério já aplicado ao `productSlug`
singular hoje —, mas se a resolução zerar a lista inteira (todo mundo caiu), a rota responde 400
`{ error: "cart_empty" }` ANTES de gravar qualquer linha: diferente do caso singular (onde um produto
que sumiu só empobrece o contexto de um lead que ainda faz sentido), um carrinho sem nenhum item
resolvido não é um lead, é um formulário vazio. Teto de 20 itens / 9999 unidades por item: bound de
custo da query em lote (mesma ordem de grandeza de UMA página de `/produtos`, que já roda sem limite
dedicado) e do tamanho das mensagens (RD/WhatsApp, ver itens 2 e 5).
**Alternativas**: (a) resolver item a item com `getPublicProductBySlug` em loop — rejeitada, N
round-trips ao Postgres por request quando uma única query com `IN` resolve tudo; (b) aceitar
silenciosamente um carrinho vazio e mandar lead sem produto nenhum — rejeitada, um "orçamento" sem
nenhum produto não ajuda o time comercial e confunde relatório; (c) sem teto de itens/quantidade —
rejeitada, é o mecanismo real de bound de custo (ver item 7, que dispensa um rate-limit dedicado
exatamente por causa deste teto).
**Justificativa**: doutrina já escrita em `contato/page.tsx` — "o cliente nunca é a autoridade";
estende o mesmo princípio de N=1 para N=20 sem introduzir uma classe nova de risco.
**Impacto**: `src/server/lib/public-products.ts` ganha a função em lote; `src/server/lib/
contact-submit.ts` ganha o campo `items` + validação condicional; `POST /api/contact` ganha o ramo de
resolução em lote + INSERT do pai e dos filhos dentro de UMA transação (`db.transaction`), com o MESMO
retry de `statement_timeout` (57014) já existente para o INSERT singular — o comentário de por que o
retry existe (migration com `ACCESS EXCLUSIVE` lock no boot) vale idêntico para a transação do
carrinho.

**(4) Hidratação do badge: estende o padrão de `ConsentBanner`, mas com `subscribe` de verdade — não
um no-op.** O `ConsentBanner` (2026-08-23) usa `useSyncExternalStore` com `subscribe` NO-OP porque o
consentimento é escrito uma vez (aceitar/recusar) e cada instância só lê o próprio estado. O carrinho
muda o tempo todo (adicionar de um card, remover na página do carrinho, zerar) e precisa notificar
MÚLTIPLOS assinantes simultâneos (badge no header, painel/página do carrinho, botões "adicionar" em
cada card) — um `subscribe` no-op deixaria o badge do header desatualizado depois de uma ação feita em
outra parte da árvore. Decisão: `src/shared/lib/cart-store.ts` implementa um singleton de módulo com
(a) estado em memória (fonte de verdade da aba), (b) um `Set` de listeners notificados por `emit()`
toda vez que `add`/`remove`/`setQuantity`/`clear` grava no `localStorage` (chave versionada
`roco_cart_v1` — versionar de propósito: uma mudança de shape futura não precisa migrar dado antigo,
só trocar de chave, mesmo espírito das chaves versionadas já usadas no portal, ex.
`SIDEBAR_COLLAPSE_STORAGE_KEY`), (c) listener do evento `storage` do `window` para sincronizar entre
ABAS abertas do mesmo navegador (bônus de robustez: duas abas do catálogo não divergem em silêncio).
`getSnapshot()` devolve sempre a MESMA referência de objeto até a próxima mutação (regra do "snapshot
estável" do React — sem isso, `useSyncExternalStore` re-renderiza infinito). `getServerSnapshot()`
devolve uma constante `EMPTY_CART` congelada — o badge nasce mostrando "vazio" no HTML do servidor e
reconcilia no primeiro paint do cliente, o MESMO idioma visual que o `ConsentBanner` já usa para nunca
piscar entre servidor e cliente. `localStorage` corrompido/forjado vira carrinho vazio, nunca lança —
mesmo critério defensivo de `readUtmCookie`.
**Alternativas**: (a) copiar o `subscribe` no-op do `ConsentBanner` tal qual — rejeitada, já
demonstrado que não serve para múltiplos escritores; (b) Context API + Provider React — rejeitada,
exigiria um provider novo envolvendo TODO o route group `(site)` só para um dado que já mora fora do
React (localStorage), e o padrão da casa para estado externo já é `useSyncExternalStore`; (c) Zustand/
Redux — rejeitada, dependência nova para um carrinho "básico" com 4 operações.
**Impacto**: `src/shared/lib/cart-store.ts` (store + hooks `useCartItems`/`useCartCount`) — cross-cutting
de propósito (nav no `shared/`, cards de produto no `shared/`, página do carrinho no `modules/cart/`
todos precisam ler o mesmo estado), mesmo critério que já colocou `lead-origin.ts` em `shared/lib`.

**(5) WhatsApp: link `wa.me` continua CLIENT-ONLY (o visitante envia, não a ROCO) e carrega um RESUMO,
nunca a lista inteira.** Pesquisa dedicada (WebFetch em fontes técnicas — não há doc oficial da Meta/
WhatsApp sobre limite de caracteres do parâmetro `?text=` de `wa.me`) encontrou dois números
convergentes de fontes independentes e verificáveis: 2083 caracteres (limite legado Windows/IE,
`support.microsoft.com/en-us/help/208427`) e 2046 caracteres (Chrome falha SILENCIOSAMENTE ao abrir
uma Application Protocol URL maior que isso — exatamente o mecanismo acionado quando `wa.me` é aberto
com o WhatsApp Desktop instalado; fonte: arquivo IEInternals da Microsoft, `learn.microsoft.com/en-us/
archive/blogs/ieinternals/url-length-limits`). Nenhum dos dois é um contrato oficial do WhatsApp — são
os números mais sólidos disponíveis na ausência de um. Decisão: usar **1900 caracteres da URL FINAL
já codificada** (`https://wa.me/<numero>?text=<mensagem>`) como teto rígido de engenharia — abaixo dos
dois números encontrados, com margem. Como acentuação/espaço/quebra de linha inflam a string 2-3x ao
codificar, isso deixa ~600-700 caracteres de texto cru — insuficiente para 10-20 itens detalhados.
Por isso a mensagem do WhatsApp NUNCA lista tudo: mostra contagem total + até os primeiros itens que
couberem no teto + uma frase fixa ("lista completa enviada por e-mail/formulário"), function pura
`buildWhatsappCartMessage` (testável, sem I/O) que remove itens do fim até a URL codificada caber no
teto — mesmo padrão de "resumo + apontar para o canal completo" já usado em e-commerce para
compartilhar carrinho por link. O clique no botão de WhatsApp continua sendo o PRÓPRIO visitante
mandando a mensagem pelo seu WhatsApp (deep link `wa.me`, mesmo mecanismo do `WhatsAppFloat` já
existente) — não uma integração de servidor com a Business API (custo/infra fora de escopo para um
carrinho "básico").
**Alternativas**: (a) confiar no limite de ~65.536 caracteres de mensagem pessoal do WhatsApp
(número de consenso de comunidade, não documentado oficialmente) — rejeitada, esse teto só vale
DEPOIS que a mensagem chega ao composer; a URL falha antes disso; (b) não truncar e deixar o link
falhar silenciosamente em carrinhos grandes — rejeitada, é exatamente o sintoma que a pesquisa
antecipou; (c) integrar WhatsApp Business API para a ROCO enviar a mensagem automaticamente —
rejeitada, fora de escopo ("carrinho BÁSICO", sem infra de Business API hoje).
**Justificativa**: sem contrato oficial, o critério de engenharia precisa ser conservador e
documentado como tal, para ser revisitado se algum dia surgir confirmação oficial.
**Impacto**: `src/modules/cart/lib/cart-whatsapp.ts` (função pura `buildWhatsappCartMessage`, testada
com o teto `WA_ME_MAX_URL_LENGTH = 1900`); o botão de WhatsApp do carrinho é adicional ao envio por
`/api/contact` (que já dispara e-mail + RD Station com a lista completa) — as três "vias" do pedido do
stakeholder (e-mail, WhatsApp, RD Station) ficam cobertas, cada uma pelo canal apropriado: e-mail e RD
recebem tudo (servidor, síncrono, best-effort); WhatsApp recebe um resumo (client-side, o visitante
decide se manda).

**(6) Carrinho no menu: ícone com badge sempre visível na barra (todos os breakpoints) + página
dedicada `/{locale}/carrinho` (não drawer/modal).** O orçamento de largura da barra documentado em
`site-header.tsx` (728px pt / 709px en usados contra 868px disponíveis a 1024px — folga de 140-159px)
comporta um controle a mais: um botão redondo `size-10` (mesmo padrão de `PortalLoginLink`) com um
badge numérico consome ~40-48px, bem dentro da folga registrada — mas a MEDIÇÃO PRECISA SER REFEITA
depois do ícone entrar (não presumida): esta é uma tarefa explícita do `frontend`. O ícone fica no
MESMO grupo de controles sempre visíveis (ao lado de `PortalLoginLink`), em TODOS os breakpoints —
diferente do `LanguageSwitcher`, que só aparece na barra desktop e migra para dentro do painel
hambúrguer no mobile —, porque o carrinho é um indicador de tarefa em andamento que a pessoa quer
conferir a qualquer momento, e enterrá-lo dentro do hambúrguer contrariaria o pedido explícito do
stakeholder ("carrinho no PRÓPRIO menu"). O ícone é um LINK simples para `/{locale}/carrinho` (sem
dropdown/drawer próprio) — mantém o `SiteHeader`/`MobileMenu` sem estado novo de overlay. A página
`/{locale}/carrinho` é uma rota de verdade (com `generateStaticParams` retornando só os locales, como
`/contato` — o CARRINHO em si vive inteiramente no `localStorage` do cliente; só a submissão final
passa pelo servidor), reaproveitando a mesma linguagem visual dos outros formulários (`form-neon`,
glows dual-tone) e o mesmo tratamento de UTM/origem que `/contato`/`/catalogo` já têm
(`resolveLeadUtm`, `normalizeLeadOrigin`). `core/config/site.ts` ganha `CART_SEGMENT = "carrinho"` +
`cartPath(locale)`, entrando também no `capturesLeads` de `resolveDestination` e no `sitemap.ts`, pelo
mesmo padrão de `/contato`/`/catalogo`. `LEAD_ORIGINS` (`shared/lib/lead-origin.ts`) ganha o valor
`"carrinho"` — a origem de um lead de carrinho é o PRÓPRIO fluxo do carrinho (diferente de `/contato`/
`/catalogo`, onde a origem descreve de ONDE a pessoa veio ATÉ a página; aqui o carrinho já é o
funil inteiro, então a submissão é gravada com `origin: "carrinho"` diretamente, sem depender de
querystring). Botões "adicionar ao carrinho" nos cards de produto (`ProductCard`, compartilhado entre
home/listagem/relacionados) e no detalhe são Client Components pequenos (`AddToCartButton`) compostos
DENTRO de `ProductCard`/`ProductDetailView`, que continuam Server Components — o mesmo limite já
praticado no projeto (regra nº 8 do CLAUDE.md: interatividade isolada em `"use client"`, dados/i18n no
server).
**Alternativas**: (a) drawer/painel lateral que abre por cima da página — rejeitada, é o padrão de
overlay que o projeto deliberadamente ABANDONOU em 2026-08-24 (o "Entre em contato" era modal e virou
página própria; a razão registrada foi permitir link compartilhável, SEO e melhor UX mobile — as
mesmas razões valem aqui: alguém pode querer voltar ao carrinho por link direto, ou o time comercial
pode pedir para reabrir); (b) esconder o ícone dentro do hambúrguer no mobile — rejeitada, contraria o
pedido explícito de visibilidade constante; (c) quantidade ajustável já no card da listagem (stepper)
— rejeitada por ora ("carrinho BÁSICO", palavra do próprio stakeholder): adicionar sempre soma
quantidade 1, ajuste fino (incrementar/remover) fica só na página do carrinho, reduzindo a superfície
de interação nos componentes mais reutilizados do site.
**Justificativa**: pedido explícito do stakeholder + consistência com a decisão já tomada (2026-08-24)
de preferir páginas reais a overlays para fluxos de captura de lead.
**Impacto**: novo módulo `src/modules/cart/` (página, formulário de envio reaproveitando o padrão de
`ContactForm`, builders de mensagem); `src/shared/components/cart/` para as peças reusadas pela nav e
pelos cards (`CartNavLink` com badge, `AddToCartButton`); `SiteHeader`/`MobileMenu` ganham o novo
controle; `ProductCard`/`ProductDetailView`/`QuoteCtaButton` ganham o botão de adicionar ao lado do
"Solicitar orçamento" (os dois caminhos continuam coexistindo: pedir orçamento de UM produto
imediatamente, ou juntar vários no carrinho antes de mandar).

**(7) Rate limit: reaproveita os limites já existentes de `/api/contact` — nenhum limitador dedicado
novo.** A submissão do carrinho passa pelo MESMO `POST /api/contact` (mesmo `CONTACT_IP_RATE_LIMIT`
8/10min por IP e `CONTACT_GLOBAL_RATE_LIMIT` 200/5min global, ambos já `productionSafe: true`,
fail-closed). O custo extra de resolver até 20 produtos em lote (item 3) é UMA query com `IN` — mesma
ordem de grandeza de uma única página de `/produtos` (que hoje não tem NENHUM rate limit dedicado e
recebe tráfego bem maior). Avaliado e REJEITADO um limitador específico para o carrinho: o teto de 20
itens/9999 unidades (item 3) já é o mecanismo real que limita o pior caso de custo por request — um
rate-limit adicional resolveria um problema que o teto de itens já resolve, só que com mais uma
chave/janela Redis para operar e depurar, sem modelo de ameaça novo que o justifique (mesmo espírito
das duas recomendações REFUTADAS e registradas em 2026-08-25 para o pool do Postgres — não é
esquecimento, é decisão).
**Alternativas**: (a) limite dedicado mais apertado só para `subject: "cart"` — rejeitada pela
ausência de um custo real diferenciado (ver acima); (b) cobrar o rate limit por item do carrinho (ex.:
`max: 8` vira `max: 8 / itens`) — rejeitada, sobre-penalizaria quem manda MENOS carrinhos mas com MAIS
itens, sem relação com o risco real (abuso é por REQUISIÇÃO, não por item).
**Justificativa**: o teto estrutural (item 3) já bound o custo; um limitador a mais seria superfície
operacional sem ganho de proteção mensurável.
**Impacto**: nenhuma mudança em `src/server/lib/rate-limit.ts` nem nos limites de `route.ts` — só a
validação de `items` (item 3) e o teto de tamanho de mensagem (itens 2 e 5) fazem o trabalho de bound
de custo/abuso para este novo caminho.
