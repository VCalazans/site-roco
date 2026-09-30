# Active Context — ROCO

## Sessão atual (2026-09-30, segunda rodada)
Revisão pós-entrega da spec 001: **7 itens implementados e validados localmente** (build de
produção `next build` verde + navegador). **Commitado e enviado** na branch
`feat/porta-mais-site` (a pedido do stakeholder): `d459363` (deps), `add519a` (entrega da
spec 001 + revisão) e o commit de documentação. Merge em `main` NÃO feito. Container
`site-roco` RODANDO com a imagem nova (Next 16.3.7, reconstruída e conferida no fim da sessão).

**Mudanças (a–g)**:
- Embalagens: todas aparecem (sem padrão); descrição gerada
- Cache expira na hora em edição (sintoma: embalagem não aparecia)
- Painel centralizado 1280px
- Materiais: biblioteca por setor + gestão separada
- Link estável de material via rota autenticada (antes: presignada vencia)
- Migration 0011: garantia de permissões no boot
- Upload home com tipo/tamanho ASSINADOS + HEAD
- Testes: 1571 em 55 arquivos; lint 0 erros; build verde

**Validação ponta a ponta no navegador**:
- Admin (conta de teste): publica 2 materiais (upload real no R2), "Ver como representante",
  tabela de produtos com TODAS as embalagens, formulário sem "Padrão" e acusando embalagem
  repetida (nada salvo), upload da fachada com tipo/tamanho assinados
- Sales manager: validado só na 1ª rodada (menu sem Configurações/Perfis); não retestado nesta
- Representante aprovado (conta de teste): cai nas boas-vindas; menu Boas-vindas/Materiais/
  Cadastro/Produtos (sem Painel); vê "Materiais recentes" + biblioteca setorizada; abre o PDF
  pela rota (303 → R2); sem sessão → login no idioma; material apagado → 404
- Site: detalhe do produto com as 6 embalagens descritas (EAN, ordem tipo → quantidade);
  com 0 destaques a vitrine da home mostra 8 campeões (RF07)
- Upload home: tipo/tamanho ASSINADOS aceito, PUT adulterado recusado por R2

**Dados de teste**: revertidos (0 destaques, 0 layout salvo, sem contas QA).

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
- Branch: `feat/porta-mais-site` — tudo commitado e enviado ao remoto; sem merge em `main`
- Migrations: `0010_product_flags.sql` (57 produtos migrados de `top` para `best_seller`) e
  `0011_ensure_portal_permissions.sql` aplicadas no banco local (journal com 12 linhas)
- Container local: rodando com a imagem reconstruída em 2026-09-30 (migrations 0000–0011; smoke: home, produtos,
  orçamento, login do portal 200; `/carrinho` 308; download sem sessão → 303 relativo para o login)
- Dados de teste: revertidos (0 destaques, sem layout salvo, sem contas QA; "Teste Spec 001 Orçamento" mantida como exemplo)

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
