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
