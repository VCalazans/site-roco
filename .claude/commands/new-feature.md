---
description: Feature end-to-end do site da ROCO orquestrada pelo architect
---

Invoque o sub-agente `architect` para conduzir, do início ao fim, a seguinte feature do site da ROCO:

$ARGUMENTS

O `architect` deve orquestrar (sem escrever código diretamente):

1. **Análise** — ler `@memory-bank/decisionLog.md`, `activeContext.md` e `systemPatterns.md`; mapear as camadas afetadas (landing, i18n, config, infra)
2. **Decisão** — se houver escolha arquitetural nova, instruir `docs` a registrar em `decisionLog.md` ANTES de implementar; usar `researcher` se precisar de fundamentação
3. **Copy** — se a feature tem textos novos, instruir `copywriter` a produzir pt-BR + EN e alimentar `src/i18n/dictionaries/{pt,en}.json`
4. **Implementação** — delegar a `frontend` (componentes/seções/páginas) e a `backend` (Route Handlers/Server Actions, se houver)
5. **Testes** — instruir `tester` a cobrir o código implementado
6. **Segurança** — instruir `security` para revisão OWASP + secrets + LGPD
7. **Documentação** — instruir `docs` a atualizar `activeContext.md` e `progress.md`
8. **Finalização** — só declarar concluído após `tester` e `security` confirmarem

Restrições permanentes do projeto:
- Toda string de UI vai para os dois dicionários i18n (`pt.json` e `en.json`) — nunca hardcode
- Páginas em `src/app/[locale]/` exportam `generateStaticParams` (SSG)
- Server Components por padrão; `"use client"` só quando necessário
