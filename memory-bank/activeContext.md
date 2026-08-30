# Active Context — ROCO

## Sessão atual (2026-08-30)
Chrome de navegação do site público: escala tipográfica da nav, seletor de idioma PT/EN,
acesso direto ao login do portal e reorganização do rodapé — seguidos de uma revisão
adversarial cujos 4 achados confirmados foram corrigidos na mesma sessão.
Portões verdes: lint 0 erros (7 warnings pré-existentes em arquivos não tocados),
**976 testes** em 28 arquivos (baseline 934), build verde com `ƒ Proxy (Middleware)` registrado.
NÃO commitado — árvore suja de propósito.

## ⚠️ Verificação visual NÃO foi possível nesta sessão
A extensão do navegador estava desconectada: ninguém abriu a página, ninguém tirou print.
Tudo o que está afirmado sobre layout foi MEDIDO — larguras pelas métricas reais do arquivo
Inter servido pelo `next/font` (hmtx + HVAR), e o resto por `curl` + parse do HTML servido
por um dev server na porta 3512. **O julgamento estético continua pendente de olho humano**:
proporção da barra com 5 itens + 2 controles, respiro das duas bandas do rodapé, e se 14px
em caixa alta ficou pequeno demais para o gosto do stakeholder são coisas que só se decidem
olhando.

## Estado do repositório
- Branch: `feat/porta-mais-site` (não commitado; 68 commits à frente da `main` + esta árvore suja)
- Arquivos novos ainda untracked: `shared/components/nav/{language-switcher,portal-login-link}.tsx`,
  `shared/lib/locale-path.ts`, `shared/lib/{locale-path,phone}.test.ts`
- Container local em :3000 serve o código COMMITADO — não reflete este trabalho. Para ver o
  código novo é preciso `npm run dev` numa porta livre.

## Pending
- **Olhar no navegador** (stakeholder): barra, seletor de idioma, botão de login e rodapé
- merge `feat/porta-mais-site` → `main` + push
- seed em produção: `npm run db:seed` com `DATABASE_URL` de produção
- Provisionar RD Station API Key (+ campo `cf_origem` no painel) e Resend API Key
- Publicar o site em produção (main está 68 commits atrás)
