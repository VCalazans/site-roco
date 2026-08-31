# Active Context — ROCO

## Sessão atual (2026-08-30)
Carrinho de cotação multi-produto: implementação, testes, revisão de segurança e consolidação.
**CONCLUÍDA, testada, revisada e APROVADA pelo stakeholder no navegador.** Portões verdes:
lint 0 erros, **1098 testes** em 30 arquivos (+122, baseline 976), build verde com
`ƒ /[locale]/carrinho` no manifest. **Zero regressão**. Commitado e pushado.

## Verificação de ponta a ponta (container local, build de produção)
Migration `0009` aplicada; imagem rebuildada e container recriado. Envio real de carrinho com
DOIS slugs válidos + UM inventado gravou **2 itens** (o inventado caiu fora, como projetado),
com `product_name`/`product_sku` vindos do BANCO — não do payload, provando a doutrina "o
cliente nunca é a autoridade". Carrinho só com slug inválido → `400 cart_empty`, nada gravado.
`ON DELETE CASCADE` verificado: apagar a submissão levou os itens filhos junto, sem órfão.
`rd_station_status`/`email_status` = `failed` é ESPERADO enquanto não houver credencial —
o lead fica no banco de qualquer forma, que é a garantia do desenho.
Interface conferida no HTML servido: ícone com `aria-label="Carrinho de Cotação"` na barra,
21 botões de adicionar na listagem, `/pt/carrinho` e `/en/carrinho` em 200.
Stakeholder abriu no navegador e aprovou o resultado visual.

## Estado do repositório
- Branch: `feat/porta-mais-site` — árvore limpa, commitado e pushado
- Carrinho: `src/modules/cart/`, `src/shared/lib/cart-store.ts`, `POST /api/contact`
  com `subject: "cart"`, migration `drizzle/0009_youthful_gressill.sql`
- Container local em :3000 serve o código ATUAL (rebuildado após o carrinho)

## Pending
- **RD Station**: criar campo customizado `cf_produtos_carrinho` (ao lado de `cf_cnpj`,
  `cf_produto_interesse`, `cf_origem`)
- **API Keys** (stakeholder): provisionar RD Station API Key + Resend API Key
- merge `feat/porta-mais-site` → `main` + push
- seed em produção: `npm run db:seed` com `DATABASE_URL` de produção
- Publicar o site em produção (main está ~70+ commits atrás)
