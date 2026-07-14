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

## Decisões Arquiteturais
Registradas em @memory-bank/decisionLog.md (nunca deletar entradas).
