# CLAUDE.md — ROCO (site institucional)
> Versão: 0.1.0 | Criado: 2026-07-13 | Atualizado: 2026-10-13 | Fase: site completo + Portal ROCO

## 🎯 Contexto do Projeto
Site institucional da **ROCO**, fabricante industrial brasileira, e **Portal ROCO** (painel da
equipe e dos representantes) — um único app Next.js. Site público (pt/en): home editável pelo
painel, catálogo de produtos, orçamento, contato, catálogo PDF e pré-cadastro de representantes.
Portal: produtos, página inicial, hero, solicitações (leads), representantes (área de atuação pela
base do IBGE), materiais, configurações e perfis/permissões; contas com confirmação de e-mail e
redefinição de senha por link (SMTP). Specs de feature em `memory-bank/specs/`.

## 🧠 Memory Bank — Carregar Sempre
Leia no início de cada sessão, nesta ordem:
1. @memory-bank/projectBrief.md    → objetivo e escopo
2. @memory-bank/productContext.md  → contexto de produto e fluxos
3. @memory-bank/systemPatterns.md  → arquitetura e padrões
4. @memory-bank/techContext.md     → stack, comandos e setup
5. @memory-bank/decisionLog.md     → decisões arquiteturais (nunca deletar entradas)
6. @memory-bank/activeContext.md   → o que está sendo feito agora
7. @memory-bank/progress.md        → progresso, backlog e débitos

Ao finalizar implementações, instrua o subagente `docs` a atualizar o memory bank.

## 🏗️ Arquitetura
Next.js App Router + i18n por middleware (`[locale]`), organização modular:

```
src/
  app/            → App Router: [locale]/(site) público · [locale]/(internal) portal · api/*
  core/           → auth (RBAC), config, storage (R2), queue, theme (MUI), trpc-client
  modules/<feat>/ → features isoladas (home, products, cart, portal, …)
  server/         → routers tRPC e libs server-only
  db/             → schema Drizzle, seed, importadores
  shared/         → componentes e libs compartilhados
  i18n/           → config, get-dictionary, dictionaries/{pt,en}.json
  proxy.ts        → middleware: resolve locale e protege /portal (fica em src/, ao lado de app/)
  instrumentation.ts → hook de boot: sobe o worker BullMQ do ERP (também fica em src/)
```
Detalhes: @memory-bank/systemPatterns.md

## ⚡ Stack & Comandos
- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5** (strict)
- **Tailwind CSS v4** via `@theme` em `src/app/globals.css` (sem `tailwind.config`)
- **framer-motion** (animações) · **lucide-react** (ícones) · **clsx + tailwind-merge** (`cn`)
- i18n próprio (pt padrão, en) — `src/i18n`
- Comandos: `npm run dev` · `npm run build` · `npm run start` · `npm run lint`
- Setup completo: @memory-bank/techContext.md

## 📐 Regras Fundamentais — Não Negociáveis
1. Todo texto visível vem dos **dicionários i18n** (`src/i18n/dictionaries/*.json`) — nunca hardcode copy nos componentes.
2. Novas features vivem em `src/modules/<feature>/` — não engorde `src/app`.
3. Imports internos usam o alias `@/*` — nunca caminhos relativos longos (`../../../`).
4. Classes utilitárias condicionais passam por `cn()` (`@/core/lib/utils`).
5. Cores/tokens de marca só via variáveis do `@theme`/`:root` em `globals.css` — nunca hex soltos repetidos.
6. Imagens sempre via `next/image` com `alt` vindo do dicionário.
7. `page.tsx`/`layout.tsx` de `[locale]` validam o locale (`notFound()` se inválido).
8. Componentes com animação/estado são `"use client"`; dados e i18n resolvem no server.
9. Variáveis públicas via `process.env.NEXT_PUBLIC_*`; segredos nunca no client.
10. Conteúdo da home é editável no portal: o texto padrão fica no dicionário e o que o operador sobrescreve fica em `site_settings` (`home.*`) — ver `src/modules/home/lib/home-content.ts`; o hero são os slides de `hero_slides`.

## 🔐 Segurança
- Headers de segurança em `next.config.ts` (HSTS, X-Frame-Options, nosniff, Referrer-Policy).
- Nunca commitar `.env`. Use `.env.example` como referência.
- Validar/escapar qualquer input antes de submeter formulários (fase futura).
- Anti-robô: Cloudflare Turnstile nos formulários públicos e nas telas de conta (`TURNSTILE_SECRET_KEY` em runtime;
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no build). Detalhes em @memory-bank/techContext.md.
- IP do visitante só por `getClientIp`/`resolveClientIp` (`src/server/lib/rate-limit.ts`); nunca limitar pelo `x-forwarded-for` cru.

## 🤖 Subagentes & Delegação
- `architect` → features end-to-end e decisões multi-camada
- `frontend` → componentes React/Tailwind, páginas, i18n
- `backend`  → rotas de API, integrações (fase futura)
- `tester`   → testes e verificação
- `security` → revisão OWASP antes de merges de produção
- `docs`     → atualização do memory bank e documentação
- `researcher` → pesquisa web (WebSearch + WebFetch) de libs/padrões
- `copywriter` → textos de marketing pt-BR/en
- `devops`   → Docker, CI/CD, deploy
- `notifier` → alertas WhatsApp via MCP (apenas quando solicitado)

## 🔌 MCP
- `archicode-whatsapp` (SSE, sem auth): https://work.archicode.com.br/mcp-test/5b4500a6-d4ff-48d2-938f-ceb0bdbd010e

## 🚫 Proibições Absolutas
- Nunca hardcodar copy visível fora dos dicionários i18n.
- Nunca commitar com `npm run build` quebrado.
- Nunca introduzir `tailwind.config.js` (o projeto é Tailwind v4 com `@theme`).
- Nunca acessar segredos no client nem expô-los em logs/response.
- Nunca editar `docs/documento` (é o `.psd` de referência do design).

## ⚠️ Armadilhas Desta Stack
- Tailwind v4: sem `tailwind.config`; tokens e cores ficam em `@theme` no `globals.css`.
- Next 16: `params` de rotas é **assíncrono** (`await params`).
- `next/font` injeta variáveis CSS (`--font-inter`, `--font-poppins`) usadas pelo `@theme`.
- `src/proxy.ts` precisa ficar em `src/` (ao lado de `app/`): na raiz do repo ele compila mas NUNCA roda.
- Rota nova na RAIZ (fora de `[locale]`, ex.: `/mcp`): entrar em `ROOT_ROUTES` e no matcher do `src/proxy.ts`; senão ela é redirecionada para `/{locale}/...`.
- `src/instrumentation.ts` também precisa ficar em `src/`: na raiz, o worker do ERP nunca sobe no standalone e nada avisa (`/api/health` com token mostra `workers.running: false`, `not-initialized`).
- Permissão nova de módulo: seed E migration idempotente (ex.: `drizzle/0011_*`) — o seed não roda no boot.
- O header do site vive no layout `(site)` (não remonta entre páginas); páginas não renderizam `SiteHeader`.
- Route Handler que redireciona para o próprio site: `Location` relativa — no standalone (Docker) `request.nextUrl.origin` vira `http://0.0.0.0:3000`.
- Objeto do R2 em stream que pode ser cancelado (download): nunca `transformToWebStream()` (= `Readable.toWeb`) — cancelado com leitura agendada, faz `enqueue` num controller fechado e solta `uncaughtException` (`ERR_INVALID_STATE`). Use `getObjectStream`/`toPullStream` (`src/core/storage/`).
- No host, `npm run db:migrate` sai com código 1 sem mensagem: o `drizzle.config.ts` não lê o `.env.local`. Migre com `node --env-file=.env.local scripts/migrate.mjs`.
- Contas de usuário dependem de e-mail: sem SMTP (`SMTP_*`, `MAIL_FROM`) em produção ninguém confirma pré-cadastro nem redefine senha; Google oculto por padrão (`AUTH_GOOGLE_ENABLED=false`).
- SMTP (Hostinger): `MAIL_FROM` tem de ser a própria caixa do `SMTP_USER` (senão `553 not owned by user`); a homologação bloqueia a porta 465 — use 587 com STARTTLS; senha com `#` entre aspas no `.env`; mudou o `.env` local → `docker compose up -d --no-build web`.
- Arquivos: R2 ou MinIO pelo mesmo cliente (`src/core/storage/s3-config.ts`); `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` também são BUILD-TIME (CSP `connect-src`) — trocou o endpoint, rebuild. Os nomes `R2_*` (credenciais, bucket, URL pública) valem para qualquer provedor. Produção: MinIO em `https://s3.roco.com.br`, público em `https://midia.roco.com.br/roco-site`.
- MinIO atrás da Cloudflare: sem a Cache Rule "Ignorar cache" em `s3.roco.com.br`, a Cloudflare troca HEAD por GET em `.png`/`.pdf` e a assinatura S3 dá 403 (todo confirm de upload falha). O proxy gratuito barra corpo acima de 100 MB: vídeos até 95 MB.
- Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` é BUILD-TIME (build-arg; mudar = rebuild) e `TURNSTILE_SECRET_KEY` é runtime. As duas
  andam juntas: segredo com build sem site key recusa TODO envio, inclusive o login; site key sem segredo desliga a verificação
  no servidor (só um aviso no log).
- Rota pública nova de formulário ou conta: exigir Turnstile (ação em `TURNSTILE_ACTIONS`) antes do schema, limite por IP e
  entrada na regra de rate limiting da Cloudflare (o plano Free tem uma única regra; hoje cobre `/api/contact`,
  `/api/representatives/register`, `/pt|en/portal/login`, `/api/auth/callback/credentials` e `/api/account/*`).
