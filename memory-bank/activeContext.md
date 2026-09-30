# Active Context — ROCO

## Sessão atual (2026-09-30, quinta rodada)
Pedidos do stakeholder: (1) documentar a discussão das embalagens no padrão GS1 SEM implementar
(spec 002, em espera); (2) ocultar o login com Google por enquanto; (3) criação de conta e
recuperação de senha confiáveis, com links por e-mail e os devidos cuidados de segurança — SMTP com
as variáveis prontas no `.env` para ele preencher; depois, no meio da rodada: (4) um aviso para quem
ainda não foi aprovado não ficar perdido ao entrar; (5) regiões pré-cadastradas (base do IBGE) para
a área de atuação do representante — escolhido: estados + regiões + cidades numa busca única, sem
endereço da empresa. **Tudo implementado, validado e commitado** na branch `feat/porta-mais-site`
(`c632d6a` spec 002, `4a5ab10` feature e o commit de documentação; sem push, sem merge em `main`).
`tsc` limpo, lint 0 erros, 1744 testes em 75 arquivos, `next build` verde, `npm audit --omit=dev` = 0.
Detalhes no decisionLog (três entradas de 2026-09-30: contas, aviso, área de atuação).

**Mudanças desta rodada**:
- Google oculto por flag (`AUTH_GOOGLE_ENABLED`); desligado, o provider nem é registrado.
- Pré-cadastro com confirmação de e-mail; login avisa "e-mail não confirmado" (só depois da senha conferir).
- Esqueci/redefinir senha por link (60 min), aviso "Sua senha foi alterada", sessões antigas caem em ≤ 5 min.
- Tokens no fragmento do link, só o hash no banco, uso único; respostas genéricas e envio em `after()`.
- Política de senha única (NIST); CNPJ compartilhado entre pré-cadastros não confirmados (o primeiro a
  confirmar entra na fila); limpeza dos nunca confirmados em 7 dias.
- Revisão de segurança (0 crítico, 0 alto): corrigidos os 3 médios (nome/saudação/limite por destinatário;
  login sem teto global; login fail-closed) e os baixos B1, B3, B4, B5, B6, B8, I5.
- `/portal` para quem entra sem perfil: aviso "Seu cadastro está em análise" (e os demais estados).
- Área de atuação com a base do IBGE (tabela `representative_territories`, migration 0015), no wizard, na
  conclusão do cadastro e no admin (edição e filtro "Estado de atuação").
- Achados e corrigidos na validação: erro inesperado do tRPC vazava a consulta SQL com parâmetros para o
  cliente; a busca por nome/e-mail da lista de representantes dava 500.

**Validação**:
- Contas ponta a ponta no navegador + capturador SMTP local (cadastro, confirmação, reenvio, esqueci a
  senha, troca de senha derrubando a sessão, limites, anti-enumeração) — ver progress.md.
- Correções da revisão pela API do dev server: nome com frase de golpe → 400; saudação "Olá, Ana!"; dois
  cadastros com o mesmo CNPJ → o segundo a confirmar recebe `cnpjConflict`; 6ª tentativa de login →
  "Muitas tentativas"; conta inexistente leva o mesmo tempo que senha errada (bcrypt sempre).
- Aviso no navegador: em análise (data, empresa, etapas), aprovado com a sessão antiga e conflito de CNPJ.
- Área de atuação no navegador (busca "vale" → regiões primeiro; "pr" → Paraná; chips; conclusão salva
  com 3 áreas e o resumo) e no admin pela API (filtro por UF, troca de áreas, código inválido 400, editar
  notas mantém as áreas). A aba do navegador ficou em segundo plano (o Chrome atrasa timers e capturas de
  tela) — parte da validação foi feita pelo DOM e pela API.
- Contas e auditoria de teste apagadas; o representante do `db:seed:qa` agora tem áreas ("Vale do
  Itajaí — SC · Curitiba — PR"). O navegador ficou logado numa conta de teste já apagada — basta entrar de
  novo como admin.

**Rodadas anteriores (commitadas e já em `origin/feat/porta-mais-site`)**:
- 4ª (`852a916` + `283bc3b`): paginação numerada no portal, imagens do produto no site
  (exibir/capa), download dos originais (avulso e ZIP), dados de teste (`db:seed:qa`), revisão OWASP.
- 3ª (`cc8423e` + `c46569e`): "Portal ROCO", filtros combinados em `/produtos`, redes sociais por @perfil.
- 2ª (`add519a` + `5dd95b5`): embalagens sem padrão, cache imediato, painel centralizado, materiais
  por setor, material via rota autenticada, permissões no boot, upload da home assinado.

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
- Branch: `feat/porta-mais-site` — a 5ª rodada já está no remoto. Depois dela, SEM push: `1f94551` (catálogo
  online + logo em todos os slides), `af8403e` (docs) e o merge da `main` (`4ae5a02`, com os 6 commits de
  produção). A branch contém a `main` inteira: levá-la para a `main` agora é fast-forward.
- Testes: 1749 em 76 arquivos (+5 depois da 5ª rodada: logo do hero e destino do catálogo).
- Build de produção verde; lint 0 erros (6 avisos antigos em `site-settings.ts`).
- Banco local: migrations 0014 e 0015 aplicadas (journal com 16, 0000–0015).
- Container local reconstruído com o código desta rodada e conferido (ver progress.md).

## RD Station — VALIDADO em 2026-08-31
Chave de API nova (Integrações → API Keys) funciona: chamada direta devolve 200 + `event_uuid`, e
`POST /api/contact` grava `rd_station_status = "sent"` com o uuid preenchido. O 401 anterior era
credencial da API LEGADA 1.3 ("token público/privado"), sistema de autenticação diferente da
Conversions API. Nenhuma mudança de código foi necessária.
⚠️ Sonda revelou que o RD aceita campo personalizado INEXISTENTE com HTTP 200 — descarta em
silêncio. Os quatro `cf_*` precisam ser criados no painel, e a ausência deles NÃO aparece em erro
nenhum (nem na API, nem no nosso banco). Ver decisionLog 2026-08-31.

## Pending
- **Decisão de produto**: destino da página `/catalogo`, agora sem link (redirecionar para o catálogo online ou tirar do sitemap).
- **Merge da `main` feito** (pop-ups do RD na CSP, sem botão próprio de WhatsApp — ver decisionLog
  2026-09-30); decisões abertas dos pop-ups do RD em progress.md (Site).
- **Compartilhar com o cliente**: manual de uso e resumo de entregas são artifacts privados — o cliente só abre depois que forem compartilhados.
- **SMTP (stakeholder)**: preencher `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e
  `MAIL_FROM` no `.env` (e nas envs de produção). Sem isso os e-mails de confirmação e de
  redefinição NÃO saem — ninguém conclui o pré-cadastro nem troca a senha (o container local
  também não envia). Conferir `AUTH_URL` https de produção (vai nos links) e desligar o rastreio de
  clique do provedor SMTP.
- **Spec 002 (embalagens GS1)**: em espera, com 4 decisões do stakeholder
  (`memory-bank/specs/002-embalagens-gs1.md`).
- **Sugestões abertas**: e-mail avisando a aprovação/reprovação; ação do admin para reenviar/confirmar
  cadastro sem confirmação; itens abertos da revisão de segurança (progress.md, Riscos).
- **Antes de ligar o Google SSO**: corrigir a concessão automática da role `representative` no 1º
  login Google (achado ALTO latente — ver progress.md, Riscos) e decidir o `emailVerified` das
  contas criadas por ele.
- **Decisão de produto**: representante baixa imagens de produtos NÃO publicados? Hoje sim
  (coerente com a listagem do portal, onde ele já os vê).
- **Atualizar Node local para 22** (AWS SDK exigirá em jan/2027; Docker já usa node:22-alpine).
- **RD Station (stakeholder)**: criar `cf_origem` no painel — é o ÚNICO campo que o código envia e
  a conta não tem. Sem ele, a seção do site que gerou o lead some em silêncio.
- **Resend**: provisionar `RESEND_API_KEY` + `CONTACT_FROM_EMAIL` + `CONTACT_NOTIFICATION_EMAIL`
  (aviso de lead; o SMTP das contas é outro canal).
- `RD_STATION_API_KEY` de PRODUÇÃO (a validada é a do ambiente local).
- Bucket R2 separado para conteúdo privado (ver progress.md, Riscos).
- **Push + levar `feat/porta-mais-site` para a `main`** (a branch já contém a `main`: fast-forward).
- **Seed de produção**: `npm run db:seed` (o `db:seed:qa` recusa rodar fora de banco local).
- Publicar o site em produção (main está ~70+ commits atrás).
