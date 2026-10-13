# Spec 003 — Site pronto para IA (SEO técnico, llms.txt, JSON-LD, MCP e WebMCP)
> Criada: 2026-10-13 | Status: **IMPLEMENTADA no código (2026-10-13), fora de produção** | Base: playbook "Site pronto para IA" da Archicode

## Decisões tomadas (2026-10-13, stakeholder: "pode liberar e implementar tudo")
- **D1 — liberar** todos os robôs de IA, inclusive os de treinamento (grupo explícito no `robots.txt`).
- **D2 — CNPJ fora**: não está no repositório nem no site; só entra quando a ROCO confirmar (nunca inventado).
- **D3 — homônimo citado**: a Roco austríaca de ferromodelismo (texto em `ai.organization.homonyms`).
- **D4 — FAQ adiada**: sem respostas reais da ROCO, nenhuma FAQ/`FAQPage`. A página `/sobre` usa só fatos já publicados.
- **D5 — llms só em pt** (links para as páginas `/en` ficam no sitemap e nos hreflang).
- **D6 — WebMCP agora**, como aprimoramento progressivo (sem a API no navegador, nada acontece).
- **D7 — sem rota nova de categoria**: `?category=<slug>` sozinho é página indexável com canonical próprio e entra no sitemap.

## Implementado
- `<html lang>` pela URL (header `x-roco-locale` do proxy); canonical + hreflang (`pt-BR`, `en`, `x-default`) em todas as páginas
  públicas (`buildAlternates`); listagem: uma categoria indexável, busca/combinações `noindex, follow`; `/orcamento` noindex.
- `robots.ts` com robôs de IA explícitos e `Disallow` de `/api/`, portal, admin e orçamento; sitemap dinâmico com ~740
  produtos × 2 idiomas + categorias, `lastmod` real e alternates (1.518 URLs no banco local).
- OG padrão 1200×630 (`public/images/og/roco-og.jpg`) e OG/Twitter com a capa no produto.
- JSON-LD (`src/modules/ai/lib/json-ld.ts`, `<JsonLd>`): `Organization` em todo o site, `WebSite` + `SearchAction` e `ItemList`
  na home, `Product` (sem `offers`, EAN validado) + `BreadcrumbList` no produto, `ItemList` na listagem, `ContactPage`, `AboutPage`.
- Página `/{locale}/sobre` (link no rodapé) com os fatos da empresa — mesma fonte do JSON-LD (`getSiteFacts`).
- `/llms.txt` e `/llms-full.txt` (Route Handlers, pt, cache 1 h) gerados de dicionário + `site_settings` + catálogo.
- MCP público `/mcp` (Streamable HTTP stateless, JSON-RPC, lote ≤ 10, corpo ≤ 64 KiB, limite contado por MENSAGEM: 120/min por
  IP e 1500/min global, fail-open; CORS sem credenciais; `obter_produto` só aceita slug/SKU do índice publicado) com `sobre_roco`, `como_comprar`, `listar_categorias`, `buscar_produtos`, `obter_produto`; cartão em
  `/.well-known/mcp.json` e `/.well-known/mcp/server-card.json`.
- WebMCP (`WebMcpTools`): `buscar_produtos`, `abrir_produto`, `filtrar_catalogo`, `adicionar_ao_orcamento`, `ver_orcamento`,
  `preparar_contato` (nunca envia). Token do origin trial por `WEBMCP_ORIGIN_TRIAL_TOKEN` (runtime).
- Origem de lead `assistente-ia` nos links do MCP/WebMCP e `sobre` na página institucional.
- IndexNow: `/indexnow.txt` + aviso em `after()` ao editar/publicar produto (desligado sem `INDEXNOW_KEY`).

## Pendente (depende de produção/stakeholder)
- Deploy; em produção: conferir "AI Crawl Control"/"Block AI bots" da Cloudflare, gerar `INDEXNOW_KEY`, registrar o origin
  trial do WebMCP para `roco.com.br`, Search Console + Bing (sitemap), Rich Results Test, conector MCP no Claude.
- CNPJ (D2), FAQ (D4), descrições de produto (muitos sem descrição pt/en), nomes de categoria do ERP em caixa alta.

## Objetivo
Fazer a ROCO ser **encontrada, entendida e citada corretamente** por buscadores (Google, Bing) e assistentes de IA
(ChatGPT, Claude, Perplexity, Gemini), e permitir que agentes **consultem o catálogo oficial** (MCP no servidor) e
**operem o site no navegador do visitante** (WebMCP), sem expor dado pessoal nem abrir escrita no servidor.

## Regras herdadas (não negociáveis)
- Nada inventado: números, certificações, clientes e FAQ só com dado real e aprovação. Campo sem dado fica vazio e vira pendência.
- Fonte única: llms.txt, llms-full.txt, JSON-LD, MCP e WebMCP leem os MESMOS dados das páginas (dicionários i18n,
  `site_settings`, `public-products.ts`). Nenhum texto paralelo mantido à mão.
- Tudo exposto a IA é somente leitura, só produtos `published && active`, sem e-mail/telefone de pessoa física.
- Regras do CLAUDE.md valem (i18n, `@/*`, `src/modules/<feature>`, lint + build verdes antes de commit).

## Auditoria de partida (2026-10-13, produção `roco.com.br`)
| Item | Estado | Nota (seção 9 do playbook) |
|---|---|---|
| HTTPS, `www` → apex | ok (307 para `https://roco.com.br/pt/`) | 10/10 |
| Conteúdo legível sem JS | ok (SSR) | 20/20 |
| `<title>` e description | ok por página (dicionários; produto usa nome + descrição) | 15/15 |
| JSON-LD | **ausente** em todo o site | 0/15 |
| Sitemap | existe, mas **sem produtos** (12 URLs; `lastModified = new Date()` em toda URL) | 5/10 |
| Bots de resposta | liberados (`User-Agent: *`, GPTBot/ClaudeBot 200) — conferir regras de IA na Cloudflare | 20/20 |
| llms.txt | **404** | 0/10 |
| MCP / `.well-known` | **404** | info |
| **Nota de partida** | | **≈ 70/100** |

Defeitos encontrados no código que afetam indexação (corrigir antes do resto):
1. **`<html lang>` vem do cookie `NEXT_LOCALE`, não da URL** (`src/app/layout.tsx`): um crawler sem cookie, ou um visitante com
   cookie `en` abrindo `/pt/...`, recebe o idioma errado. Correção: o `src/proxy.ts` repassa o locale da URL num header de
   requisição (`x-roco-locale`) e o root layout lê `headers()`; cookie vira só fallback.
2. **Sem `canonical`, `hreflang` nem `x-default`** em nenhuma página pública.
3. **Listagem com filtros sem canonical**: `?search=`, `?page=`, combinações de `?category=` geram URLs duplicadas indexáveis.
4. **OG genérico**: imagem 3224×1484 em todas as páginas; produto não usa a própria foto.
5. **`robots.txt` não barra `/api/` nem o portal** (o portal já tem `noindex` por página; falta o `Disallow`).
6. **`src/proxy.ts` intercepta qualquer caminho sem ponto**: uma rota `/mcp` seria redirecionada para `/pt/mcp`. Excluir no matcher.

## Escopo por fase (ordem de execução)

### Fase 1 — Base técnica (playbook §2)
- [ ] `lang` pela URL (defeito 1).
- [ ] Helper `buildAlternates(locale, path)` em `src/core/config/metadata.ts`: `canonical` absoluto + `languages` `pt-BR`/`en` +
      `x-default` → `/pt`. Aplicado em todas as páginas de `(site)`.
- [ ] Listagem: canonical sem `search`/`page`; página com busca livre → `robots: noindex, follow`; página N mantém canonical próprio.
- [ ] **Sitemap com produtos** (revisa a decisão de 2026-08-11, já prevista no roadmap): `lastmod` do `updatedAt` real em ISO 8601
      com fuso, `alternates.languages` por URL, cache pela tag `products`. ~1.500 URLs (737 × 2) — bem abaixo do limite de 50 mil.
- [ ] OG por produto (capa visível em `next/image` remoto) e OG padrão 1200×630 gerado (`opengraph-image.tsx`).
- [ ] `robots.ts`: `Disallow: /api/`, `/pt/portal`, `/en/portal`, `/pt/orcamento`, `/en/orcamento`; `X-Robots-Tag: noindex` nas
      rotas técnicas.
- [ ] Bots de IA (decisão D1): grupos explícitos no robots para bots de resposta (liberar) e de treinamento (conforme D1).
      Conferir na Cloudflare "AI Crawl Control"/"Block AI bots" e o robots.txt gerenciado — podem bloquear sem aparecer no arquivo.
- [ ] IndexNow: arquivo de chave + envio em `after()` quando um produto é publicado/editado (best-effort, nunca bloqueia a mutação).

### Fase 2 — llms.txt e llms-full.txt (playbook §3)
- [ ] `/llms.txt` como Route Handler (não estático: endereços, contato e redes vêm de `site_settings`), cache 1 h.
      Seções: quem é (Roco Indústria Metalplástica S.A., CNPJ, Blumenau/SC + fábrica em Gaspar/SC, fundação), **não confundir com**
      (D3), linhas de produto (as macro-famílias da home + as categorias reais), como pedir orçamento, Portal ROCO para
      representantes, catálogo online, servidor MCP, páginas principais.
- [ ] `/llms-full.txt`: tudo do anterior + categorias com contagem + **uma linha por produto publicado** (SKU, nome, categoria,
      embalagens, URL) — ~740 linhas; gerado de `public-products.ts`, tag `products`.
- [ ] Versão em inglês? Os dois arquivos em pt (idioma principal) com link para as páginas `/en`. (D5)
- [ ] Excluir `/llms.txt`, `/llms-full.txt` do matcher do proxy (já têm ponto — conferir em teste).

### Fase 3 — Dados estruturados (playbook §4)
- [ ] `serializeJsonLd` (escapa `<`) + componente `<JsonLd>` em `src/shared/components/seo/`. Testes: valor com `</script>` não fecha a tag.
- [ ] Layout `(site)`: `Organization` (`@id` `https://roco.com.br/#organization`, `legalName`, `taxID`, `foundingDate` 2014,
      `address` matriz + `location` fábrica, `logo`, `sameAs` das redes de `site_settings`, `knowsAbout`, `award` GPTW com vigência)
      e `WebSite` com `SearchAction` → `/pt/produtos?search={termo}`.
- [ ] Detalhe do produto: `Product` (`sku`, `gtin13` do EAN da embalagem quando há UM EAN por produto — com vários, um
      `ProductGroup`/`hasVariant` por embalagem é avaliado na implementação; `brand`/`manufacturer` → Organization; `image` só
      visíveis; `category`; **sem `offers`** — não há preço público) + `BreadcrumbList`.
- [ ] Listagem e vitrine da home: `ItemList` com as URLs dos produtos.
- [ ] Contato: `ContactPage` com `contactPoint` (comercial, idiomas).
- [ ] `FAQPage` **só** onde houver FAQ visível e aprovado (Fase 6).
- [ ] Validar home, uma listagem e três produtos no Rich Results Test e no validator.schema.org.
  Observação: sem `offers`/avaliações o Google não exibe rich result de produto — o ganho aqui é entendimento por IA e
  Knowledge Graph, não estrela na SERP.

### Fase 4 — Servidor MCP público (playbook §5)
- [ ] `src/app/mcp/route.ts` — Streamable HTTP, stateless, JSON-RPC 2.0 (único ou lote ≤ 20), sem SSE nem sessão;
      (planejado com lote ≤ 20; implementado com ≤ 10) `initialize` negociando as versões suportadas (as atuais da especificação + `2025-06-18`/`2025-03-26`), `ping`,
      `tools/list`, `tools/call`; erros `-32700/-32600/-32601/-32603` sem stack; `GET` com `Accept: text/event-stream` → 405,
      `GET` simples → descrição legível; `DELETE` → 405.
- [ ] Lógica pura em `src/modules/ai/` (protocolo + ferramentas testáveis sem HTTP), dados por `public-products.ts` e
      `site_settings` (mesmo cache das páginas).
- [ ] Ferramentas (todas `readOnlyHint: true`, `openWorldHint: false`, `additionalProperties: false`, parâmetro `idioma` pt|en):
  | Ferramenta | Retorna |
  |---|---|
  | `sobre_roco` | razão social, CNPJ, unidades, linhas de produto, contato comercial, como pedir orçamento, aviso de homônimos |
  | `listar_categorias` | categorias publicadas com contagem e URL |
  | `buscar_produtos` | `termos[]`, `categorias[]` (enum dos slugs), `so_campeoes`, `limite` 1–20 → SKU, nome, categoria, URL, capa |
  | `obter_produto` | por `slug` ou `sku`: descrição, categorias, selos, todas as embalagens (descrição + EAN), imagens visíveis, URL, link de orçamento |
  | `como_comprar` | caminhos reais: orçamento pelo site, contato, catálogo online, Portal ROCO para representantes |
- [ ] Proteções: corpo ≤ 64 KiB (`readBodyTextWithLimit`), rate limit por IP com `getClientIp` (Redis; fail-open — é leitura
      pública), busca livre fora do cache (regra já existente), `Access-Control-Allow-Origin: *` **sem credenciais** (somente
      leitura; permite clientes MCP no navegador), sem Turnstile (agentes não resolvem desafio).
- [ ] Matcher do `src/proxy.ts` exclui `mcp` e `.well-known`.
- [ ] Descoberta: menção no llms.txt e no rodapé técnico do `llms-full.txt`; cartão do servidor em `/.well-known/mcp.json`
      **e** no caminho do SEP-2127 (`/.well-known/mcp/server-card.json`) — o padrão de server card ainda é rascunho (D6).
- [ ] Cloudflare: incluir `/mcp` na regra de rate limiting (mais de 10 POST em 10 s por IP) — avaliar se o teto é baixo para um
      agente que faz várias chamadas em sequência; se for, deixar só o limite do Redis.
- [ ] Teste: curl dos três métodos + MCP Inspector + Claude como conector personalizado (3 perguntas reais sobre a ROCO).

### Fase 5 — WebMCP (agente no navegador do visitante)
Estado em out/2026: API em **origin trial no Chrome** (`document.modelContext.registerTool`; o nome antigo
`navigator.modelContext` foi descontinuado), Edge atrás de flag, Firefox/Safari sem compromisso; especificação é
Draft Community Group Report do W3C. Tratar como **aprimoramento progressivo** — sem a API, nada muda.
- [ ] Componente client `WebMcpTools` no layout `(site)`, atrás de `NEXT_PUBLIC_WEBMCP_ENABLED` e detecção de recurso
      (`document.modelContext ?? navigator.modelContext`); token do origin trial por `<meta http-equiv="origin-trial">`.
- [ ] Ferramentas (executam no navegador, com a sessão e o estado do próprio visitante):
  | Ferramenta | Efeito |
  |---|---|
  | `buscar_produtos` | mesma consulta do MCP via `GET /api/products`; devolve resultados ao agente |
  | `abrir_produto` / `filtrar_catalogo` | navega para o detalhe / aplica filtros na URL de `/produtos` |
  | `adicionar_ao_orcamento` | chama o `cart-store` (localStorage) — visível no badge do header |
  | `ver_orcamento` | lê os itens do orçamento atual |
  | `preparar_contato` | preenche o formulário de contato/orçamento **sem enviar** |
- [ ] **Nunca** enviar formulário pelo agente: envio exige Turnstile + consentimento LGPD marcado pela pessoa. Ferramentas que
      alteram estado pedem confirmação (`requestUserInteraction`, se disponível no trial) e ficam fora de iframes cross-origin.
- [ ] Avaliar a API declarativa (atributos em `<form>`) no formulário de contato quando sair do rascunho.
- [ ] O CSP não muda (o código é nosso, `script-src 'self'`).

### Fase 6 — Conteúdo que a IA consegue citar (playbook §6) — depende do stakeholder
- [ ] Página `/sobre` (institucional idêntico ao `Organization`: história, unidades, GPTW, exportação) — hoje só há a seção da home.
- [ ] Páginas de categoria indexáveis (`/produtos/categoria/<slug>` ou canonical estável de `?category=`) com introdução de 2–3
      frases: o que é, uso típico, para quem — texto do `copywriter`, aprovado pela ROCO.
- [ ] FAQ real (5–8 perguntas por tema: como comprar sendo revenda/construtora, pedido mínimo, prazo, exportação, garantia,
      como virar representante) — só com respostas fornecidas pela ROCO (D4). Vira `FAQPage` + ferramenta MCP `perguntas_frequentes`.
- [ ] Levantamento: quantos produtos publicados estão sem descrição pt/en (a IA cita o que está escrito) → pauta para o time.

### Fase 7 — Indexação e medição (playbook §2.8, §7)
- [ ] Search Console + Bing Webmaster: propriedade de domínio, envio do sitemap, pedido de indexação (home, produtos, categorias).
- [ ] Origem "assistente de IA" nos leads: reconhecer `utm_source=chatgpt.com`/referrers de IA no cookie `roco_utm` e como valor
      novo de `traffic_source` (sem dado pessoal). Painel de bots de IA da Cloudflare para acompanhar rastreio.
- [ ] Nota "depois" pela tabela da seção 9 e relatório curto ao cliente (playbook §11).

### Fase 8 — Segurança (playbook §8) — revisão pelo agente `security` antes do deploy
- Superfície nova: `/mcp` (POST público), `/.well-known/*`, `llms*.txt`, WebMCP. Conferir: nada de rascunho/inativo/imagem
  "só no portal" vazando; nenhum campo de lead, representante ou usuário acessível; limite de corpo e de lote; custo de busca
  limitado (termos e `limite`); CORS sem credenciais.

## Decisões pendentes do stakeholder
- **D1 — Bots de treinamento** (GPTBot, ClaudeBot, Google-Extended, CCBot): recomendação **liberar** (fabricante quer ser
  conhecido; o catálogo não é produto pago). Bots de resposta ficam liberados de qualquer forma.
- **D2 — CNPJ e razão social** no llms.txt/JSON-LD/MCP: são públicos; confirmar o CNPJ oficial e a data de fundação.
- **D3 — Homônimos**: confirmar quais citar (ex.: a marca austríaca de ferromodelismo Roco).
- **D4 — FAQ e página Sobre**: quem fornece/aprova as respostas.
- **D5 — llms em inglês**: só pt (recomendado) ou também `/en/llms.txt`.
- **D6 — WebMCP agora** (origin trial, requer registrar `roco.com.br` no programa do Chrome e renovar o token) **ou depois** do
  MCP do servidor. Recomendação: depois das fases 1–4.
- **D7 — Páginas de categoria** com URL própria (melhor para SEO; muda rotas e sitemap) ou só canonical do filtro.

## Arquivos previstos
`src/app/layout.tsx`, `src/proxy.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/core/config/metadata.ts`,
`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/mcp/route.ts`, `src/app/.well-known/...`,
`src/modules/ai/` (protocolo MCP, ferramentas, geradores de llms, tipos), `src/shared/components/seo/` (JsonLd),
`src/modules/ai/components/webmcp-tools.tsx`, páginas de `(site)` (metadata + JSON-LD), dicionários (textos novos), testes.

## Critérios de aceitação
- Nota da seção 9 ≥ 95 em produção; Rich Results Test sem erro em home, listagem e 3 produtos.
- `curl` de `initialize`, `tools/list` e `tools/call` (`buscar_produtos`) OK; conector no Claude responde 3 perguntas com dados reais.
- `/en/...` serve `lang="en"` sem cookie; toda página pública com canonical + hreflang + x-default.
- Sitemap com todos os produtos publicados e `lastmod` real; nenhum produto não publicado em sitemap, llms, JSON-LD ou MCP (teste).
- WebMCP (se D6 = agora): ferramentas registradas no Chrome com o trial; sem a API, zero erro no console.
- lint, `tsc`, testes e `next build` verdes; revisão do `security` sem achado Alto/Crítico.
