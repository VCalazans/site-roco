# Spec 001 — Site ROCO v2: marca, vitrine e painel

> Spec de feature no formato SDD v2 (histórias → requisitos EARS → critérios de aceitação),
> adaptada à convenção deste repositório: o produto está descrito em
> `memory-bank/projectBrief.md` + `productContext.md` (papel do PRD) e as decisões vivem em
> `memory-bank/decisionLog.md` (papel das ADRs — referenciadas aqui por data/título).
> Local escolhido pelo stakeholder em 2026-09-29: `memory-bank/specs/` (sem criar
> `.spec/`/`.agents/`/`.memory/` paralelos ao memory-bank).

| Campo | Valor |
|-------|-------|
| ID | 001 |
| Slug | `site-v2-marca-vitrine-painel` |
| Status | Implementada e validada localmente (build de produção Next 16.3.7 verde; imagem Docker ainda não reconstruída — ver "Resultado da validação") |
| Criada em | 2026-09-29 |
| Atualizada em | 2026-09-30 |
| Responsável | Victor Calazans (stakeholder) · implementação: Claude Code |
| Dados sensíveis | Dados pessoais de leads (nome, e-mail, telefone, empresa, IP) — exibidos no painel a perfis autorizados |

## Objetivo

Levar o site público e o Portal ROCO ao nível "profissional ao máximo": aplicar a nova
identidade visual (logos), dar ao operador controle total da home e da vitrine de produtos
(destaques e campeões de vendas), tornar a navegação fluida (setas, transições, busca
lateral), renomear o "carrinho" para **Orçamento** e entregar um painel intuitivo para o
operador e para o representante.

## Contexto

- A home já é dinâmica só no hero (slides em `/portal/hero`, decisionLog 2026-08-23); o
  restante (institucional, categorias, destaques, CTA do portal) vem fixo dos dicionários.
- "Produtos em destaque" hoje depende do selo `top` (57 produtos, vindo da coluna `@TOP` da
  planilha) — não há flag de cadastro; destaque e "mais vendido" estão conflados.
- O carrinho multi-produto (decisionLog 2026-08-30) usa o vocabulário "Carrinho de Cotação".
- O carrossel do hero tem setas mínimas ("‹ ›") com rótulos acessíveis errados (os dois
  usam o texto do scroll cue) e "de" fixo em português.
- A galeria do detalhe de produto não é interativa; não existe produto anterior/próximo;
  o header é remontado a cada página (cada `page.tsx` renderiza o seu).
- O painel tem textos fixos em português (shell, configurações), logo distorcida (28×28),
  redes sociais editadas como JSON cru e nenhum lugar para ver os leads/orçamentos
  recebidos — sem Resend configurado, o lead só existe no banco e no RD Station.
- Novas logos entregues em `public/images/logos/`: 2D branca, branca com slogan
  "onde tudo se conecta" e 3D azul/branca.
- Next 16.3 + React 19.2: `<ViewTransition>` funciona no App Router sem configuração
  (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).

## Escopo

**Dentro do escopo**
- Logos novas no header, rodapé, hero, portal (login, shell, boas-vindas) e favicon.
- Flags de produto **Destaque na home** (com ordem) e **Campeão de vendas** (com ícone).
- Setas/navegação: hero (WEG), vitrine de destaques, galeria do produto, produto
  anterior/próximo, breadcrumb + voltar, paginação numerada, voltar ao topo, transições.
- Seção breve de **fachada da fábrica** logo após o hero.
- Editor da **página inicial** no painel: todas as seções (textos PT/EN, imagens, CTAs,
  visibilidade e ordem), mais a vitrine de destaques.
- **Orçamento** no lugar de "carrinho" em toda referência visível (textos, ícone, URL).
- Busca lateral: sidebar do portal (filtra `/portal/produtos`) + barra lateral de filtros
  na página pública `/produtos`; busca também no painel mobile e no header desktop.
- Painel: shell com navegação agrupada e busca, dashboard com indicadores e atalhos,
  tabela de produtos com miniatura/flags/filtros, formulário de produto por seções,
  caixa de **Solicitações** (leads/orçamentos), configurações sem JSON cru, i18n completo.
- Validação ponta a ponta no navegador (site + painel), testes, lint e build verdes.

**Fora do escopo**
- Mudar o identificador técnico interno `subject: "cart"` (enum do banco/API) e o nome do
  campo `cf_produtos_carrinho` no RD Station (já existe na conta do stakeholder — renomear
  quebraria a integração). Só os textos, a URL, o ícone, a origem e o
  `conversion_identifier` mudam.
- Rotas traduzidas por idioma (`/en/products`) e busca full-text com `unaccent`.
- Exportação de leads (CSV) e política de retenção LGPD automática (seguem no backlog).
- Recriar as ilustrações das categorias ou tratar/produzir fotografia nova da fachada — a
  seção nasce com o recorte do render existente e o operador troca pela foto oficial.
- Envio de e-mail/WhatsApp pela plataforma (Business API).

## Histórias de usuário

- **HU01** — Como visitante, quero ver a nova identidade ROCO em todo o site, para
  reconhecer a marca atualizada.
- **HU02** — Como operador, quero marcar produtos como *Destaque na home* e *Campeão de
  vendas* no cadastro, para controlar a vitrine e sinalizar os mais vendidos.
- **HU03** — Como visitante, quero identificar campeões de vendas por um ícone harmônico
  com o site, para priorizar produtos consagrados.
- **HU04** — Como visitante, quero setas e transições suaves para navegar entre slides,
  produtos e páginas, para explorar o catálogo sem atrito.
- **HU05** — Como visitante, quero uma seção breve com a fachada da fábrica logo após o
  vídeo, para entender a escala da ROCO antes do conteúdo.
- **HU06** — Como operador de marketing, quero editar todo o conteúdo da home no painel
  (textos PT/EN, imagens, links, visibilidade e ordem), para atualizar o site sem deploy.
- **HU07** — Como visitante, quero montar uma lista de **orçamento** com vários produtos,
  para pedir uma proposta de uma vez.
- **HU08** — Como visitante, quero filtrar produtos por uma barra lateral (busca,
  categorias, campeões), para achar o item certo rápido.
- **HU09** — Como operador/representante, quero buscar produtos pela sidebar do portal e
  cair direto na lista filtrada, para agilizar o atendimento.
- **HU10** — Como operador, quero um painel intuitivo (indicadores, atalhos, filtros,
  formulários claros) e ver as solicitações recebidas, para trabalhar sem depender de TI.
- **HU11** — Como representante, quero compartilhar o link de um produto (WhatsApp/copiar)
  a partir do portal, para agilizar o contato com meu cliente.

## Atores / Personas

| Ator | Papel nesta feature | Nível de confiança |
|------|---------------------|--------------------|
| Visitante | Navega, filtra, monta orçamento, envia solicitação | Anônimo |
| Operador (admin) | Cadastra produtos, flags, edita home, vê solicitações | Autenticado (role `admin`) |
| Marketing / gerente comercial | Edita home e hero, vê solicitações | Autenticado (`sales_manager`) |
| Representante | Consulta catálogo no portal, compartilha produtos | Autenticado (`representative`) |
| RD Station / Resend | Recebem o lead (best-effort) | Sistema externo |

## Requisitos Funcionais (EARS)

### Marca (HU01)
- **RF01** (HU01) — O site DEVE exibir a logo 2D branca no header, a versão com slogan no
  rodapé e a logo 3D como peça central do hero quando o slide não traz mídia própria.
- **RF02** (HU01) — O portal DEVE exibir a logo adequada ao tema (clara no tema escuro,
  azul no tema claro) sem distorção de proporção.
- **RF03** (HU01) — O site DEVE servir favicon e ícone Apple com o monograma da nova marca.

### Flags de produto (HU02, HU03)
- **RF04** (HU02) — O cadastro de produto DEVE oferecer as flags "Destaque na home" e
  "Campeão de vendas", persistidas no produto.
- **RF05** (HU02) — QUANDO um produto é marcado como destaque, o sistema DEVE posicioná-lo
  ao fim da ordem da vitrine; o operador DEVE poder reordenar e remover destaques.
- **RF06** (HU02) — A vitrine "Produtos em destaque" da home DEVE listar só produtos
  publicados e ativos com a flag de destaque, na ordem definida, até o limite configurado.
- **RF07** (HU02) — SE não houver nenhum destaque publicado, ENTÃO a vitrine DEVE cair para
  os campeões de vendas e, na falta deles, para os produtos mais recentes.
- **RF08** (HU03) — ONDE um produto é campeão de vendas, o card e o detalhe DEVEM exibir
  um selo com ícone de troféu no âmbar da marca e nome acessível "Campeão de vendas".
- **RF09** (HU02) — A migração DEVE converter o selo legado `top` em "Campeão de vendas"
  sem perder nenhum produto; o importador de catálogo DEVE mapear `@TOP` para a flag.
- **RF10** (HU02) — A tabela do portal DEVE permitir alternar destaque/campeão em um
  clique para quem tem `products:update`, e filtrar por destaque, campeão e "sem foto".

### Navegação (HU04)
- **RF11** (HU04) — ENQUANTO houver mais de um slide, o hero DEVE exibir setas grandes
  laterais, indicadores, pausa/retomada e aceitar teclado (←/→) e gesto de arraste.
- **RF12** (HU04) — A vitrine de destaques DEVE ser um carrossel com setas
  anterior/próxima e rolagem por toque.
- **RF13** (HU04) — O detalhe do produto DEVE ter breadcrumb (Home › Produtos › Categoria
  › Produto), botão voltar que restaura os filtros da listagem, galeria com setas e
  miniaturas, e links para o produto anterior/próximo da mesma categoria.
- **RF14** (HU04) — A listagem DEVE ter paginação numerada com setas.
- **RF15** (HU04) — QUANDO o visitante navega entre páginas do site, o header DEVE
  permanecer fixo (sem remontar) e o conteúdo DEVE transicionar suavemente; SE o usuário
  prefere movimento reduzido, ENTÃO as transições DEVEM ser desativadas.
- **RF16** (HU04) — QUANDO a página é rolada além de uma tela, o site DEVE oferecer um
  botão "voltar ao topo".

### Fachada (HU05)
- **RF17** (HU05) — A home DEVE exibir, logo após o hero, uma seção breve com imagem da
  fachada, eyebrow, título, texto curto e CTA opcional, todos editáveis no painel.

### Home editável (HU06)
- **RF18** (HU06) — O painel DEVE permitir editar, por seção, todos os textos (PT e EN),
  imagens, links de CTA e a visibilidade/ordem das seções da home (fachada, institucional,
  categorias, destaques, CTA do portal); o hero segue no editor de slides existente.
- **RF19** (HU06) — SE um campo editável estiver vazio, ENTÃO o site DEVE usar o texto
  padrão do dicionário do idioma correspondente.
- **RF20** (HU06) — QUANDO o operador salva uma seção, o site DEVE refletir a mudança na
  próxima requisição (invalidação de cache), e o operador DEVE poder restaurar o padrão.
- **RF21** (HU06) — O sistema DEVE aceitar em links editáveis só caminhos internos
  (`/…`), âncoras de destino conhecidas (`#produtos`, `#catalogo`…) e URLs `http(s)`.

### Orçamento (HU07)
- **RF22** (HU07) — Toda referência visível a "carrinho" DEVE passar a "orçamento"
  (botões, título, ícone, mensagens, SEO), e a página DEVE viver em `/{locale}/orcamento`.
- **RF23** (HU07) — QUANDO alguém acessa `/{locale}/carrinho`, o sistema DEVE redirecionar
  permanentemente para `/{locale}/orcamento`.
- **RF24** (HU07) — QUANDO um produto é adicionado, o botão DEVE confirmar a ação e
  indicar quando o produto já está no orçamento.

### Busca lateral (HU08, HU09)
- **RF25** (HU08) — A página `/produtos` DEVE ter barra lateral (gaveta no mobile) com
  busca ao vivo, lista de categorias com contagem, filtro "só campeões" e limpar filtros,
  mantendo a URL sincronizada.
- **RF26** (HU09) — A sidebar do portal DEVE ter campo de busca de produtos (visível a
  quem tem `products:read`); QUANDO submetido, o portal DEVE abrir `/portal/produtos` já
  filtrado, e a página DEVE manter a busca sincronizada com a URL.
- **RF27** (HU08) — O header desktop e o painel mobile DEVEM oferecer busca que leva à
  listagem filtrada.

### Painel (HU10, HU11)
- **RF28** (HU10) — O dashboard DEVE mostrar indicadores clicáveis (publicados, destaques,
  campeões, sem foto, representantes aguardando revisão, solicitações dos últimos 30 dias
  conforme permissão) e atalhos (novo produto, editar home, ver site).
- **RF29** (HU10) — O painel DEVE listar as solicitações recebidas (contato, ligamos pra
  você, orçamento de produto, lista de orçamento, catálogo) com busca, filtro por assunto
  e detalhe com itens, só para quem tem `leads:read`; cada abertura de detalhe DEVE gerar
  registro de auditoria.
- **RF30** (HU10) — Todo texto do painel DEVE vir dos dicionários (PT/EN), incluindo shell
  e configurações; redes sociais DEVEM ser editadas em campos separados validados.
- **RF31** (HU11) — ONDE o produto está publicado, o portal DEVE oferecer "ver no site",
  "copiar link" e "compartilhar no WhatsApp".

## Requisitos Não-Funcionais

- **RNF01** — Performance: a home não pode ganhar query ao banco sem cache; conteúdo da home
  e vitrine com `unstable_cache` (tags `home-content`/`products`, revalidate ≤ 300 s).
  LCP da home não pode piorar: logo 3D e fachada servidas por `next/image` (AVIF/WebP),
  fachada com `loading="lazy"` (abaixo da dobra).
- **RNF02** — Segurança: toda mutação nova passa por `permissionProcedure` (RBAC) + audit
  log; upload de imagem da home só aceita JPEG/PNG/WebP até 10 MB, chave com prefixo
  `site/home/` validado no confirm (HEAD no R2) e rate limit de presign (30/5 min).
- **RNF03** — Acessibilidade: setas com nome acessível, carrossel com pausa (WCAG 2.2.2),
  foco visível, alvos ≥ 44 px no mobile, `prefers-reduced-motion` respeitado.
- **RNF04** — i18n: paridade total de chaves pt/en (quebra de build se divergir).
- **RNF05** — Qualidade: `npm run lint` 0 erros, `npm run test` verde (suite existente +
  testes das funções puras novas), `npm run build` verde.
- **RNF06** — Compatibilidade: links antigos (`/carrinho`, `?category=`, `?search=`) seguem
  funcionando; o importador e o sync ERP continuam idempotentes.

## Modelo de ameaças

**Superfícies novas ou alteradas**
| Superfície | Tipo | Exposta a | Entrada não confiável |
|------------|------|-----------|-----------------------|
| tRPC `homeContent.*` | Mutação/consulta autenticada | Interno | Textos, hrefs, chaves de imagem |
| tRPC `homeContent.presignImage/confirmImage` | Upload 2-step (R2) | Interno | Nome, tipo, tamanho, chave |
| tRPC `products.setFlags/reorderFeatured/featuredList` | Mutação autenticada | Interno | IDs, booleanos |
| tRPC `leads.list/byId/stats` | Consulta autenticada | Interno | Busca, filtros, IDs |
| `GET /api/products?bestSeller=1` | REST pública | Internet | Querystring |
| Redirect `/carrinho → /orcamento` | Config | Internet | Caminho |
| Conteúdo da home renderizado | SSR público | Internet | Dados editados no painel |

**Dados tratados**
| Dado | Categoria | Onde persiste | Proteção |
|------|-----------|---------------|----------|
| Leads (nome, e-mail, telefone, empresa, IP) | Pessoal | `contact_submissions` | Visível só com `leads:read`; auditoria de visualização; IP não exibido na lista |
| Conteúdo da home | Nenhum pessoal | `site_settings` (jsonb) | Validação zod por seção |
| Imagens da home | Nenhum pessoal | R2 público (`site/home/`) | Tipo/tamanho/prefixo validados |

**Ameaças e controles**
| Ameaça | Categoria | Controle exigido (RF/RNF) |
|--------|-----------|---------------------------|
| XSS via link editável (`javascript:`) no CTA da home/hero | A3 Injeção | RF21: validação de href (só `/`, placeholders conhecidos, `http(s)`) no servidor |
| Acesso indevido a dados de leads | A1 Controle de acesso | RF29: `leads:read` + auditoria; RNF02 |
| Escalada: editar home sem permissão | A1 Controle de acesso | RNF02: `home_content:update` em todas as mutações |
| Upload de arquivo malicioso/grande ou chave forjada | A4/A8 | RNF02: whitelist de tipo, teto 10 MB, prefixo + HEAD no confirm |
| Open redirect no `/carrinho` | A1 | RF23: redirect com destino fixo (só troca o segmento, mesmo locale) |
| Conteúdo inválido derrubando a home | A5 Configuração | RF19: parse tolerante (`safeParse`), fallback para o dicionário |

**Agentes de IA** — N/A.

## Design técnico

- **Marca**: assets processados (recorte do alfa, sem padding) em `public/images/logos/`;
  originais preservados em `docs/marca/`. Favicon/ícone Apple via convenção de arquivo do
  App Router (`src/app/icon.png`, `apple-icon.png`). Portal com componente de logo
  sensível ao esquema de cor (classe `dark`/`light` do MUI).
- **Flags**: colunas novas em `products` (migration 0010) + migração de dados do selo
  `top`. Vitrine lida por `getFeaturedProducts` (cache tag `products`).
- **Home editável**: uma linha de `site_settings` por seção (`home.layout`,
  `home.facade`, `home.about`, `home.categories`, `home.featured`, `home.portal-cta`),
  jsonb validado por schema zod (módulo puro compartilhado). O site resolve
  `conteúdo salvo[idioma] || dicionário[idioma]`. Leitura cacheada (tag `home-content`,
  revalidate 300 s); toda mutação expira a tag NA HORA (`revalidateTag(tag, { expire: 0 })`
  — com `"max"` a primeira visita após salvar ainda mostraria o conteúdo antigo). Seções
  salvas individualmente (sem sobrescrita cruzada entre editores simultâneos). Schemas
  compatíveis para frente: campo ausente num documento salvo vale "vazio" (= padrão), para
  que acrescentar um campo no futuro não invalide o que já foi editado.
- **Header persistente**: `SiteHeader` sobe para o layout `(site)`; conteúdo das páginas
  envolto em `<ViewTransition>` (crossfade curto); imagem do card ↔ capa do detalhe com
  morph (`name` compartilhado); header ancorado (`view-transition-name`).
- **Orçamento**: rota `/{locale}/orcamento`; redirect em `next.config.ts`; origem de lead
  `orcamento`; `conversion_identifier` `orcamento_lista_produtos`; estado continua em
  `localStorage` (`roco_cart_v1`, identificador técnico mantido).
- **Busca lateral**: filtros da listagem viram `aside` (desktop) / gaveta (mobile);
  `GET /api/products` ganha `bestSeller`; contagem por categoria cacheada. Portal: campo
  na sidebar → `router.push('/portal/produtos?search=…')`; página lê/escreve a URL.
- **Solicitações**: router `leads` somente leitura sobre `contact_submissions` +
  `contact_submission_items`.

### Contratos (API / dados)

```
products: + featured boolean NOT NULL DEFAULT false
          + featured_order integer NOT NULL DEFAULT 0
          + best_seller boolean NOT NULL DEFAULT false

site_settings keys: home.layout | home.facade | home.about | home.categories
                    | home.featured | home.portal-cta   (value jsonb, is_public = true)

LocalizedText = { pt: string; en: string }
home.layout   = { sections: { id: "facade"|"about"|"categories"|"featured"|"portalCta"; enabled: boolean }[] }
home.facade   = { imageKey: string|null; imageAlt; eyebrow; headline; text: LocalizedText;
                  showCta: boolean; ctaLabel: LocalizedText; ctaHref: string }
home.about    = { eyebrow; headline; paragraphs: LocalizedText; highlights: {label,value}[] | null;
                  showCatalogStats: boolean; ctaLabel; ctaHref }
home.categories = { eyebrow; headline; description; ctaLabel; ctaHref;
                  items: { label; href; imageKey|null; imagePath|null; alt }[] | null }
home.featured = { eyebrow; headline; description; emptyState; ctaLabel: LocalizedText; ctaHref: string; limit: 4..12 }
home.portal-cta = { headline; description; ctaLabel; ctaHref }
(null em highlights/items = usar a lista padrão do dicionário)

tRPC homeContent.get() -> { documents, updatedAt, imageUrls }
tRPC homeContent.update({ document, data }) | reset({ document })
tRPC homeContent.presignImage({ filename, contentType, sizeBytes }) -> { uploadUrl, key }
tRPC homeContent.confirmImage({ key, filename, contentType }) -> { key, sizeBytes, url }
tRPC products.setFlags({ id, featured?, bestSeller? }) · featuredList() · reorderFeatured({ orderedIds })
tRPC products.create/update: textos opcionais aceitam null (= limpar); mudar `published` exige products:publish
tRPC products.list({ …, featured?, bestSeller?, hasImage? }) -> items[].{ slug, coverUrl, featured, bestSeller }
tRPC leads.list({ search?, subject?, page, perPage }) · leads.byId({ id }) · leads.stats()
GET /api/products?bestSeller=1
Permissões novas: home_content:read, home_content:update, leads:read
```

### Integrações externas

- **RD Station**: só o `conversion_identifier` da lista muda (`carrinho_cotacao` →
  `orcamento_lista_produtos`) e a origem (`carrinho` → `orcamento`, via `cf_origem`).
  Campos existentes na conta permanecem (decisionLog 2026-08-31).
- **Cloudflare R2**: mesmo fluxo presign → PUT → confirm (decisionLog 2026-08-09).

## Dependências

- decisionLog 2026-08-23 (hero slideshow; `site_settings`), 2026-08-30 (carrinho),
  2026-08-24 (RBAC editável; uploads), 2026-08-11 (conteúdo só com dados reais).
- Execução do seed em cada ambiente para as permissões novas (`npm run db:seed`).
- Pesquisas necessárias: nenhuma (View Transitions confirmado na doc local do Next 16.3).

## Decisões técnicas (decisionLog)

- Aplica: 2026-08-09 (R2 presigned), 2026-08-09 (RBAC granular), 2026-08-23
  (`site_settings`), 2026-08-24 (perfis dinâmicos), 2026-08-25 (origem de lead),
  2026-08-30 (carrinho multi-produto).
- Criadas nesta spec (registradas no decisionLog ao implementar): flags de produto;
  conteúdo da home em `site_settings` por seção; Orçamento (rota/identificadores);
  header persistente + View Transitions; caixa de Solicitações.

## Riscos e trade-offs

- Foto da fachada: o render existente tem ~900 px de largura → exibido com overlay e
  altura contida; o operador substitui pela foto oficial no painel.
- Duas fontes de texto (dicionário + banco) → regra única e testada de fallback (RF19); o
  editor mostra o padrão como placeholder.
- `sales_manager` precisa do seed para ganhar `home_content`/`leads` (admin tem bypass).
- Remover o selo `top` é irreversível sem backup → a informação é preservada em
  `best_seller` antes do DELETE (mesma transação da migration).

## Critérios de aceitação

Legenda da verificação (2026-09-30): **[nav]** navegador sobre build de produção no
container local · **[http]** curl/HTML servido · **[db]** consulta no Postgres ·
**[unit]** teste automatizado · **[rev]** revisão de código/segurança.

- [x] (RF01) Header, rodapé e hero exibem as logos novas; nenhuma referência a
      `/images/hero/roco-logo.png` sobra no código. [nav][rev]
- [x] (RF02) No portal, alternar tema claro/escuro troca a logo sem distorção. [nav]
- [x] (RF04/RF05) Marcar destaque no cadastro faz o produto aparecer por último na
      vitrine da home; reordenar no painel muda a ordem no site — vale NA HORA, sem
      salvar a seção. [nav][http][db]
- [x] (RF07) Com zero destaques, a vitrine mostra campeões de vendas — conferido com 0
      destaques: 8 itens, todos campeões, com troféu. [http][db]
- [x] (RF08) Card e detalhe de campeão exibem o troféu com nome acessível. [nav]
- [x] (RF09) Após a migration, `count(best_seller)` = 57 e não há selo `top`. [db]
- [x] (RF11) Hero com 2+ slides troca por setas; botão pausa presente. [nav] — teclado e
      arraste só por revisão de código. [rev]
- [x] (RF13) Detalhe: breadcrumb com categoria, galeria com setas, anterior/próximo, e
      "voltar" retorna à listagem com os filtros anteriores. [nav][unit]
- [x] (RF15) Navegar entre páginas não remonta o header (header no layout). [rev]
- [x] (RF17/RF18) Editar o título da fachada no painel reflete na home; "Restaurar
      padrão" volta o texto do dicionário e apaga a linha. [nav][http][db]
- [x] (RF19) Campo EN vazio exibe o texto padrão EN do dicionário. [http][unit]
- [x] (RF21) Salvar CTA com `javascript:alert(1)` é rejeitado pelo servidor. [unit][rev]
- [x] (RF22/RF23) Botões dizem "Adicionar ao orçamento"; `/pt/carrinho` → 308 `/pt/orcamento`. [nav][http]
- [x] (RF25) Buscar na barra lateral filtra a grade sem recarregar e atualiza a URL. [nav]
- [x] (RF26) Buscar na sidebar do portal abre `/portal/produtos?search=…` filtrado. [nav]
- [x] (RF29) Abrir detalhe grava `leads.view` no audit log [nav][db]; `leads.list` exige
      `leads:read` [rev]. A lista não devolve e-mail/telefone (só o detalhe auditado).
- [x] (RNF02) `homeContent.update` exige `home_content:update`; chave fora de `site/home/`
      é recusada pelo schema; imagem nova conferida por HEAD (tipo, tamanho, extensão). [rev][unit]
- [x] (RNF05) Lint 0 erros, 1571 testes verdes e `next build` de produção verde com
      Next 16.3.7 e todas as correções [unit][http]. A IMAGEM Docker não foi reconstruída
      (memória da máquina) — o container local `site-roco` segue parado com a imagem antiga.

### Revisão pós-entrega (2026-09-30, pedido do stakeholder)

- **Embalagens**: não existe embalagem "padrão" (a embalagem pode ser composta). TODAS as
  cadastradas aparecem — no detalhe do produto (descrição gerada por tipo + quantidade,
  EAN da embalagem, ordem tipo → quantidade, contagem) e na tabela do portal; o checkbox
  "Padrão" saiu do formulário (a coluna `is_default` fica como legado do importador) e o
  formulário acusa embalagem repetida antes do banco. Edições de produto no portal expiram
  o cache do site na hora (`expire: 0`) — a embalagem cadastrada aparece no próximo acesso.
- **Painel centralizado**: largura única de 1280 px, centralizada, em todas as telas.
- **Materiais do representante**: `/portal/materiais` vira biblioteca por setor para quem
  só lê (busca, filtros por assunto com contagem, cards com tipo/tamanho/data/"Novo"),
  item "Materiais" no menu do representante, "Materiais recentes" no topo das boas-vindas,
  "Painel" (que só redirecionava) fora do menu do representante, pré-visualização
  "Ver como representante" para o admin. Links pela rota autenticada
  `/api/portal/materials/[id]/download` (URL do R2 gerada no clique; antes vencia em 5 min).
- **Garantia de acesso**: migration `0011_ensure_portal_permissions` concede no boot as
  permissões de materiais/home/solicitações (o representante ganha `materials:read`) —
  sem depender de rodar o seed. Testado: grant removido → migration → grant de volta.
- Validado ponta a ponta com build de produção: admin publica 2 materiais (upload real no
  R2) → representante aprovado entra, vê "Materiais recentes" e a biblioteca por setor e
  abre o PDF pela rota (303 → R2, nome com acento); sem sessão → login no idioma; material
  apagado → 404. Upload da home com tipo/tamanho assinados aceito pelo R2 e PUT adulterado
  recusado.

### Resultado da validação (2026-09-30)

- Portal validado no navegador com três perfis de teste criados e removidos na sessão:
  admin (tudo), `sales_manager` (sem Configurações/Perfis) e um perfil só
  `products:read`+`update` (nav com Painel e Produtos; "Publicado" desabilitado; mudar
  `published` pela API → 403 "Sem permissão para publicar produtos").
- Formulário de produto: esvaziar campo opcional agora LIMPA a coluna (antes o valor voltava).
- Correções que entraram depois da última imagem validada e ainda precisam do rebuild +
  conferência no navegador: `connection()` na home (fim do ruído de banco no log de
  build), CTA da fachada some quando aponta para seção oculta (+ aviso no editor),
  títulos do login/admin com a marca, upgrade Next 16.3.7/sharp 0.35.5 (GHSA-2xp9-vwfh-vxw4,
  GHSA-p293-qw3h-jr36, GHSA-rgj7-g3m4-5g8c), upload da home com tipo/tamanho ASSINADOS no
  presign + conferência por HEAD (precisa de 1 upload real contra o R2 para confirmar a
  assinatura), lista de solicitações sem e-mail/telefone, `sanitizeImage`/`interpolate`/
  `upload-limits` endurecidos, `%00` em `search`/`category` deixa de dar 500.

## Plano de implementação

1. Assets de marca (logos processadas, favicon, imagem da fachada).
2. Banco: migration 0010 (flags + migração do selo `top`); importador; seed (permissões).
3. Dicionários pt/en (todas as chaves novas; Orçamento).
4. Backend: `public-products` (flags, filtros, contagens, vizinhos), módulo de conteúdo da
   home (schema puro + loader cacheado), routers `homeContent`, `leads`, extensões de
   `products`, validação de href, rota `/orcamento` + redirect, origem/identificadores.
5. Site: header no layout + transições, hero com setas, fachada, seções lendo o conteúdo
   resolvido, carrossel de destaques, selo de campeão, detalhe (galeria/vizinhos/voltar),
   barra lateral de filtros + paginação, orçamento, busca no header/painel mobile.
6. Portal: shell (logo, grupos, busca, i18n), dashboard, produtos (flags/filtros/miniatura/
   compartilhar), formulário por seções, editor da home, Solicitações, configurações.
7. Testes das funções puras novas + ajuste dos existentes; lint; build.
8. Validação no navegador (site + painel, desktop e mobile) e correções.
9. Revisão de segurança (subagente `security`) e atualização do memory bank (`docs`).

## Skills relacionadas

- Subagentes do projeto: `frontend` (site/portal), `backend` (routers/libs), `tester`,
  `security` (gate OWASP), `docs` (memory bank).
- `memory-bank/systemPatterns.md` — padrões de i18n, route groups, uploads presigned, RBAC.

## Checklist de autorrevisão

- [x] Nenhum `[NECESSITA CLARIFICAÇÃO]` pendente (4 decisões confirmadas em 2026-09-29).
- [x] Todo RF é observável, testável, usa EARS e rastreia a uma HU.
- [x] Todo critério rastreia a um RF; há critérios de segurança (RF21, RF29, RNF02).
- [x] "Fora do escopo" preenchido; RNF mensuráveis.
- [x] Modelo de ameaças preenchido (7 superfícies, 3 dados, 6 ameaças com controle).
- [x] Libs citadas confirmadas na doc local (Next 16.3 View Transitions; R2 já em uso).
- [x] Decisões referenciadas existem no decisionLog; novas serão registradas ao implementar.
- [x] Sem código de produção; complexidade ligada a requisito.
