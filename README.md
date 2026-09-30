# ROCO — Site Institucional e Portal ROCO

Site institucional da **ROCO** (fabricante brasileira de soluções hidrossanitárias, hidráulicas
e para gás) e **Portal ROCO**, o painel da equipe e dos representantes — um único app Next.js.

- **Site público** (pt/en): home editável pelo painel (hero em vídeo, fachada, institucional,
  categorias, vitrine de destaques/campeões de vendas), catálogo de produtos com busca e filtros,
  detalhe do produto com todas as embalagens, lista de orçamento, contato, download do catálogo e
  pré-cadastro de representantes.
- **Portal** (`/{locale}/portal`): painel com indicadores, produtos (embalagens, fotos, destaque e
  campeão de vendas), página inicial do site, hero, solicitações recebidas (leads), representantes,
  materiais de apoio (biblioteca por assunto para o representante), configurações e perfis/permissões.

## 🚀 Quick Start
```bash
npm install
cp .env.example .env.local           # banco, Redis, R2 e Auth — ver comentários do arquivo
docker compose up -d postgres redis  # Postgres em localhost:5433, Redis em localhost:6380
npm run db:migrate && npm run db:seed
npm run dev                          # http://localhost:3000 (redireciona para /pt)
```

## 📋 Requisitos
- Node.js 22+ · npm 9+
- Docker (Postgres 17 e Redis 8 locais; imagem de produção do app)

## 🏗️ Stack
| Tecnologia               | Versão      | Propósito                                        |
|--------------------------|-------------|--------------------------------------------------|
| Next.js                  | 16.3        | App Router, Turbopack, `output: standalone`      |
| React                    | 19.2        | UI (inclui View Transitions no site)             |
| TypeScript               | 5           | Tipagem estática (strict)                        |
| Tailwind CSS             | 4           | Site público (tokens em `@theme`, sem config)    |
| MUI                      | 9           | Portal (tema claro/escuro centralizado)          |
| tRPC + TanStack Query    | 11 · 5      | API interna tipada do portal                     |
| Drizzle ORM + PostgreSQL | 0.45 · 17   | Dados e migrations                               |
| Auth.js                  | 5 (beta)    | Login Google e e-mail/senha; RBAC por permissão  |
| BullMQ + Redis           | 6 · 8       | Fila do sync com o ERP e rate limit              |
| Cloudflare R2            | —           | Imagens e arquivos (upload presigned)            |
| Vitest                   | 4           | Testes                                           |

## 📁 Estrutura
Resumo — o mapa completo, com o papel de cada pasta, fica no [`AGENTS.md`](AGENTS.md).
```
src/app          → rotas: [locale]/(site) público · [locale]/(internal) portal · api/*
src/modules      → features: home, products, cart (orçamento), catalog, contact, representatives, portal
src/server       → routers tRPC e libs server-only (catálogo público, leads, RD Station, e-mail…)
src/db           → schema Drizzle, seed e importadores (catálogo, fotos)
src/core         → auth, config, storage (R2), fila, tema MUI, cliente tRPC
src/shared       → componentes e libs compartilhados entre site e portal
src/i18n         → dicionários pt/en (todo texto visível)
src/proxy.ts     → middleware: locale + proteção do portal
drizzle/         → migrations SQL (aplicadas sozinhas no boot do container)
memory-bank/     → contexto, decisões (decisionLog) e specs de feature (memory-bank/specs)
```

## 🧰 Comandos
| Comando                     | Descrição                                                   |
|-----------------------------|-------------------------------------------------------------|
| `npm run dev`               | Desenvolvimento (Turbopack, hot reload)                     |
| `npm run build`             | Build de produção (valida tipos)                            |
| `npm run lint`              | ESLint                                                      |
| `npm run test`              | Testes (Vitest)                                             |
| `npm run db:migrate`        | Aplica as migrations no banco do `DATABASE_URL`             |
| `npm run db:seed`           | Perfis, permissões, admin inicial e dados do site (idempotente) |
| `npm run db:seed:qa`        | Dados de teste (representante, imagens, materiais; só localhost) |
| `npm run db:import-catalog` | Importa o catálogo da planilha em `docs/`                   |
| `npm run db:import-images`  | Sobe as fotos de produto para o R2                          |

## 🌐 Internacionalização
- Locales: **pt** (padrão) e **en**; todo texto vem de `src/i18n/dictionaries/{pt,en}.json`.
- O locale é resolvido em `src/proxy.ts` (cookie `NEXT_LOCALE` / `Accept-Language`) e prefixado na rota.

## 🐳 Deploy
- `Dockerfile` multi-stage (standalone). No Windows, gere a imagem com `scripts\docker-build.cmd`
  e suba com `docker compose up -d --no-build web` (o BuildKit do Windows falha com `[locale]`/`(site)`).
- As migrations rodam sozinhas no boot do container (`scripts/migrate.mjs`, com advisory lock).
- Runbook completo de produção (variáveis, carga inicial, health check): `memory-bank/techContext.md`.

## 🤝 Contribuindo
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…).
- Copy visível apenas nos dicionários i18n; imports internos com `@/*`.
- Rode `npm run lint`, `npm run test` e `npm run build` antes de abrir PR.
- Decisões arquiteturais em `memory-bank/decisionLog.md`; specs de feature em `memory-bank/specs/`.

## 🎨 Design e marca
- Layout de referência: `docs/documento` (`.psd`, 3224×1724). **Não edite o `.psd`.**
- Logos: originais em `docs/marca/logos-originais/`; as versões usadas no site/portal
  (`public/images/logos/`) e o favicon (`src/app/icon.png`, `apple-icon.png`) são geradas por
  `node scripts/build-brand-assets.mjs`.

## 📄 Licença
Proprietário — © 2026 ROCO. Todos os direitos reservados.
