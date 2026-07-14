---
description: Pesquisa documentação, libs, padrões ou soluções na web para o site da ROCO
---

Use o sub-agente `researcher` para pesquisar: $ARGUMENTS

O `researcher` deve:
1. Buscar com WebSearch — query específica + ano atual (2026) + a tecnologia do projeto (Next.js 16, React 19, Tailwind v4, framer-motion)
2. Identificar 2-3 melhores fontes (documentação oficial > GitHub oficial > artigos recentes)
3. Usar WebFetch para ler cada fonte completa — nunca citar sem ter lido
4. Retornar relatório com: recomendação principal, alternativas, exemplo de código aplicável à stack da ROCO, e fontes com data
5. Instruir o `docs` a registrar fontes e decisão em `memory-bank/decisionLog.md`

Exemplos de uso:
/research melhor padrão de i18n em Next.js 16 App Router com middleware custom
/research Tailwind CSS v4 @theme tokens vs tailwind.config migração 2026
/research framer-motion server components App Router boas práticas
