---
description: Análise OWASP completa do site da ROCO com o subagente security
---

Invoque o sub-agente `security` para executar uma análise de segurança do site da ROCO:

$ARGUMENTS

O agente `security` deve revisar (sem modificar código):

1. **OWASP Top 10 Web 2025** — foco na stack Next.js 16 / React 19 estática:
   - Headers de segurança em `next.config.ts` (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
   - Cookie `NEXT_LOCALE` e matcher do `middleware.ts`
   - `dangerouslySetInnerHTML` em componentes
   - `npm audit` / `npm outdated` para CVEs
2. **OWASP Agentic AI Top 10 2026** — permissões dos sub-agentes em `.claude/agents/*.md`, escopo do MCP do `notifier`
3. **Secrets** — grep por chaves/tokens hardcoded em `src/` e `public/`; confirmar que só `NEXT_PUBLIC_*` é usado no client
4. **LGPD** — quando houver formulários de contato, checar consentimento e tratamento de dados

Saída obrigatória por severidade: 🔴 Crítico / 🟠 Alto / 🟡 Médio / 🔵 Informativo, mais "✅ O que está bem implementado" e "🔧 Top 5 ações imediatas".

Ao final, o `security` deve instruir o `docs` a registrar os riscos em `memory-bank/progress.md`.
