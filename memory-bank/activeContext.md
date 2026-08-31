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

## RD Station — VALIDADO em 2026-08-31
Chave de API nova (Integrações → API Keys) funciona: chamada direta devolve 200 + `event_uuid`, e
`POST /api/contact` grava `rd_station_status = "sent"` com o uuid preenchido. O 401 anterior era
credencial da API LEGADA 1.3 ("token público/privado"), sistema de autenticação diferente da
Conversions API. Nenhuma mudança de código foi necessária.
⚠️ Sonda revelou que o RD aceita campo personalizado INEXISTENTE com HTTP 200 — descarta em
silêncio. Os quatro `cf_*` precisam ser criados no painel, e a ausência deles NÃO aparece em erro
nenhum (nem na API, nem no nosso banco). Ver decisionLog 2026-08-31.

## Pending
- **RD Station (stakeholder)**: criar `cf_origem` no painel — é o ÚNICO campo que o código envia e
  a conta não tem (conferido na lista de 2026-08-31). `cf_cnpj`, `cf_produto_interesse`,
  `cf_produtos_carrinho` e `cf_mensagem` já existem. Sem `cf_origem`, a seção do site que gerou o
  lead some sem aviso. Conferir abrindo `teste-campos-rd@roco.com.br` no painel do RD.
- **Resend**: provisionar `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_NOTIFICATION_EMAIL`
  (hoje `email_status = "not_configured"` em todo lead).
- `RD_STATION_API_KEY` de PRODUÇÃO (a validada é a do ambiente local).
- merge `feat/porta-mais-site` → `main` + push
- seed em produção: `npm run db:seed` com `DATABASE_URL` de produção
- Publicar o site em produção (main está ~70+ commits atrás)
