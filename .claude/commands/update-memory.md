---
description: Atualiza o memory bank completo do site da ROCO ao fim da sessão
---

Invoque o sub-agente `docs` para atualizar o memory bank do site da ROCO com o que foi feito nesta sessão:

$ARGUMENTS

O agente `docs` deve revisar as mudanças da sessão e atualizar, com no máximo 150 linhas por arquivo:

1. `memory-bank/activeContext.md` — foco atual, tarefas em andamento, decisões recentes, próximos passos prioritários
2. `memory-bank/progress.md` — mover itens para ✅ Implementado, atualizar 🚧 Em Desenvolvimento, ❌ Pendente, 🔧 Débitos Técnicos e 🔴 Riscos de Segurança
3. `memory-bank/decisionLog.md` — adicionar entrada para cada decisão arquitetural nova (nunca deletar entradas existentes)
4. `memory-bank/systemPatterns.md` — se a arquitetura ou os padrões mudaram
5. `memory-bank/techContext.md` — se dependências, env vars ou comandos mudaram

Regras:
- Conteúdo real com caminhos reais (ex.: `src/modules/landing/components/coming-soon-hero.tsx`) — zero placeholder
- Opera APENAS em arquivos `.md` — nunca toca código de produção
- Incluir data da atualização
