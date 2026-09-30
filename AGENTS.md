# ROCO — Site Institucional e Portal ROCO

## O que é
Site institucional da **ROCO** (fabricante brasileira de soluções hidrossanitárias, hidráulicas e
para gás) e **Portal ROCO** (painel da equipe e dos representantes) — um único app Next.js com dois
route groups: `(site)` público em Tailwind e `(internal)` protegido em MUI.

## Status
- Fase: site completo + portal (spec 001 — marca, vitrine e painel — entregue em 2026-09-30).
- Stack: Next.js 16.3 · React 19.2 · TypeScript 5 · Tailwind CSS v4 · MUI 9 · tRPC 11 ·
  Drizzle + PostgreSQL · Auth.js 5 · BullMQ/Redis · Cloudflare R2.
- Contexto vivo, decisões e specs: `memory-bank/` (ordem de leitura no `CLAUDE.md`).

## Setup Rápido
```bash
npm install
cp .env.example .env.local           # ajuste banco/Redis/R2/Auth
docker compose up -d postgres redis  # localhost:5433 e localhost:6380
npm run db:migrate && npm run db:seed
npm run dev                          # http://localhost:3000  (redireciona para /pt)
```

## Estrutura de Pastas
```
src/
  proxy.ts                   # middleware: resolve/prefixa o locale e protege /portal e /admin
                             #   (TEM de ficar em src/ — ao lado de app/ — senão não roda)
  app/
    layout.tsx               # layout raiz (fontes, metadata, <html lang>)
    page.tsx                 # redireciona "/" -> "/{locale}"
    globals.css              # Tailwind v4 + tokens de marca (@theme)
    icon.png, apple-icon.png # favicon (convenção de arquivo do App Router)
    robots.ts, sitemap.ts    # SEO
    [locale]/
      (site)/                # SITE PÚBLICO (Tailwind): home, produtos, produtos/[slug],
                             #   orcamento, contato, catalogo, representantes
      (internal)/            # PORTAL (MUI): portal/{login, boas-vindas, onboarding, produtos,
                             #   pagina-inicial, hero, solicitacoes, representantes, materiais,
                             #   configuracoes, perfis} e admin/
    api/                     # Route Handlers: auth, contact (leads), products (catálogo
                             #   público), representatives/register, trpc, webhooks/erp,
                             #   health, portal/materials/[id]/download,
                             #   portal/products/images/[id]/download + images/zip
  modules/                   # uma pasta por feature (components/ + lib/ pura e testada)
    home/                    # seções da home + conteúdo editável (lib/home-content.ts)
    products/                # listagem com filtros, detalhe, galeria, paginação
    cart/                    # lista de orçamento (/orcamento)
    catalog/, contact/       # formulários de captura de lead
    representatives/         # pré-cadastro público
    portal/                  # telas do portal (shell, dashboard, produtos, home-content,
                             #   leads, materials, onboarding, roles, settings, welcome…)
  server/
    trpc/routers/            # API do portal (products, homeContent, leads, materials,
                             #   representatives, roles, siteSettings, heroSlides, sync…)
    lib/                     # server-only: catálogo público, leads, RD Station, e-mail,
                             #   busca SQL, rate limit, auditoria
  db/
    schema/                  # Drizzle (catalog, contact, materials, rbac, site-settings…)
    seed.ts                  # perfis/permissões + admin inicial (idempotente)
    import/                  # importadores de catálogo (planilha) e fotos (R2)
  core/                      # auth (Auth.js + RBAC), config (site/metadata), storage (R2),
                             #   queue (BullMQ), theme (MUI), trpc-client
  shared/
    components/              # UI compartilhada (nav, footer, product-card, carousel, cart…)
    lib/                     # libs puras compartilhadas (packaging, safe-href, cart-store…)
  i18n/                      # config, get-dictionary, dictionaries/{pt,en}.json
  types/                     # declarações globais (React canary)
drizzle/                     # migrations SQL + meta (rodam sozinhas no boot do container)
scripts/                     # migrate.mjs, docker-build.cmd, build-brand-assets.mjs, …
public/images/               # logos (logos/), home, produtos, hero
docs/                        # .psd de referência (NÃO editar), planilha do catálogo, marca/
memory-bank/                 # contexto do projeto, decisionLog e specs/
```

## Comandos
| Comando                     | Descrição                                            |
|-----------------------------|------------------------------------------------------|
| `npm run dev`               | Servidor de desenvolvimento (Turbopack)              |
| `npm run build`             | Build de produção (output standalone; valida tipos)  |
| `npm run start`             | Sobe o build de produção                             |
| `npm run lint`              | ESLint                                               |
| `npm run test`              | Vitest                                               |
| `npm run db:migrate`        | Aplica as migrations (drizzle-kit)                   |
| `npm run db:seed`           | Perfis, permissões e admin inicial (idempotente)     |
| `npm run db:seed:qa`        | Dados de teste (representante, imagens, materiais)   |
| `npm run db:import-catalog` | Importa o catálogo da planilha em `docs/`            |
| `npm run db:import-images`  | Sobe as fotos de produto para o R2                   |

## Convenções
- Copy visível SEMPRE nos dicionários i18n (`src/i18n/dictionaries/*.json`).
- Features novas em `src/modules/<feature>/`; lógica testável em `lib/` pura (sem I/O).
- Imports internos com alias `@/*`; classes condicionais via `cn()`.
- Toda mutação do portal passa por `permissionProcedure(resource, action)` + audit log.
- Links editáveis (CTAs) só passam por `isSafeHref`; arquivos privados do R2 nunca vão
  como URL presignada na página — use uma rota autenticada que gera o link no clique.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…).

## Notas para Agentes de IA
- Ordem de leitura de contexto: ver `CLAUDE.md` → seção Memory Bank; specs em `memory-bank/specs/`.
- Pontos de entrada: `src/i18n/dictionaries/pt.json` (conteúdo), `src/server/trpc/routers/_app.ts`
  (API do portal), `src/db/schema/` (dados), `src/modules/portal/lib/nav-items.ts` (menu por permissão).
- Permissão nova de módulo: seed E migration idempotente (ver `drizzle/0011_*`), senão o
  ambiente que não rodou o seed fica sem acesso.
- Fonte de verdade do design: `docs/documento` (`.psd`, 3224×1724) — **nunca editar**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
