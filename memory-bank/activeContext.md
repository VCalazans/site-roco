# Active Context — ROCO

## Sessão atual (2026-09-30, quarta rodada)
Pedido do stakeholder: paginação de verdade nos produtos do portal ("carregar mais não é um bom
padrão"), código limpo e componentes reaproveitáveis, dados de teste cadastrados, escolher quais
imagens do produto vão ao site e liberar o download das imagens — sem perda de qualidade — para os
representantes. **Implementado, validado no navegador e por script, e commitado** na branch
`feat/porta-mais-site` (feature + documentação; sem push, sem merge em `main`). `tsc` limpo, lint 0
erros, 1660 testes em 63 arquivos, `next build` verde, `npm audit --omit=dev` = 0. Revisão de
segurança OWASP feita (ver progress.md): 3 médios e os baixos de código corrigidos; 1 alto
pré-existente e latente registrado (Google SSO) — decisão do stakeholder antes de ligar o SSO.

**Rodada anterior (terceira, já commitada em `cc8423e` + `c46569e`) — resumo**:
- "Força de Vendas" → "Portal ROCO", filtros combinados em `/produtos` (várias categorias em OU,
  vários termos em E), redes sociais por @perfil/nome/número

**Rodada retrasada (segunda, já commitada em `add519a` + `5dd95b5`) — resumo**:
- Embalagens sem padrão, cache expira na hora, painel centralizado, materiais por setor,
  material via rota autenticada, permissões no boot, upload home assinado

**Mudanças desta rodada** (detalhes no decisionLog, entrada de 2026-09-30 "Paginação numerada…"):
- **Paginação numerada**: 4 listas (Produtos, Solicitações, Representantes, Usuários) usam agora
  `PortalPagination` (reaproveitável) com primeira/última + 1 vizinha, 20/50/100 itens/página.
  Em Produtos a URL é a fonte da verdade (`?page=`/`?perPage=`), mudar filtro volta à página 1 e o
  servidor limita a página ao intervalo real. Em Representantes, filtro novo volta à página 1
  (bug pré-existente).
- **Imagens do produto editáveis**: coluna `product_images.show_on_site` (migration 0012). Portal:
  chave "Exibir no site" por imagem, "Usar como capa" (leva ao início e marca visível), chips
  "Capa da listagem"/"No site"/"Só no portal". Site: só mostra imagens visíveis, primeira é a capa
  da listagem. Aviso se publicado sem foto no site.
- **Download de imagens originais**: permissão `product_images:download` (admin, sales_manager,
  representative). Rotas: `GET /api/portal/products/images/[imageId]/download` (individual, 303 →
  R2 com `Content-Disposition` seguro) e `GET /api/portal/products/images/zip` (bulk com filtros,
  streaming, teto 3000 arquivos / 2 GiB, rate limit 20/10min, no máximo 2 ZIPs simultâneos por
  usuário e 5 por processo, encerra após 2 min sem progresso). ZIP com pastas por produto, nomes
  saneados, arquivo de erros se houver. Migration 0013 garante a permissão no boot.
- **Dados de teste**: `npm run db:seed:qa` (só banco local) cria representante aprovado
  `representante.teste@roco.local` (senha em `QA_REPRESENTATIVE_PASSWORD` no `.env.local`), imagens
  de teste nos SKUs 1000/1001 e dois materiais "(TESTE)"; idempotente; `--remover` desfaz.
- **Correções da revisão de segurança**: saneador de nomes do ZIP seguro por construção (Zip Slip
  pelo nome de pasta de reserva, ReDoS, bidi, nomes reservados do Windows, guarda final de
  caminho); teto de ZIPs simultâneos + tempo máximo sem progresso; `imagesSummary` sem
  `includeInactive`; filtros no audit do ZIP; `seed-qa` recusa host na querystring e e-mail que não
  seja `.local`.

**Validação (dev server + script com login real + container)**:
- **Paginação** (navegador, 737 produtos): `?page=3` → "41–60 de 737"; última página "721–737";
  `?page=99` → URL adota `?page=37`; 50 por página → 15 páginas; ligar "Campeões" na página 2 →
  página 1 mantendo 50 ("1–50 de 57").
- **Imagens** (navegador, admin, SKU 1000): chips "Capa da listagem", "No site", "Só no portal"
  (esmaecida); ligar a imagem oculta e "Usar como capa" refletiram na hora na API pública e no
  detalhe; o estado original foi RESTAURADO em seguida (o site volta a mostrar 2 imagens, sem a oculta).
- **Download**: resumo "3 imagens originais de 1 produto (1,1 MB)" com filtro e "617 imagens
  originais de 593 produtos (336 MB)" sem filtro. Como representante (script com login real):
  mutação de visibilidade → 403; avulso → 303 para o R2 com o nome original; ZIP do produto
  idêntico aos originais (sha256); ZIP filtrado com pasta por produto; filtro vazio → 404; catálogo
  inteiro válido (617 arquivos) em 35 s; 3 downloads abortados sem erro no log. A tela de Produtos
  do representante mostra só "Baixar imagens" (sem "Novo Produto"/"Sincronizar"); ele vê os 2
  materiais de teste.
- **Dados de teste**: seed rodado 2 vezes sem duplicar. O `--remover` não foi executado (os dados
  ficam para validação).

## Validação no Navegador (2026-09-30)
- **Home**: hero com setas WEG + indicadores + pausa; logo 3D quando sem vídeo; fachada com upload 2-step presigned;
  seções editáveis (layout, about, categorias, destaques, portal-cta); fallback para dicionário quando vazio.
- **Site Público**: breadcrumb/galeria/anterior-próximo no detalhe; barra lateral filtros desktop + gaveta mobile;
  busca multi-termo + contagem por categoria; "só campeões" checkbox; paginação numerada; "voltar ao topo".
- **Portal**: shell com logo sensível ao tema + nav agrupada (5 grupos) + busca Ctrl/⌘+K + drawer colapsável (localStorage).
  Dashboard com indicadores clicáveis. Produtos com miniatura + flags `featured`/`best_seller` toggleáveis + ações WhatsApp.
  Formulário por seções (Info, Categorias, Badges, Embalagens, Imagens); nulo em campo opcional LIMPA coluna.
  Solicitações somente-leitura (sem e-mail/telefone na lista, só no detalhe auditado).
  Editor da Página Inicial com upload 2-step presigned (tipo/tamanho ASSINADOS).
- **Orçamento**: renomeado de "Carrinho" (rota `/{locale}/orcamento`, miniatura do produto); redirect 308 de `/carrinho`.

## Estado do Repositório
- Branch: `feat/porta-mais-site` — commitada nesta rodada (`852a916` feature + commit de
  documentação; sem push); merge em `main` pendente.
  Dados de teste do `db:seed:qa` PERMANECEM no banco local e no bucket `roco-test` (pedido do
  stakeholder: "deixe materiais de testes cadastrados"); nenhuma outra alteração do painel ficou salva.
- Testes: 1660 em 63 arquivos (+50 sobre os 1610 da rodada anterior; 7 arquivos novos:
  `pagination` 7, `product-images` 8, `zip-entry-names` 17, `file-size` 3, `product-images-zip` 7,
  `pull-stream` 5, `download-slots` 4).
- Build de produção: verde (`npm run build`); lint 0 erros (6 avisos antigos).
- Banco local: migrations 0012/0013 aplicadas (journal com 14); no host foram aplicadas com
  `node --env-file=.env.local scripts/migrate.mjs` (o `npm run db:migrate` não lê o `.env.local`).
- Container local: reconstruído com o código final e conferido (ver progress.md).

## RD Station — VALIDADO em 2026-08-31
Chave de API nova (Integrações → API Keys) funciona: chamada direta devolve 200 + `event_uuid`, e
`POST /api/contact` grava `rd_station_status = "sent"` com o uuid preenchido. O 401 anterior era
credencial da API LEGADA 1.3 ("token público/privado"), sistema de autenticação diferente da
Conversions API. Nenhuma mudança de código foi necessária.
⚠️ Sonda revelou que o RD aceita campo personalizado INEXISTENTE com HTTP 200 — descarta em
silêncio. Os quatro `cf_*` precisam ser criados no painel, e a ausência deles NÃO aparece em erro
nenhum (nem na API, nem no nosso banco). Ver decisionLog 2026-08-31.

## Pending
- **Antes de ligar o Google SSO (stakeholder + dev)**: corrigir a concessão automática da role
  `representative` no 1º login Google (achado ALTO da revisão — ver progress.md, Riscos).
- **Decisão de produto**: representante baixa imagens de produtos NÃO publicados? Hoje sim
  (coerente com a listagem do portal, onde ele já os vê).
- **Atualizar Node local para 22** (AWS SDK exigirá em jan/2027; Docker já usa node:22-alpine).
- **RD Station (stakeholder)**: criar `cf_origem` no painel — é o ÚNICO campo que o código envia e
  a conta não tem. Sem ele, a seção do site que gerou o lead some em silêncio.
- **Resend**: provisionar `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_NOTIFICATION_EMAIL`.
- `RD_STATION_API_KEY` de PRODUÇÃO (a validada é a do ambiente local).
- **push + merge `feat/porta-mais-site` → `main`**.
- **seed de produção**: `npm run db:seed` (o `db:seed:qa` recusa rodar fora de banco local — dado
  de teste nunca chega à produção).
- Publicar o site em produção (main está ~70+ commits atrás).
