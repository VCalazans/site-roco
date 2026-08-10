# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-09

## Fase Atual
MVP evolução — landing + catálogo + portal interno/CRM pronto (implementação em 3 ondas concluída).

## O Que Foi Feito (esta sessão — 2026-08-09)
### Onda 1: Database + Auth + Schema
- **Schema Drizzle**: 18 tabelas (users, roles, role_permissions, permissions, products,
  product_categories, product_images, product_variants, sync_runs, audit_logs, etc.) + 4 enums
  (SyncStatus, AuditAction, ApprovalStatus, SyncType); migrations 0000 + 0001 em `./drizzle`.
- **Auth.js v5 (next-auth 5.0.0-beta.32)**: Google SSO, JWT strategy com roles/permissions
  embutidos no JWT, DrizzleAdapter, sessão 8h com revalidação staleness a cada 5min
  (`src/core/auth/{index.ts,rbac.ts,types.d.ts}`).
- **proxy.ts (renomeado de middleware.ts)**: Node runtime (Next 16), preserva locale, guardas de
  sessão/role para /portal/* e /admin/*.
- **Seed idempotente**: `npm run db:seed` cria roles (admin, sales_manager, representative,
  viewer) com permissões resource:action (ex.: `products:read`, `representatives:approve`).
- **Vitest 4 configurado**: 208 testes (rbac, cnpj, slug, job-id, db-error, permissions, phone),
  100% cobertura lógica pura; scripts test/test:watch/test:coverage.

### Onda 2: Portal UI + Workflows
- **Portal UI (MUI v9)**: tema dark/light centralizado em `src/core/theme` com tokens ROCO
  (cyan #3ec6f0, amber #f5a33c), InitColorSchemeScript sem FOUC, convive com Tailwind v4 via
  `@layer`.
- **Login Google**: redirect `/api/auth/signin`, callback validação de callbackUrl (anti-CSRF).
- **Shell (AppBar + Drawer)**: nav condicional por permissão, representantes vs admin.
- **Onboarding wizard** (5 passos): autosave em localStorage, upload de documentos presigned.
- **Review de representantes**: aprovar/rejeitar com guarda anti-auto-aprovação (audit log).
- **Route groups**: (site) = site público com WhatsApp/Mautic; (internal) = portal SEM tracking.

### Onda 3: API + Sincronização + Upload
- **tRPC v11**: routers products/representatives/sync, type-safe portal-side.
- **REST público**: `/api/products` + `/api/products/[slug]` (unstable_cache com revalidateTag).
- **Cloudflare R2**: presigned PUT (5min, validação contentType/size), confirm com headObject,
  prefixo key validado (anti-path-traversal); imagens públicas (R2_PUBLIC_URL), documentos
  privados (presigned GET).
- **BullMQ 6 + Redis**: fila erp-sync in-process (instrumentation.ts singleton), worker retry 3x
  backoff, DLQ; webhook `/api/webhooks/erp` (secret timing-safe, 202 + fila).
- **Importador catálogo**: `src/db/import/import-catalog.ts` (SheetJS via CDN tarball), lê
  docs/Dados Catalogo ROCO site_2026.xls (769 produtos Sheet1 + variantes), normalizações
  (EAN trim, NCM padStart, categorias, badges @3EM1→tres_em_um), idempotente, published=false.
- **CRUD produtos**: busca/filtros/cursor pagination, form embalagens múltiplas/badges/categorias,
  upload imagens presigned, integração R2.
- **Segurança (OWASP scan + fixes)**: Next 16.3.0 (CVE RCE+bypass middleware), CSP: R2 em
  connect-src/img-src sem afrouxar script-src 'self', JWT staleness resolvido, anti-auto-aprovação,
  audit log uploads, validação callbackUrl, npm audit --omit=dev = 0 vulns.

### Resoluções de Débitos
- **ESLint**: config flat nativo (eslint-config-next), sem FlatCompat; 3 erros legados corrigidos.
- **Test runner**: configurado (era débito de MVP).
- **i18n Portal**: namespace `portal` (~156 chaves) pt.json/en.json (árvores idênticas).

## Sessão Anterior (2026-08-04)
- **Tracking de visitantes via Mautic (`mtc.js`)**, no padrão de segurança já usado no formulário:
  - `public/vendor/mautic-tracking.js` — cópia verificada e self-hosted do `mtc.js`
    (SHA-256 `d4378644…`, 100.654 bytes; zero indicadores de ClickFix/ofuscação).
  - `src/shared/components/analytics/mautic-tracking.tsx` (+ `index.ts`) — instala a fila `mt`,
    carrega o script self-hosted e emite um pageview por `pathname` novo (App Router é SPA).
  - Montado em `src/app/[locale]/layout.tsx`.
  - CSP: **`script-src 'self'` mantido**; adicionado só `https://mautic.roco.com.br` ao `img-src`.
  - Flag `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED` (prod: on salvo `"false"`; dev: off salvo `"true"`).
  - `public/vendor/README.md` e `.env.example` documentados; decisão em `decisionLog.md`.
- Verificado: build verde; `/vendor/mautic-tracking.js` servido 200; CSP correta na resposta;
  `POST /mtc/event` → 200 com CORS completo; `mtracking.gif` → 200 `image/gif`.
- **Descoberta a resolver**: a allowlist de CORS do Mautic tem só `https://roco.com.br`. Como
  `roco.com.br` e `www.roco.com.br` ambos servem o site (nenhum canonicaliza), quem entra por `www`
  cai no pixel — o hit conta, mas os cookies `mtc_id`/`mtc_sid` não são gravados e a visita não é
  amarrada ao contato. Corrigir no Mautic (CORS Valid Domains) ou canonicalizar o host.

### Próximos Passos da Sessão Anterior (2026-08-04)
1. [ ] **Smoke test no navegador** (não executado — extensão do Chrome não conectada nesta sessão):
       abrir `/pt`, DevTools → Network filtrar `mtracking` (1 hit), navegar para `/pt/catalogo`
       (2º hit), Console sem violações de CSP, Application → Cookies com `mtc_id`/`mtc_sid`.
       Conferir no Mautic se as visitas aparecem.
2. [ ] **Liberar `www` no CORS do Mautic** (ou canonicalizar host) — ver "Descoberta" acima.
3. [ ] **Decidir LGPD**: manter tracking sem banner ou exigir opt-in (o `mtc.js` grava
       `mtc_id`/`mtc_sid`/`mautic_device_id` e identifica o visitante). Flag já permite desligar.
4. [ ] Confirmar fluxo dos 3 itens de contato: todos → Mautic id=1, ou "Ligamos pra você" → WhatsApp?
5. [ ] Revisar copy EN (provisório) com copywriter.
6. [ ] Corrigir config ESLint (circular structure).
7. [ ] Confirmar destino real de Produtos (`NEXT_PUBLIC_PRODUCTS_URL` vazio).

## Próximos Passos Prioritários
1. [ ] **Rate limiting** (ALTO): webhook `/api/webhooks/erp`, presign uploads, `/api/products`,
       login — implementar via @upstash/ratelimit sobre Redis existente.
2. [ ] **Provisionar infra**: Postgres + Redis (docker-compose pronto); credenciais Google OAuth;
       bucket R2 + env S3_*; AUTH_SECRET; aplicar migrations + seed + import-catalog em prod.
3. [ ] **Confirmar assunções de negócio com stakeholder**:
       - Produto pode ter N categorias (modelado N:N isPrimary)?
       - Preço fora do site ou sincronizado do ERP?
       - Importar universo completo ERP (1.254) ou só catálogo (769)?
       - Selos têm significado comercial oficial (badges)?
4. [ ] **Contrato do full-sync ERP**: worker trata webhook; full sync = not_implemented.
5. [ ] **Política LGPD**: tracking Mautic sem banner ainda (flag permite desligar).
6. [ ] **Liberar `https://www.roco.com.br` no CORS do Mautic** ou canonicalizar host (herdado 2026-08-04).

## Bloqueadores
- Credenciais Postgres + Redis (docker-compose pronto, faltam envs).
- Google OAuth credentials (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET).
- Confirmação de assunções de negócio (itens 3-4 acima).

## Decisões Pendentes (sessões anteriores)
- [ ] Três itens de contato (nav landing) → mesmo modal Mautic id=1 ou rotas distintas?
- [ ] "Ligamos pra você" → WhatsApp ou Mautic form?
