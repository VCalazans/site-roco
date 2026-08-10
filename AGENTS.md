# ROCO — Site Institucional

## O que é
Site institucional da **ROCO** (fabricante industrial brasileira). Fase atual: uma página
de espera ("Tem novidade chegando!") em pt-BR, sobre uma base Next.js pronta para evoluir
para o site completo (produtos, catálogo, contato).

## Status
- Fase: MVP — página "Em breve"
- Versão: 0.1.0
- Stack: Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · framer-motion

## Setup Rápido
```bash
# Instalar
npm install

# Configurar ambiente
cp .env.example .env.local   # ajuste os valores conforme necessário

# Rodar em desenvolvimento
npm run dev                  # http://localhost:3000  (redireciona para /pt)
```

## Estrutura de Pastas
```
src/
  app/                       # App Router
    layout.tsx               # layout raiz (fontes, metadata, <html lang>)
    page.tsx                 # redireciona "/" -> "/{locale}"
    globals.css              # Tailwind v4 + tokens de marca (@theme)
    robots.ts, sitemap.ts    # SEO
    [locale]/
      layout.tsx             # valida locale
      page.tsx               # renderiza a página "Em breve"
  core/
    config/metadata.ts       # metadata padrão / OpenGraph
    lib/utils.ts             # cn() (clsx + tailwind-merge)
  modules/
    landing/components/       # coming-soon-hero.tsx (a página)
  shared/components/          # componentes compartilhados (crescer aqui)
  i18n/
    config.ts                # locales: pt (padrão), en
    get-dictionary.ts        # carregamento tipado dos dicionários
    dictionaries/{pt,en}.json
middleware.ts                # resolve e prefixa o locale
public/images/hero/           # hero-scene.jpg + logo/wordmark (extraídos do .psd)
docs/documento               # .psd de referência do design (NÃO editar)
```

## Comandos
| Comando          | Descrição                                   |
|------------------|---------------------------------------------|
| `npm run dev`    | Servidor de desenvolvimento (Turbopack)     |
| `npm run build`  | Build de produção (output standalone)       |
| `npm run start`  | Sobe o build de produção                    |
| `npm run lint`   | ESLint (next/core-web-vitals + typescript)  |

## Convenções
- Copy visível SEMPRE nos dicionários i18n (`src/i18n/dictionaries/*.json`).
- Features novas em `src/modules/<feature>/`.
- Imports internos com alias `@/*`.
- Classes condicionais via `cn()`.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`…).

## Notas para Agentes de IA
- Arquivo mais importante do domínio visual: `src/modules/landing/components/coming-soon-hero.tsx` (comentário com as coordenadas extraídas do `.psd`).
- Fonte de verdade do design: `docs/documento` (`.psd`, 3224×1724) — **nunca editar**.
- Ponto de entrada de conteúdo: `src/i18n/dictionaries/pt.json`.
- Ordem de leitura de contexto: ver `CLAUDE.md` → seção Memory Bank.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
