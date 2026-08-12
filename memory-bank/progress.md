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

### Qualidade
- [x] `npm run build` verde
- [x] `npm run test` e `npm run test:coverage` funcionando (326 testes totais agora)

## 🔄 Em Andamento
- [ ] Smoke test portal (login, RBAC, uploads, presigned URLs, webhook ERP)
- [ ] Provisionar infra prod (Postgres + Redis, Google OAuth, R2 bucket)

## 📋 Backlog MVP / Pós-MVP
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
- [ ] Confirmar certificação/selo GPTW (ano/validade) com stakeholder antes de produção
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

## 🔐 Riscos de Segurança
- **Rate limiting implementado** (2026-08-10): login 5/5min + 30/5min global, webhook 60/min,
  /api/products 120/min, presigns 30/5min via Redis fixed-window (fail-open sem REDIS_URL com WARN).
  **Nota**: sem Redis em dev, rate limit não funciona (comportamento esperado, recomendação: testar em staging com Redis).
- **Claim GPTW pendente de confirmação** (2026-08-11): home institucional cita "Great Place to Work"
  sem documentação de ano/validade do selo. Risco de compliance CDC se não puder ser sustentado com prova
  documental — mover confirmação com stakeholder para topo de bloqueadores antes de produção.
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

## 📊 Métricas de Qualidade
- **Testes**: Vitest 4, 340 testes, 100% cobertura lógica pura; scripts test/test:watch/test:coverage.
  (+90 testes 2026-08-11 produtos explorer/detail; +6 testes 2026-08-12 `interpolate`).
- **Build**: verde. **Lint**: verde (ESLint flat config).
- **Segurança**: npm audit --omit=dev = 0 vulns (após Next 16.3.0); OWASP scan 2026-08-11 aplicado
  (nenhum achado crítico/alto novo introduzido).
- **Revisão adversarial multi-agente** (2026-08-12): 13 agentes (4 dimensões: corretude, i18n,
  segurança, regressão + verificação adversarial por achado) sobre o diff da feature WEG.
  8 achados confirmados / 1 refutado; 7 corrigidos no mesmo dia (resync URL↔estado do explorer
  via history.replaceState + adoção de props, revert de erro com banner, clamp de página no
  server, escape/teto/no-cache da busca livre, busca inclui nameEn, alt localizado altPt/altEn,
  copy do HomeAbout → dicionários). 1 movido para backlog (endurecer register). Regressão: zero.
- **i18n**: portal namespace (~156 chaves) + home (~50 chaves) + footer (~20 chaves) — árvores pt/en
  idênticas. Dicionário estruturado por módulo (landing → home, representantes como namespace raiz).
