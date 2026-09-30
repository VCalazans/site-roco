# Spec 002 — Embalagens no padrão GS1 (acondicionamento × agrupamento)

| Campo | Valor |
|-------|-------|
| ID | 002 |
| Slug | `embalagens-gs1` |
| Status | **Em espera** — investigação e plano feitos; implementação NÃO iniciada (decisão do stakeholder em 2026-09-30: "não vamos prosseguir agora") |
| Criada em | 2026-09-30 |
| Responsável | Victor Calazans (stakeholder) · investigação: Claude Code |
| Bloqueio | 4 decisões pendentes do stakeholder (fim deste documento) |

## Pedido do stakeholder (resumo)

1. O "Tipo de Embalagem" mistura dois conceitos: **acondicionamento** (granel, saco, blister) e
   **agrupamento** para venda (unidade, caixa, display) — gera rótulos como "Peça – 12 unidades por
   embalagem" e "Blister – 12".
2. O site mostra o MESMO EAN em embalagens de quantidades diferentes; pelo GS1 cada nível tem
   código próprio (EAN-13 na unidade, DUN-14/GTIN-14 nos agrupamentos).
3. Opções redundantes ("Peça avulsa (1 un.)" + "Saco plástico (1 un.)") e cards sem código.
4. A ordem dos cards depende da ordem de cadastro.

Modelo pedido por embalagem: acondicionamento (GRANEL, SACO_PLASTICO, BLISTER, CARTUCHO),
agrupamento (UNIDADE, DISPLAY, CAIXA, CAIXA_MASTER, FARDO), unidades (UNIDADE = 1; demais > 1),
código de barras opcional (13 dígitos na UNIDADE, 14 nos demais, dígito verificador GS1),
vendável (default true), peso bruto e dimensões opcionais. Sem sincronização com ERP: cadastro
manual no painel. Validações de duplicidade (código no produto e entre produtos; combinação),
tela de cadastro nova com prévia do rótulo, rótulo gerado no site ("Unidade", "Unidade em
blister", "Display com 12 unidades · blister"), "EAN"/"DUN-14" pelo tamanho, ordem por
acondicionamento e unidades, só vendáveis, texto "Disponível nas seguintes embalagens", correção
do título escondido atrás do header fixo, migração reversível com relatório de pendências e testes.

## Investigação (estado em 2026-09-30)

**Persistência**:
- Tabela `product_packagings` (`src/db/schema/catalog.ts`): `packaging_type` (enum peca, blister,
  caixa, saco_plastico), `units_per_pack`, `barcode_ean13` varchar(13), `erp_complement_code`,
  `is_default` (legado); unique (produto, tipo, unidades).
- Escrita pelo painel: `products.create/update` (`src/server/trpc/routers/products.ts`,
  `replacePackagings` apaga e recria todas as embalagens do produto a cada salvamento).
- Leitura: `products.byId`/`list` (painel) e `assembleProducts` (`src/server/lib/public-products.ts`
  → detalhe do site e `GET /api/products`).
- Importador `db:import-catalog` (também chamado pelo `db:bootstrap-producao`): monta a partir de
  `Planilha1` (variantes ERP pc/bl/cx) + `Sheet1` (EMBALAG saco plástico/blister/caixa) e APAGA E
  RECRIA as embalagens de todos os produtos a cada execução. O sync do ERP só toca
  `products.barcode_ean13`.

**Origem do EAN do card**: é o código DA EMBALAGEM (`product_packagings.barcode_ean13`), não o do
produto. A repetição vem dos dados: nas variantes do ERP a embalagem ×6/×12 traz o mesmo código da
unidade.

**Consumidores**: `src/shared/lib/packaging.ts` (ordem e texto), `product-detail-view.tsx` (site),
`product-form-dialog.tsx` + `product-form.ts` + `product-types.ts` (cadastro), `product-table.tsx`
(resumo na tabela), tipos públicos e dicionários pt/en.

**Header**: 64/80 px (`h-16 md:h-20`); o detalhe já tem `pt-24 md:pt-32`. Hipótese a reproduzir: a
rolagem automática do Next ao navegar ignora o header fixo → `scroll-padding-top` global.

## Validação contra a base em `docs/` (simulação das regras sobre os dados reais)

O banco local é IDÊNTICO ao que a planilha `docs/Dados Catalogo ROCO site_2026.xls` gera (737/737
produtos, nenhuma edição manual de embalagem). Números da simulação:

| Resultado | Linhas / produtos |
|---|---|
| Peça ×1 → Granel/Unidade | 451 |
| Peça >1 → Granel/Caixa | 224 |
| Blister ×1 → Blister/Unidade | 319 |
| Blister >1 → Blister/Display | 416 |
| Saco ×1 → Saco/Unidade | 211 |
| Saco >1 → Saco/Fardo | 124 |
| "Caixa" (não mapeada → revisão manual) | 4 linhas: SKU 2206 (×1, sem código); SKU 3216 (×1/×12/×36, mesmo EAN) — o 3216 ficaria SEM embalagem no site até a revisão |
| Agrupamentos com código igual ao da unidade (limpos) | 627 |
| **Agrupamentos sem código após a migração** | **764 (todos)** — a planilha não tem NENHUM código de 14 dígitos |
| Unidades sem código que receberiam o EAN do produto | 221 |
| Granel/Unidade + Saco/Unidade com o mesmo código (granel removido) | 208 produtos |
| **Granel/Unidade + Blister/Unidade com o mesmo código** (regra não cobre) | **36 produtos** (ex.: SKU 1000) |
| Mesmo código em produtos diferentes | 0 |
| Dígito verificador inválido | 0 nas embalagens; 1 EAN de produto (SKU 3097: `7899786809589`) |

## Plano proposto (aguardando aprovação)

Commits separados, cada um com `tsc`/build verdes:
1. **Modelo e migration** (próximo número livre em `drizzle/`): colunas novas + CHECKs (unidades ×
   agrupamento, tamanho do código), unique da combinação e unique GLOBAL do código; conversão em SQL
   no boot; tabela de relatório + `npm run db:report:embalagens` (CSV); down = cópia integral da
   tabela antiga + script de reversão (Drizzle não tem down), testado up → down → up; importador
   deixa de apagar/recriar embalagens de produtos existentes (aplica as mesmas regras só em
   produto novo — necessário no bootstrap de produção).
2. **Validações/API**: GS1 módulo 10, duplicidade de combinação e de código no produto, código já
   usado em outro produto com o nome dele; a mesma função no navegador e no servidor.
3. **Painel**: Acondicionamento | Agrupamento | Unidades | Código | Vendável | remover; peso e
   dimensões em "Mais detalhes"; unidades travadas em 1 na UNIDADE; prévia do rótulo; texto de ajuda.
4. **Site**: rótulo gerado, "EAN"/"DUN-14", ordem, só vendáveis, texto novo, correção do header.
5. **Testes**: GS1, rótulos, ordenação, duplicidades; migração num Postgres real com a tabela de
   casos como fixture (incluindo o down).

## Decisões pendentes do stakeholder

1. **Granel + Blister com o mesmo código (36 produtos)**: recomendação — mesma regra do saco
   (manter Blister/Unidade, remover Granel/Unidade, registrar no relatório).
2. **Unidade sem código em produto que já tem código em outras embalagens**: entendimento — recebe o
   EAN do produto (é o que produz os 208 casos Granel + Saco). Confirmar.
3. **EAN do produto (`products.barcode_ean13`)**: recomendação — manter no cadastro como referência,
   nunca exibido nos cards.
4. **Nomes no código**: recomendação — identificadores em inglês como o resto do código (`packing`,
   `grouping`, `units`, `barcode`, `sellable`) e valores em português minúsculo (`granel`,
   `caixa_master`…), como os enums atuais; tela e relatório com os termos do pedido.
