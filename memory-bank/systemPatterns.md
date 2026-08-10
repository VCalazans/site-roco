# System Patterns — ROCO
> Atualizar quando houver mudança arquitetural.

## Arquitetura Geral
Next.js App Router + i18n por middleware, organização **modular por feature**.

```
Request → middleware.ts (resolve locale, prefixa /{locale})
        → app/[locale]/page.tsx (server: valida locale, carrega dicionário)
        → modules/landing/components/coming-soon-hero.tsx (client: render + animação)
```

## Padrão Arquitetural
**Monólito modular** com separação por responsabilidade:
- `app/`     → roteamento, layouts, SEO (thin — orquestra, não implementa regra).
- `core/`    → configuração e utilitários transversais (metadata, `cn`).
- `modules/` → features isoladas e autocontidas (`landing/`, e futuras).
- `shared/`  → componentes reutilizáveis entre módulos (layout, forms, i18n UI).
- `i18n/`    → configuração de locales e dicionários tipados.

## Estrutura de Pastas
Ver @AGENTS.md (seção "Estrutura de Pastas") — fonte única para evitar divergência.

## Como Criar uma Nova Feature/Página
1. Crie `src/modules/<feature>/components/…` (componentes da feature).
2. Adicione as chaves de texto em `src/i18n/dictionaries/pt.json` e `en.json`.
3. Crie a rota em `src/app/[locale]/<rota>/page.tsx` (valide o locale, carregue o dicionário).
4. Reaproveite layout/estruturas de `src/shared/components/`.
5. Atualize `sitemap.ts` se for uma rota pública.
6. `npm run lint` + `npm run build` antes de commitar.

## Padrões de Código
- **i18n first**: nada de copy hardcoded; tudo vem do dicionário (tipado via `Dictionary`).
- **Server/Client**: dados e i18n no server; interatividade/animação em `"use client"`.
- **Estilo**: Tailwind v4 (`@theme` em `globals.css`); tokens de marca como CSS vars.
  Classes condicionais via `cn()` (`@/core/lib/utils`).
- **Imagens**: `next/image`, `alt` do dicionário, `priority` só no LCP.
- **Alias**: imports internos com `@/*`.

## Fluxo de Dados (i18n)
`params.locale` → `getDictionary(locale)` → props tipadas para os componentes.
Locale persiste em cookie `NEXT_LOCALE` (30 dias), setado pelo middleware.

## Portal Interno (CRM) — Padrões
### Route Groups: (site) vs (internal)
- **(site)**: `/pt`, `/en`, `/pt/catalogo`, etc. — público, renderiza `MauticTrackingProvider`.
- **(internal)**: `/portal/*`, `/admin/*` — privado (auth guard em proxy.ts), SEM tracking.
Isolação por pasta permitiu convivência Tailwind (site) + MUI (portal).

### Autenticação & Middleware (proxy.ts)
```
Request → proxy.ts (Node runtime)
        → params.locale resolva (cookie/Accept-Language)
        → (site) → passa
        → (internal) → requer sessão (redirect /api/auth/signin)
        → (internal) + role check → passa ou rejeita (403)
```
**`requireAuth()`** (helper em `src/core/auth/rbac.ts`): retorna `session` ou redireciona.
**`withRBAC(permission)`** (procedure factory tRPC): valida permissão antes de executar.

### Padrão RBAC
- Tabelas: roles → role_permissions → permissions (resource + action).
- Exemplo permissões: `"products:read"`, `"products:create"`, `"products:delete"`,
  `"representatives:approve"`, `"audit_logs:read"`.
- Checagem client-side (`can()` no dicionário): **UX only** (validação real no server).
- Server-side: procedures tRPC wrapped com `withRBAC("resource:action")` —
  rejeita request se user não tem permissão.
- Session carrega array de permissões do JWT (atualizado a cada 5min via revalidação).

### Uploads Presigned (2-step)
1. **Presign (frontend → backend)**:
   ```
   POST /api/uploads/presign { filename, contentType, size, productId }
   ← { presignedUrl, uploadId }
   ```
   - Valida: contentType (image/* ou application/pdf), size (max 10MB), produtoId existe.
   - Valida prefixo de key (`/products/{productId}/…`) — anti path-traversal.
   - Gera presigned PUT (5min TTL) para R2.

2. **Upload (browser → R2)**: browser PUTs arquivo direto.

3. **Confirm (frontend → backend)**:
   ```
   POST /api/uploads/confirm { uploadId, productId }
   ```
   - HEAD object no R2 (valida que arquivo existe).
   - INSERT na tabela product_images.
   - Retorna URL pública (para imagens) ou presigned GET (para documentos privados).

**Antipadrão evitado**: upload proxy pelo servidor (banda, latência).

### MUI + Tailwind: Coexistência
- **MUI**: `src/core/theme` (theme único, CSS variables, `@mui/material-nextjs` com
  InitColorSchemeScript). Componentes Portal isolados em `src/app/[locale]/(internal)/`.
- **Tailwind**: Site público em `src/app/[locale]/(site)/` + shared components.
- **CSS Layers**: MUI usa `@layer`, Tailwind v4 @theme via layers — sem conflito de especificidade.
- **Tokens**: marca ROCO (cyan, amber) definidos em ambos (MUI theme + Tailwind @theme).

### Fluxo de Dados — Portal (tRPC + REST)
```
Portal (client)
  → tRPC v11 (procedures tipadas, withRBAC)
  → src/server/trpc (routers: products, representatives, sync)
  → Drizzle queries (type-safe)
  → Postgres

Site Público
  → /api/products (Route Handlers REST)
  → unstable_cache + revalidateTag("products")
  → Drizzle queries (mesmo banco)
  → Postgres
```
**Mutação invalidação**: tRPC mutation chama `revalidateTag("products")` →
Next reavalia Route Handlers → cache reset → paginas/ISR refazem.

### Padrão Server Actions (futuro)
Se necessário (form simples, arquivo pequeno): `"use server"` + `cookies()` para auth.
Hoje: tRPC é suficiente para a complexidade (queries type-safe, RBAC, streaming).

## Decisões Arquiteturais
Registradas em @memory-bank/decisionLog.md (nunca deletar entradas).
