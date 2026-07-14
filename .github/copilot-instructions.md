# Copilot Instructions — Site ROCO
> Criado: 2026-07-13 | Fase: MVP (holding page → site de marketing)

## 🎯 Contexto do Projeto
Site institucional da **ROCO**, fabricante industrial brasileira. Hoje é uma **holding page** ("Tem novidade chegando!"), construída para crescer em um site de marketing completo (produtos, catálogo, contato). Bilíngue pt-BR (padrão) + EN.

## 📚 Memory Bank — Carregar sempre
Antes de qualquer tarefa, leia nesta ordem:
1. @memory-bank/projectBrief.md → objetivo e escopo
2. @memory-bank/systemPatterns.md → arquitetura e padrões
3. @memory-bank/techContext.md → stack e comandos
4. @memory-bank/decisionLog.md → decisões arquiteturais tomadas
5. @memory-bank/activeContext.md → foco atual
6. @memory-bank/progress.md → progresso e débitos

Ao finalizar tarefas complexas: instrua **@docs** para atualizar activeContext.md, progress.md e decisionLog.md.

## 🏗️ Arquitetura
```
┌──────────────────────────────────────────────────────┐
│                MIDDLEWARE (i18n) — raiz               │
│   middleware.ts → detecta locale (cookie NEXT_LOCALE  │
│   + accept-language) → redireciona /pt ou /en         │
├──────────────────────────────────────────────────────┤
│                     APP ROUTER (SSG)                  │
│  src/app/                                             │
│  ├── [locale]/                                        │
│  │   ├── layout.tsx                                   │
│  │   └── page.tsx        ← holding (ComingSoonHero)   │
│  ├── layout.tsx  robots.ts  sitemap.ts                │
│  └── (futuro) api/       ← Route Handlers             │
├──────────────────────────────────────────────────────┤
│  src/modules/<feature>/components/  ← seções          │
│  src/shared/components/             ← UI compartilhada│
│  src/core/config/ + lib/            ← config + cn()   │
│  src/i18n/                          ← dicionários pt/en│
├──────────────────────────────────────────────────────┤
│         next build --output standalone (Docker)      │
└──────────────────────────────────────────────────────┘
```
**Padrão:** App Router com i18n via middleware custom, Server Components por padrão, SSG para ambos os locales. Componentes por domínio em `src/modules/<feature>/components`.

## ⚡ Stack & Comandos
- **Next.js** 16.0.3 (App Router + Turbopack) | **React** 19.2.0 | **TypeScript** 5 (strict)
- **Tailwind CSS** v4 (tokens no `@theme` de `src/app/globals.css`, SEM `tailwind.config`)
- **framer-motion** 12 | **lucide-react** | **clsx** + **tailwind-merge** (`cn`)
- `npm run dev` — servidor local (localhost:3000)
- `npm run build` — build de produção (standalone)
- `npm run start` — servidor de produção
- `npm run lint` — ESLint (eslint-config-next)

## 📐 Padrões Obrigatórios
1. **Server Components por padrão** — `"use client"` só para interatividade (`useState`, event handlers) ou `framer-motion`
2. **Imports com alias** — sempre `@/*` para `src/` (ex.: `import { cn } from "@/core/lib/utils"`)
3. **i18n via dicionários** — todo texto de UI vem de `src/i18n/dictionaries/{pt,en}.json`. Nunca hardcode strings
4. **Paridade de chaves** — toda chave nova entra em `pt.json` E `en.json`
5. **Componentes tipados** — props com sufixo `Props`; usar o tipo `Dictionary` de `src/i18n/get-dictionary.ts`
6. **Tailwind utility-first** — sem CSS modules; classes condicionais via `cn()`; tokens neon (cyan/amber) e utilitários `.text-glow-*`, `.btn-neon`
7. **SSG** — páginas em `[locale]/` exportam `generateStaticParams` com `locales` de `@/i18n/config` (usar `dynamicParams = false`)
8. **Seções** — novas seções em `src/modules/<feature>/components/` com sufixo `-section.tsx`

## 🔐 Regras de Segurança
1. **Secrets em env vars** — nunca no código; `NEXT_PUBLIC_*` só para valores públicos (ver `.env.example`)
2. **Security headers ativos** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy em `next.config.ts`. Nunca remover/enfraquecer
3. **Sem `dangerouslySetInnerHTML`** sem sanitização explícita
4. **CORS/CSP** — ao adicionar APIs, nunca `Access-Control-Allow-Origin: *`; avaliar CSP para scripts de terceiros
5. **LGPD** — formulários de contato exigem consentimento claro; nunca prometer "segurança total"

## 🚫 Nunca Fazer
1. Commitar `.env`, `.env.local` ou `.env.production` com secrets reais
2. Remover ou enfraquecer os security headers de `next.config.ts`
3. Hardcodar textos de UI — sempre dicionários i18n
4. Criar Client Components desnecessários — Server Components são o padrão
5. Mover o `middleware.ts` da raiz para dentro de `src/` — quebra o roteamento de locales
6. Criar `tailwind.config.*` — a config vive no `@theme` de `src/app/globals.css`
7. Expor stack traces, versões ou IDs internos em respostas de API

## 🤖 Agentes Disponíveis (Copilot NÃO tem auto-delegação — chame por @nome)
- **@architect** → orquestrador de features end-to-end e refatorações multi-camada
- **@frontend** → componentes React/Tailwind, seções, páginas, i18n, animações
- **@backend** → Route Handlers, Server Actions, integrações server-side
- **@tester** → testes e cobertura (leitura apenas em código de produção)
- **@security** → análise OWASP + Agentic + LGPD (nunca modifica código)
- **@docs** → memory bank e documentação (opera apenas em `.md`)
- **@researcher** → pesquisa web de libs, padrões e soluções (usar `#fetch [url]`)
- **@copywriter** → copy bilíngue pt-BR/EN para os dicionários i18n
- **@devops** → Docker, CI/CD (GitHub Actions), deploy standalone
- **@notifier** → alertas WhatsApp via MCP (apenas quando explicitamente pedido)

## 📡 MCP Configurado
`archicode-whatsapp` — WhatsApp sem autenticação (SSE)
URL: https://work.archicode.com.br/mcp-test/5b4500a6-d4ff-48d2-938f-ceb0bdbd010e
Disponível no **@notifier**. Usar SOMENTE quando explicitamente solicitado.

## ⚠️ Armadilhas Desta Stack
1. **middleware.ts na raiz** — fica na raiz, NÃO em `src/`. Mover quebra o roteamento de locales
2. **Sem tailwind.config** — Tailwind v4 usa `@theme` em `src/app/globals.css`; tokens são `--neon-cyan`, `--neon-amber`, `font-display`, `font-sans`
3. **params é Promise** — em Next.js 16, `params` é assíncrono: `const { locale } = await params`
4. **ComingSoonHero é aspect-locked** — `src/modules/landing/components/coming-soon-hero.tsx` alinha overlay traduzível sobre um render `.jpg`; as coordenadas `POS` são percentuais medidas do canvas 3224×1724
5. **server-only no get-dictionary** — `src/i18n/get-dictionary.ts` importa `server-only`; nunca chamar de Client Component
