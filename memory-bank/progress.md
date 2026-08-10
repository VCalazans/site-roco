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

### Portal Interno/CRM (2026-08-09)
- [x] Schema Drizzle (18 tabelas + 4 enums) + migrations 0000-0001 em `./drizzle`
- [x] Seed idempotente (roles: admin, sales_manager, representative, viewer; permissões resource:action)
- [x] Auth.js v5 + Google SSO + DrizzleAdapter + JWT revalidação staleness (5min)
- [x] proxy.ts (renomeado de middleware.ts): Node runtime, guardas sessão/role /portal/* /admin/*
- [x] Portal UI: MUI v9 + tema centralizado dark/light (tokens ROCO) + InitColorSchemeScript (sem FOUC)
- [x] Route groups: (site) com tracking; (internal) sem tracking
- [x] Login Google + validação callbackUrl (anti-CSRF)
- [x] Shell (AppBar + Drawer): nav por permissão, representantes vs admin
- [x] Onboarding wizard (5 passos): autosave + upload documentos presigned
- [x] Review representantes: aprovar/rejeitar com anti-auto-aprovação + audit log
- [x] tRPC v11 routers: products, representatives, sync
- [x] REST público `/api/products` + `/api/products/[slug]` (unstable_cache + revalidateTag)
- [x] Cloudflare R2 presigned PUT/GET: imagens públicas, documentos privados
- [x] BullMQ 6 + Redis: fila erp-sync in-process (instrumentation singleton), retry 3x backoff, DLQ
- [x] Webhook `/api/webhooks/erp` (secret timing-safe, 202 + fila)
- [x] Importador catálogo: SheetJS via CDN, 769 produtos + variantes embalagem, normalizações,
      idempotente (published=false, re-import não mexe em published/active)
- [x] CRUD produtos: busca/filtros/cursor pagination, form embalagens/badges/categorias, R2 uploads
- [x] Validação CNPJ/telefone em uploads representantes
- [x] Vitest 4: 208 testes, 100% cobertura lógica pura (rbac, cnpj, slugify, db-error, permissions)
- [x] Segurança: Next 16.3.0 (CVEs RCE+middleware), CSP R2 sem afrouxar script-src, audit logs,
      callbackUrl validation, npm audit 0 vulns
- [x] ESLint: flat config nativo, 3 erros legados corrigidos
- [x] i18n Portal: namespace `portal` (~156 chaves) pt/en idênticas

### Qualidade
- [x] `npm run build` verde
- [x] `npm run test` e `npm run test:coverage` funcionando

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

### Site (landing)
- [ ] Smoke test tracking Mautic no navegador (hits, cookies, CSP clean)
- [ ] Liberar `https://www.roco.com.br` nas "CORS Valid Domains" do Mautic (hoje só `roco.com.br`),
      ou canonicalizar host — senão visitas via `www` não amarram ao contato
- [ ] Decidir política consentimento (LGPD) para tracking Mautic
- [ ] Revisar copy EN com copywriter
- [ ] Confirmar destinos reais (URL Produtos, arquivo Catálogo PDF)
- [ ] Página/fluxo Contato completo (se diferente modal Mautic)
- [ ] Metadata/SEO definitiva + favicon/OG oficiais
- [ ] Página de Produtos e Catálogo (usando /api/products)
- [ ] Conteúdo institucional (Quem somos) / blog (se aplicável)

## 🐛 Débitos Técnicos
- Avaliar tornar CNPJ obrigatório em representantes (atualmente só se preenchido).
- `roco-wordmark-white.png` (wordmark 3D) tem leve bleed do render; logo 2D é principal.
- `docs/documento` e `docs/Novos ícones_OK.psd` (~98 MB) versionados — avaliar LFS/storage externo.
- Copy EN do landing é provisório (revisar com copywriter).
- Destinos CTAs landing podem ser placeholders até stakeholder confirmar.
- **xlsx via CDN tarball**: fora do npm audit — reauditar manualmente a cada atualização
      (mesmo protocolo de public/vendor/ — procedência + SHA-256 em `docs/` ou README).
- Teste runner formal configurado, mas E2E e component tests da UI do portal ainda faltam.
- Logs auditoria na tabela `audit_logs` — avaliar export/retention policy.

## 🔐 Riscos de Segurança
- **Rate limiting ausente** (ALTO): webhook `/api/webhooks/erp`, presign uploads, `/api/products`,
  login — recomendação: @upstash/ratelimit sobre Redis existente.
- **LGPD Portal**: CNPJ/telefone/documentos de representantes (dados pessoais). Minimização ok,
  mas política retenção não definida. Audit log implementado.
- **Tracking Mautic sem consentimento**: `mtc.js` grava `mtc_id`/`mtc_sid`/`mautic_device_id`,
  identifica visitante, **sem banner opt-in**. Flag permite desligar; decisão pendente com jurídico.
- **CORS Mautic**: allowlist tem só `https://roco.com.br`; visitantes via `www` caem em pixel
  sem amarrar ao contato — corrigir CORS ou canonicalizar host.
- **Cópias em `public/vendor/`**: reextrair APENAS de servidor Mautic limpo (pós-ClickFix).
  Reinspecionar + SHA-256 no `public/vendor/README.md`. Devolver `mautic.roco.com.br` ao
  `script-src` reabriria vetor ClickFix.
- **JWT + Drizzle**: validação staleness por callback a cada 5min; user.active booleano; desativação
  derruba sessão em ≤5min (ok). RBAC checado em tRPC procedures + Server Actions.

## 📊 Métricas de Qualidade
- **Testes**: Vitest 4, 208 testes, 100% cobertura lógica pura; scripts test/test:watch/test:coverage.
- **Build**: verde. **Lint**: verde (ESLint flat config).
- **Segurança**: npm audit --omit=dev = 0 vulns (após Next 16.3.0); OWASP scan aplicado.
- **i18n**: portal namespace (~156 chaves) + landing (~40 chaves) — árvores pt/en idênticas.
