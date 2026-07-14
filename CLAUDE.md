# CLAUDE.md — ROCO (site institucional)
> Versão: 0.1.0 | Criado: 2026-07-13 | Fase: MVP (página "Em breve")

## 🎯 Contexto do Projeto
Site institucional da **ROCO**, fabricante industrial brasileira. Nesta fase o site é
uma **página de espera ("Tem novidade chegando!")** em pt-BR, construída sobre uma base
Next.js completa, pronta para crescer para o site definitivo (produtos, catálogo, contato).

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
  app/            → App Router: layout raiz, [locale], robots, sitemap, globals.css
  core/           → config (metadata) e lib (cn, utilitários)
  modules/<feat>/ → features isoladas (ex.: landing/components)
  shared/         → componentes compartilhados (layout, forms, i18n UI)
  i18n/           → config, get-dictionary, dictionaries/{pt,en}.json
middleware.ts     → resolve locale (cookie/Accept-Language) e prefixa a rota
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
10. Coordenadas/medidas da hero foram extraídas do `.psd` — ver comentário em `coming-soon-hero.tsx` antes de mexer no layout.

## 🔐 Segurança
- Headers de segurança em `next.config.ts` (HSTS, X-Frame-Options, nosniff, Referrer-Policy).
- Nunca commitar `.env`. Use `.env.example` como referência.
- Validar/escapar qualquer input antes de submeter formulários (fase futura).

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
- A hero desktop usa uma caixa com `aspect-[3224/1724]` + `containerType: inline-size`; textos escalam em `cqw`. Não troque para `object-cover` recortado sem reavaliar o alinhamento.
