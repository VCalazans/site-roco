# Active Context — ROCO

## Sessão atual (2026-09-30, terceira rodada)
Três pedidos do stakeholder, **implementados e validados no navegador**: "Força de Vendas" →
"Portal ROCO", cadastro de redes sociais "o máximo intuitivo" e vários filtros ao mesmo tempo em
`/produtos`. **Commitado e enviado** na branch `feat/porta-mais-site` (a pedido do stakeholder):
`cc8423e` (feature) + o commit de documentação. Merge em `main` NÃO feito. `tsc` limpo, lint 0
erros, 1610 testes em 56 arquivos, `next build` verde. Container `site-roco` **reconstruído** com
este código e conferido.

**Rodada anterior (segunda, já commitada em `add519a` + `5dd95b5`) — mudanças (a–g)**:
- Embalagens: todas aparecem (sem padrão); descrição gerada
- Cache expira na hora em edição (sintoma: embalagem não aparecia)
- Painel centralizado 1280px
- Materiais: biblioteca por setor + gestão separada
- Link estável de material via rota autenticada (antes: presignada vencia)
- Migration 0011: garantia de permissões no boot
- Upload home com tipo/tamanho ASSINADOS + HEAD
- Testes: 1571 em 55 arquivos; lint 0 erros; build verde

**Mudanças desta sessão** (detalhes no decisionLog, entrada de 2026-09-30 "Filtros combinados…"):
- **"Força de Vendas" → "Portal ROCO"** em todo texto visível (chamada da home, rodapé, descrição
  no editor da home; `portal.shell.appName` em pt, que vai no título das abas do portal). O botão
  da chamada virou "Faça seu pré-cadastro" / "Pre-register now" para não repetir o título.
- **Filtros combinados em `/produtos`**: várias categorias (OU) e vários termos de busca (E); Enter
  ou "+" fixa o termo como chip e libera o campo; até 5 chips; parâmetros repetidos na URL.
- **Dois bugs de navegação pré-existentes corrigidos** (achados na verificação): com filtros
  aplicados, clicar em "Produtos" no menu mantinha a lista filtrada numa URL limpa; e voltar do
  detalhe pelo navegador mostrava a URL filtrada com a lista inteira. Correção: URL como fonte da
  verdade no explorador (ver systemPatterns).
- **Relacionados do detalhe do produto** passaram a usar o cache (antes rodavam sem cache a cada visita).
- **Redes sociais no painel** (`/portal/configuracoes`, bloco que já existia com 4 campos de URL):
  agora aceita @perfil, nome da página, número de WhatsApp ou link, mostra o link final, testa o
  link, oferece o telefone do Contato para o WhatsApp e prévia do rodapé; grava o link canônico.

**Validação ponta a ponta no navegador (dev server; desktop e mobile via iframe de 390px)**:
- **Filtros**: "engate" + "3/4" → 1 produto (igual a buscar "engate 3/4"); 2 categorias somam
  (6 + 43 = 49); busca + categorias; recarregar a URL com parâmetros repetidos reconstrói chips e
  caixas; teto de 5 termos com aviso; gaveta do mobile não fecha ao marcar; busca do header
  substitui os filtros; "Produtos" no menu limpa; voltar do detalhe restaura filtros e resultados;
  `?page=999` cai na última página sem chamada extra à API; console sem erro/aviso de hidratação.
- **Redes sociais** (admin local): `@rocoindustria` → `https://www.instagram.com/rocoindustria`;
  link de Instagram no campo LinkedIn → erro; `youtube.com/@x` completado; atalho do telefone
  preencheu `554733352012`; salvar com erro bloqueado. NADA salvo (alterações descartadas).
- **Renomeação**: home pt/en sem "Força de Vendas"/"Sales Force"; "Portal ROCO" 3× (menu, chamada, rodapé).
- **Container reconstruído**: home, produtos (com filtros repetidos), contato, representantes e
  detalhe 200; API com 2 categorias → 49; otimizador de imagem 200.

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
- Branch: `feat/porta-mais-site` — tudo commitado e enviado (`cc8423e` + documentação); sem
  merge em `main`. Nenhum dado do painel foi salvo durante os testes.
- Testes: 1610 em 56 arquivos (+39 sobre os 1571 da rodada anterior: +30 `listing-filters`,
  +8 `site-settings-form` (22 no total), +1 `sql-like-match`).
- Build de produção: verde (`npm run build`); lint 0 erros (6 avisos antigos em
  `src/server/trpc/routers/site-settings.ts`, arquivo não tocado).
- Container local: reconstruído com este código e conferido (páginas 200, API com filtros
  repetidos, otimizador de imagem 200).

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
- merge `feat/porta-mais-site` → `main` (a branch já está no remoto)
- seed em produção: `npm run db:seed` com `DATABASE_URL` de produção
- Publicar o site em produção (main está ~70+ commits atrás)
