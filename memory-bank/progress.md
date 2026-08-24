# Progress — ROCO

## ✅ Concluído
### Site Institucional (MVP landing)
- [x] Concepção da estrutura (padrão espelhado de `site-autotec` / `archicodesite`)
- [x] Base Next.js 16 + TS + Tailwind v4 + i18n (pt/en) + SEO (robots/sitemap)
- [x] Extração de assets do `.psd` (hero, logo, wordmark) e novo PSD nav `docs/Novos ícones_OK.psd`
- [x] Página "Em breve" fiel ao layout (desktop + mobile)
- [x] "Entre em contato" → modal com formulário Mautic (id=1) embutido (lazy load)
- [x] Infra de IA (CLAUDE.md, AGENTS.md, memory-bank, `.claude/`, `.github/`, `.mcp.json`)
- [x] Docker (standalone) + headers de segurança
- [x] Refatoração: `coming-soon-hero.tsx` → `hero-layout.ts`, `nav-items.tsx`, `cta-hotspot.tsx`, `mobile-menu.tsx`
- [x] Nova nav com 4 itens + ícones lucide-react (PhoneCall, Headset) + textos i18n
- [x] Resolução centralizada de destino: `resolveDestination()` em `src/core/config/site.ts`
- [x] Validação de CNPJ + enhancement client-side do form Mautic (`cnpj.ts`, `use-mautic-enhancements.ts`)
- [x] Suporte alfanumérico de CNPJ (Receita Federal jul/2026) + bloqueio de submit inválido
- [x] Tracking de visitantes (Mautic `mtc.js`) — cópia self-hosted verificada + pageview por rota,
      CSP mantendo `script-src 'self'` (`src/shared/components/analytics/`)

### Portal Interno/CRM (2026-08-09 a 2026-08-10)
- [x] Schema Drizzle (18 tabelas + 4 enums) + migrations 0000-0001 em `./drizzle`
- [x] Seed idempotente (roles: admin, sales_manager, representative, viewer; permissões resource:action)
- [x] Auth.js v5 + Google SSO + Credentials provider + DrizzleAdapter + JWT revalidação staleness (5min)
- [x] proxy.ts (renomeado de middleware.ts): Node runtime, guardas sessão/role /portal/* /admin/*
- [x] Portal UI: MUI v9 + tema centralizado dark/light (tokens ROCO: cyan + amber AA 4.7:1)
      + InitColorSchemeScript (sem FOUC) + unlayered (sem enableCssLayer)
- [x] Route groups: (site) com tracking; (internal) sem tracking
- [x] Login Google + Credentials (e-mail/senha) + validação callbackUrl (anti-CSRF)
- [x] Shell (AppBar + Drawer): nav por permissão, representantes vs admin
- [x] Onboarding wizard (5 passos): autosave com guard booleano (hidrata uma vez), uploads presigned
- [x] Review representantes: aprovar/rejeitar com anti-auto-aprovação + audit log
- [x] Boas-vindas do representante (homepage): welcome-hero/sections/closing/status-alert,
      copy ROCO oficial, CTA catálogo PDF, materiais "Em breve" como Chip (não Tooltip)
- [x] tRPC v11 routers: products, representatives, sync (type-safe, withRBAC procedures)
- [x] REST público `/api/products` + `/api/products/[slug]` (unstable_cache + revalidateTag)
- [x] Cloudflare R2 presigned PUT/GET: imagens públicas, documentos privados (2-step validation)
- [x] BullMQ 6 + Redis: fila erp-sync in-process (instrumentation singleton), retry 3x backoff, DLQ
- [x] Webhook `/api/webhooks/erp` (secret timing-safe, 202 + fila)
- [x] Importador catálogo: SheetJS via CDN, 769 produtos + variantes, normalizações, idempotente
- [x] CRUD produtos: busca/filtros/cursor pagination + paginação real (total, page, perPage),
      form embalagens/badges/categorias, R2 uploads
- [x] Validação CNPJ/telefone + masking em uploads representantes
- [x] Dashboard: products.stats (total, published, active) + representatives.stats (draft, submitted, etc.)
- [x] Vitest 4: 226 testes, 100% cobertura lógica pura; 18 testes novos para rate limiting
- [x] Rate limiting Redis: login 5/5min + 30/5min global, webhook 60/min, /api/products 120/min,
      presigns 30/5min (fail-open sem REDIS_URL)
- [x] Segurança: Next 16.3.0 (CVEs), CSP R2, audit logs, callbackUrl validation, npm audit 0 vulns
- [x] ESLint: flat config nativo
- [x] i18n Portal: namespace `portal` (~156 chaves) pt/en idênticas
- [x] Bug fixes (7 reais encontrados em teste manual):
      (1) sx via CSS vars (não função em Server Components)
      (2) Tooltip em disabled REMOVIDO (hydration + chip visível)
      (3) Guard booleano hidratação onboarding (form = fonte verdade)
      (4) draftField preprocess ""→undefined (min validação só submit)
      (5) enableCssLayer REMOVIDO (MUI unlayered vence layers por route groups)
      (6) Light mode bgcolor background.default + minHeight 100dvh em (internal) layout
      (7) Processo órfão dev Windows: taskkill antes de restart

### Aquisição de Representantes (2026-08-11)
- [x] Página pública `/{locale}/representantes` (pré-cadastro, CNPJ obrigatório) + nav
      "Força de Vendas" reativada + sitemap + namespace i18n `representatives` pt/en
- [x] `POST /api/representatives/register`: rate limit (5/10min IP + 30/5min global), honeypot,
      dedupe e-mail/CNPJ, transação user+representative(`submitted`)+audit, bcrypt 12
- [x] Primeiro acesso pós-aprovação: `completeProfile` + wizard "modo conclusão"
      (território+documentos), presign/confirm liberados p/ `approved`, alerta nas boas-vindas
- [x] Link "Faça seu pré-cadastro" no login do portal; phone helpers movidos p/ `shared/lib`
- [x] 10 testes novos (registerSchema) → 236 total

### Infra Local (2026-08-11)
- [x] Stack Docker completa sempre no ar: web (localhost:3000) + postgres (host 5433) +
      redis (host 6380), `restart: unless-stopped`; dados preservados no volume (737 produtos)
- [x] `scripts/docker-build.cmd`: build via tar/stdin (bug BuildKit Windows com `[locale]`/`(site)`)
      + `docker compose up -d --no-build web`
- [x] Build-args `NEXT_PUBLIC_*` no Dockerfile — tracking Mautic OFF no bundle da imagem local
- [x] Smoke tests no container: site 200, /api/products com dados, guard do portal 307,
      login credentials E2E (302 + cookie de sessão)

### Site Institucional Completo (2026-08-11 parte 3)
- [x] Home reformulada: hero cinematográfico + institucional "Quem é a ROCO" (dados reais verificáveis)
      + vitrine categorias reais + produtos destaque + CTA Portal ROCO + footer
- [x] `/{locale}/produtos` (listagem): grid + busca (debounce 350ms) + filtro por categoria + paginação
      SSR cacheado via `unstable_cache` (tag "products", revalidate 300s), sem `generateStaticParams`
- [x] `/{locale}/produtos/[slug]` (detalhe): galeria R2 + `next/image`, nome/código/categorias/embalagens/
      badges, CTA "Solicite um orçamento" (modal Mautic), produtos relacionados por categoria
- [x] `SiteFooter` (`src/shared/components/footer/`): rodapé completo em (site) layout.
      Namespace `footer` (~20 chaves pt/en)
- [x] Funções novas: `getPublicProductList`/`getPublicCategoryList` (src/server/lib/public-products.ts)
- [x] 90 testes novos (produtos explorer, detail, funções puras) → suite verde
- [x] `next.config.ts` + Dockerfile/docker-compose suportam `R2_PUBLIC_URL` como build-arg
- [x] Revisão OWASP: nenhum achado crítico/alto novo introduzido

### Upload de mídia, materiais dinâmicos e RBAC editável (2026-08-24)
- [x] Upload de mídia do hero: bug fix `presignUpload`/`confirmUpload` (aceitava só vídeo mesmo para pôster)
- [x] Helper puro `src/server/lib/upload-limits.ts` (validação centralizada tipo/tamanho por campo)
- [x] Componente genérico `src/modules/portal/components/shared/portal-file-uploader.tsx` (dropzone, progresso, validação)
- [x] Schema `materials` (migration 0006) + router tRPC materials (CRUD + presign/confirm 2-step)
- [x] Admin CRUD `/{locale}/portal/materiais` + nav item gate `materials:create`
- [x] Feed somente-leitura em boas-vindas `welcome-materials-feed.tsx` (substitui 4 cards estáticos)
- [x] Arquivos sempre privados (presigned GET sob demanda, nunca `R2_PUBLIC_URL`)
- [x] Permissões novas: `materials:{create,read,update,delete}` no seed
- [x] 5 guardas puras RBAC: canDeleteRole, canEditRolePermissions, wouldSelfLockout, wouldRemoveLastAdmin, canGrantRole
- [x] Router tRPC routers/roles (listRoles/listPermissionsCatalog/createRole/updateRoleMeta/deleteRole/updateRolePermissions/listUsers/assignUserRole/unassignUserRole)
- [x] Tela `/{locale}/portal/perfis` (3 abas: Perfis CRUD, Matriz de permissões, Usuários)
- [x] Permissão `roles:manage` (admin only); perfil `admin` travado em UI
- [x] Slug de perfil imutável pós-criação (coluna `slug` no schema roles)
- [x] 137 testes novos (roles-guards.test.ts 51, upload-limits.test.ts 86) → 485 total
- [x] Segurança: 2 achados ALTOS corrigidos (gate `materials.list`, r2Key omitido do JSON)
- [x] i18n: 408 chaves portal.* verificadas programaticamente (paridade pt/en), bug `site`→`welcome` corrigido

### Qualidade
- [x] `npm run build` verde
- [x] `npm run test` e `npm run test:coverage` funcionando (485 testes totais agora)

## 🔄 Em Andamento
- [x] **Carga inicial de imagens de produto — CONCLUÍDA 2026-08-23**: token corrigido pelo
      stakeholder; `npm run db:import-images` subiu 613 imagens (336 MB) para 593 produtos no
      bucket `roco-test`, 0 falhas, chaves/registros no formato do portal; re-execução pula tudo
      (idempotência verificada); objeto amostrado byte-idêntico ao original; container web
      recriado com as envs R2 (portal apto a presign/confirm/delete).
- [x] **`R2_PUBLIC_URL` — RESOLVIDO 2026-08-23**: stakeholder habilitou o r2.dev
      (`https://pub-a1a98630b8f4417ebc7e9d2098e8c2f9.r2.dev`); URL gravada em `.env`/`.env.local`
      e imagem Docker rebuildada com os build-args R2_PUBLIC_URL + R2_ACCOUNT_ID. Verificado:
      listagem/detalhe servem as fotos reais via next/image (otimizador 200), CSP img-src com o
      host. Em produção, avaliar domínio custom no lugar do r2.dev (cache/branding).
- [ ] Segunda rodada de fotos: mapear 132 arquivos sem produto (faixas 1906–1919, 2237–2280,
      3068–3179 ausentes do catálogo + 11 nomes livres) e 144 produtos sem foto.
- [ ] Smoke test portal (login, RBAC, uploads, presigned URLs, webhook ERP)
- [ ] Provisionar infra prod (Postgres + Redis, Google OAuth, R2 bucket)

## 🗺️ Roadmap Estratégico (avaliação multi-agente 2026-08-23)
Análise de 5 áreas (conversão, portal/CRM, dados/integrações, SEO, segurança/LGPD) sobre o código
real — 29 oportunidades ancoradas em arquivo/rota. Artefato completo publicado para o stakeholder
(claude.ai/code/artifact/de6b6f9c-4ef2-4563-8e94-e1a40818e1ef). Síntese em 3 fases:
- **Fase 0 (pré-launch)**: rate-limit fail-closed + IP confiável; canonicalização www→apex (resolve
  CORS Mautic + SEO); Turnstile no register; LGPD (banner consentimento + /privacidade); curadoria
  em LOTE de published no admin (destrava go-live); ficha técnica B2B (EAN/NCM/embalagens já no
  banco, não exibidos); nav "Produtos" + /sobre + /contato; 2ª carga de fotos (132 órfãs via
  planilha de mapeamento); SEO fundação (sitemap dinâmico de produtos — reverter parcialmente
  decisão 2026-08-11 com cache por tag, hreflang/canonical, fix <html lang> via cookie, OG por
  produto, malha de links rastreável, facade do YouTube p/ LCP).
- **Fase 1 (quick wins)**: busca unaccent+multi-termo+categoria; orçamento com contexto do produto
  (prefill Mautic + WhatsApp contextual); JSON-LD Product/Breadcrumb/Organization; notificações
  WhatsApp (MCP configurado, zero uso no código — ciclo do representante + alerta de lead);
  gestor de materiais de venda no admin (mata os 6 "Em breve").
- **Fase 2 (salto de valor)**: full-sync ERP com preço+estoque (DESTRAVADOR — priceCents é coluna
  morta); catálogo comercial do representante; badge dinâmica pronta-entrega; carrinho de cotação
  multi-item no site; cotação estruturada do representante → fila interna; upload de imagens em
  massa no admin; ciclo de vida de documentos (deleteDocument + retenção LGPD).
Tese: 4 movimentos — tirar atrito do funil de cotação → portal com motivo de uso semanal →
catálogo vivo via ERP → cotação como dado estruturado.

## 📋 Backlog MVP / Pós-MVP
### Infra (pré-launch — decisão stakeholder)
- [ ] **Bucket R2 separado para conteúdo privado** (Alto, infra): criar bucket sem acesso público para
      materiais/documentos de representante (hoje compartilhado com bucket público hero/produtos).
      Mitiga risco de exposição via r2.dev — ver Riscos de Segurança (TOCTOU e bucket compartilhado).

### Portal (pós-launch inicial)
- [ ] **Rate limiting** (ALTO): webhook, presign, /api/products, login via @upstash/ratelimit
- [ ] Confirmar assunções negócio: N categorias por produto? Preço sincronizado? Universo ERP
      vs só catálogo? Badges oficiais?
- [ ] Contrato full-sync ERP (worker trata webhook; full-sync = not_implemented)
- [ ] deleteDocument endpoint (UI não tem remover documento confirmado)
- [ ] E2E + component tests; /portal/produtos com next/image (hoje <img> cru)
- [ ] Uploads órfãos no R2 (presign sem confirm) — job de limpeza futuro

### Site (pós-MVP home/produtos)
- [ ] **Vídeo do hero: trocar embed YouTube por MP4 self-hosted** (2026-08-12): pedir o arquivo ao
      stakeholder; remove youtube-nocookie da CSP `frame-src`, elimina tracking de terceiro (LGPD)
      e o player em conexões lentas. Avaliar `prefers-reduced-motion` (pôster já cobre fallback).
- [ ] **Endurecer register contra enumeração/spam** (revisão 2026-08-12): oráculo 409
      email_exists/cnpj_exists + teto global 60/5min permitem ~17k probes/dia (enumeração) e
      pré-cadastros falsos inundando a fila do admin (CNPJs válidos são geráveis; honeypot só
      dispara se o campo vier preenchido). Mitigação recomendada: Turnstile/hCaptcha ou
      confirmação de e-mail antes do INSERT, mantendo o 409 atrás do desafio.
- [ ] Busca por nome de categoria na listagem `/produtos` (revisão 2026-08-12): a busca cobre
      nome (pt/en) + SKU; categoria só via filtro select. Placeholder já ajustado para não
      prometer o que não faz — implementar se o stakeholder quiser busca unificada.
- [ ] Smoke test tracking Mautic no navegador (hits, cookies, CSP clean)
- [x] ~~Confirmar certificação/selo GPTW~~ **RESOLVIDO 2026-08-23**: arte oficial com vigência
      fev 2026 – fev 2027 recebida e no rodapé (ver Riscos de Segurança)
- [ ] Liberar `https://www.roco.com.br` nas "CORS Valid Domains" do Mautic (hoje só `roco.com.br`),
      ou canonicalizar host — senão visitas via `www` não amarram ao contato
- [ ] Decidir política consentimento (LGPD) para tracking Mautic
- [ ] Subir PDFs das seções do site (catálogo, notícia técnica, brochura) na rota de download
- [ ] Metadata/SEO definitiva + favicon/OG oficiais (home e páginas de produtos)
- [ ] Blog/Notícias (backlog futuro quando CMS/fonte de conteúdo definida)
- [ ] Newsletter integrada (backlog futuro quando infra de e-mail definida)

## 🐛 Débitos Técnicos
- **PDFs + vídeo das boas-vindas** (contactos, política comercial, logística, Sistema DW) —
  atualmente disabled; links precisam de upload/asset públicos.
- **Funções puras não exportadas** (2026-08-11): `categoryName` em `products-explorer.tsx`
  e outras em `public-products.ts` não são módulos testáveis isoladamente — testáveis só via componente.
  Refatorar para `src/server/lib` quando escala de testes crescer. (`interpolate` já migrou para
  `src/shared/lib/interpolate.ts` com testes próprios — 2026-08-12.)
- ~~SiteHeader não sticky/fixed~~ **RESOLVIDO 2026-08-12**: header virou faixa fixa translúcida
  padrão WEG (backdrop-blur, fundo sólido ao rolar, filete dual-tone) com painel mobile full-width
  (backdrop + trava de scroll). `.nav-glass` removida do globals.css (histórico no git).
- **Seções "Notícias" e "Newsletter" omitidas** (2026-08-11): padrão WEG não replicado (sem CMS/e-mail
  marketing hoje). Backlog pós-MVP quando houver fonte de conteúdo real.
- **Processo órfão dev server Windows**: taskkill manual necessário antes de `npm run dev` restart
  (mitigado 2026-08-11: teste contínuo agora roda no container Docker; dev server só para hot reload
  — `docker compose stop web && npm run dev`).
- Avaliar tornar CNPJ obrigatório em representantes (atualmente só se preenchido).
- `roco-wordmark-white.png` (wordmark 3D) tem leve bleed; logo 2D é principal.
- `docs/documento` (~98 MB) versionado — avaliar LFS/storage externo.
- **xlsx via CDN tarball**: fora do npm audit — reauditar manualmente a cada atualização.
- E2E e component tests da UI do portal faltam (vitest cobre lógica pura).
- Audit logs export/retention policy indefinida.

## ✅ Resolvido em 2026-08-24
- **Achado de segurança ALTO 1**: `materials.list` aceitava gate `materials:read` em vez de `materials:create` — representante conseguia ver rascunhos não publicados. CORRIGIDO: gate trocado para `permissionProcedure("materials","create")` (admin only).
- **Achado de segurança ALTO 2**: `r2Key` bruta vazava no payload JSON de `materials.list`/`listPublished` — combinado com bucket R2 público (r2.dev), permitia montar URL pública contornando link presignado. CORRIGIDO: `withDownloadUrl` agora omite `r2Key` do retorno (expõe só `downloadUrl`). Componentes consumidores (`MaterialRow`, form edição) ajustados para patch parcial (reenviam `r2Key` só se arquivo trocado, senão omitem).

## ✅ Resolvido em 2026-08-23
- **Sidebar colapsável do portal**: toggle no AppBar com persistência localStorage por usuário (larguras 260/72px); padrão `next/navigation` decidiu estado inicial para evitar hydration mismatch.
- **Hero slideshow admin** (`/portal/hero`): 6 macro-famílias de marketing configuráveis (YouTube ou upload R2), copy bilíngue PT/EN, CTAs, janela de loop opcional, auto-advance opcional, agendamento, reorder. `HeroSlider` com auto-advance + crossfade + pause-on-hover. `/catalogo` virou download direto (lê `getCatalogPdfUrl()` com fallback DB → env → constante).
- **Mautic → RD Station**: 11 arquivos removidos, stub `RdStationTracking` off-by-default. CSP limpa do domínio Mautic; mantém `youtube-nocookie.com` (slides YouTube continuam possíveis).
- **LGPD stub**: `ConsentBanner` off-by-default via `NEXT_PUBLIC_CONSENT_ENABLED`; usa `useSyncExternalStore` (sem hydration mismatch, sem setState em effect). Body do dicionário fica em branco até jurídico preencher.
- **Hardening de segurança**: `proxy.ts` agora match exato de `/api` por segmento (era substring — qualquer `/portal/api-docs` futuro nasceria público). `rate-limit.ts` com `productionSafe` para fail-closed em rotas de auth.
- **`site_settings`**: tabela genérica chave-valor para configs 1-por-site (hoje: `catalog.pdf-url`). Edits via admin sem deploy.

## 🔐 Riscos de Segurança
- **Rate limiting implementado** (2026-08-10): login 5/5min + 30/5min global, webhook 60/min,
  /api/products 120/min, presigns 30/5min via Redis fixed-window (fail-open sem REDIS_URL com WARN).
  **Nota**: sem Redis em dev, rate limit não funciona (comportamento esperado, recomendação: testar em staging com Redis).
- **Claim GPTW — RESOLVIDO 2026-08-23**: stakeholder forneceu a arte oficial do selo com vigência
  ("Certificada FEV 2026 – FEV 2027, Brasil"). Processada para PNG transparente em
  `public/images/certifications/gptw-certificada-2026-2027.png` (original de referência em
  `docs/selo-gptw-fev2026-fev2027.jpeg`); rodapé exibe o selo oficial + vigência no lugar do
  badge textual. Ao RENOVAR a certificação (fev/2027), substituir o asset e as notas nos
  dicionários (`footer.certifications.items[0]`) — selo vencido volta a ser risco CDC.
- **`getClientIp` confia em `X-Forwarded-For` sem validar topologia de proxy** (2026-08-11): rate-limit
  usa header sem normalização. Pré-existente, porém tráfego público novo (catálogo) aumenta superfície.
  Recomendação: confirmar que proxy de produção (Cloudflare/reverse proxy) normaliza o header.
- **`proxy.ts` usa `pathname.includes("/api")` não segmento exato** (2026-08-11): substring não seguro.
  Não explorável hoje (nenhuma rota interna contém "api" no path), item de hardening futuro.
- **LGPD Portal**: CNPJ/telefone/documentos de representantes (dados pessoais). Minimização ok,
  mas política retenção não definida. Audit log implementado.
- **Tracking Mautic sem consentimento**: `mtc.js` grava `mtc_id`/`mtc_sid`/`mautic_device_id`,
  identifica visitante, **sem banner opt-in**. Flag permite desligar; decisão pendente com jurídico.
- **CORS Mautic**: allowlist tem só `https://roco.com.br`; visitantes via `www` caem em pixel
  sem amarrar ao contato — corrigir CORS ou canonicalizar host.
- **Cópias em `public/vendor/`**: reextrair APENAS de servidor Mautic limpo (pós-ClickFix).
  Reinspecionar + SHA-256 em `public/vendor/README.md`. Devolver `mautic.roco.com.br` ao `script-src` reabriria vetor.
- **JWT + Drizzle**: validação staleness por callback a cada 5min; user.active booleano; desativação
  derruba sessão em ≤5min (ok). RBAC checado em tRPC procedures + Server Actions.
- **sx (Emotion) em Server Components**: não pode usar funções (revalidação em runtime); usar
  `rgba(var(--mui-palette-primary-mainChannel) / 0.16)` em vez disso.
- **Condição de corrida (TOCTOU) em `unassignUserRole`** (2026-08-24, Médio/backlog): leitura da contagem
  de admins ativos e o `DELETE` não estão na mesma transação/lock — duas remoções concorrentes de `admin`
  poderiam, em teoria, zerar os admins ativos mesmo com guarda `wouldRemoveLastAdmin`. Exige ator já
  privilegiado (`roles:manage`) e timing preciso. **Hardening futuro**: envolver em `db.transaction` com
  `SELECT ... FOR UPDATE`.
- **`roles:manage` é admin-equivalente** (2026-08-24, Médio/backlog): ator com só `roles:manage` pode
  criar perfil customizado, marcar TODAS permissões do catálogo nele e se auto-atribuir — obtendo poder
  operacional equivalente a admin sem tocar role `admin` (único caminho bloqueado por `canGrantRole`).
  Não é promessa quebrada do decisionLog, mas limite real do modelo de confiança. **Mitigação**: tratar
  `roles:manage` como nível "admin-equivalente"; hardening futuro: impedir concessão de permissão que
  o ator não possui.
- **Bucket R2 compartilhado com acesso público (r2.dev)** (2026-08-24, Alto/backlog): "privado" para
  materiais/documentos de representante é CONVENÇÃO DA APLICAÇÃO (nunca gerar URL pública), não controle
  de armazenamento — bucket inteiro tem acesso público desde 2026-08-23 para hero/produtos. Pré-existente
  (onboarding docs desde 2026-08-09), visível agora com conteúdo sensível novo (materiais comerciais)
  acessível a mais público (representantes vs admin). **Decisão pendente stakeholder**: bucket separado
  sem acesso público para conteúdo privado, antes de produção.

## 📊 Métricas de Qualidade
- **Testes**: Vitest 4, 485 testes, 100% cobertura lógica pura; scripts test/test:watch/test:coverage.
  (+90 testes 2026-08-11 produtos explorer/detail; +6 testes 2026-08-12 `interpolate`;
  +6 testes 2026-08-23 `resolveCategoryCardHref`; +137 testes 2026-08-24 roles-guards + upload-limits).
- **Build**: verde. **Lint**: verde (ESLint flat config).
- **Segurança**: npm audit --omit=dev = 0 vulns (após Next 16.3.0); OWASP scan 2026-08-11 aplicado
  (nenhum achado crítico/alto novo introduzido).
- **Revisão adversarial multi-agente** (2026-08-12): 13 agentes (4 dimensões: corretude, i18n,
  segurança, regressão + verificação adversarial por achado) sobre o diff da feature WEG.
  8 achados confirmados / 1 refutado; 7 corrigidos no mesmo dia (resync URL↔estado do explorer
  via history.replaceState + adoção de props, revert de erro com banner, clamp de página no
  server, escape/teto/no-cache da busca livre, busca inclui nameEn, alt localizado altPt/altEn,
  copy do HomeAbout → dicionários). 1 movido para backlog (endurecer register). Regressão: zero.
- **Revisão adversarial multi-agente** (2026-08-23): 11 agentes (3 dimensões: corretude, i18n/a11y,
  design/segurança + verificação adversarial por achado) sobre o diff da vitrine PSD + selo GPTW.
  4 confirmados / 3 refutados; 4 corrigidos na hora (guard de URIError no resolveCategoryCardHref,
  scrim WCAG atrás do rótulo dos cards — contraste ~1:1 medido em 2 das 6 artes, alt decorativo ""
  nos cards — nome acessível do link ficava verboso, EN "Connections"→"Fittings" + description).
  Verificadores mediram contraste por pixel nas artes reais e reproduziram o URIError via tsx.
- **Revisão de segurança** (2026-08-24): feature RBAC + materiais dinâmicos auditada internamente.
  2 achados ALTOS confirmados + corrigidos (gate `materials.list`, r2Key omitido do JSON).
  3 riscos Médio/backlog identificados (TOCTOU `unassignUserRole`, admin-equivalência de `roles:manage`,
  bucket R2 compartilhado com acesso público) — não bloqueantes, registrados em Riscos e Backlog.
- **i18n**: portal namespace (~156+24 chaves materiais) + home (~50 chaves) + footer (~20 chaves) —
  árvores pt/en idênticas. Dicionário estruturado por módulo (landing → home, representantes como
  namespace raiz). 408 chaves portal.* verificadas programaticamente (2026-08-24).
