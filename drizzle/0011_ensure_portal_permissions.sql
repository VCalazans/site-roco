-- Garante as permissões dos módulos do portal em TODO ambiente (2026-09-30).
--
-- Motivo: o representante logava e não via os materiais publicados. As
-- permissões `materials:*` (2026-08-24) e `home_content:*`/`leads:read`
-- (spec 001) só existiam depois de alguém rodar `npm run db:seed` no ambiente
-- — passo manual, fácil de esquecer num redeploy. Sem `materials:read`, a
-- consulta dos materiais responde FORBIDDEN e o representante vê o aviso de
-- "sem permissão" em vez da biblioteca.
--
-- As migrations rodam SOZINHAS no boot do container (scripts/migrate.mjs),
-- então esta aplica, uma única vez por banco, exatamente as concessões que o
-- seed faria para estes recursos:
--   admin          → todas
--   sales_manager  → materials create/read/update · home_content read/update · leads read
--   representative → materials read
-- Idempotente (ON CONFLICT DO NOTHING) e inofensiva num banco sem roles ainda
-- (o JOIN não encontra nada e o seed faz depois). Não REMOVE nada: um perfil
-- ajustado à mão na tela de Perfis continua como está, exceto por ganhar o
-- que faltava desta lista.

INSERT INTO "permissions" ("resource", "action") VALUES
  ('materials', 'create'),
  ('materials', 'read'),
  ('materials', 'update'),
  ('materials', 'delete'),
  ('home_content', 'read'),
  ('home_content', 'update'),
  ('leads', 'read')
ON CONFLICT ("resource", "action") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON (
  (r."slug" = 'admin' AND (p."resource", p."action") IN (
    ('materials', 'create'), ('materials', 'read'), ('materials', 'update'), ('materials', 'delete'),
    ('home_content', 'read'), ('home_content', 'update'),
    ('leads', 'read')
  ))
  OR (r."slug" = 'sales_manager' AND (p."resource", p."action") IN (
    ('materials', 'create'), ('materials', 'read'), ('materials', 'update'),
    ('home_content', 'read'), ('home_content', 'update'),
    ('leads', 'read')
  ))
  OR (r."slug" = 'representative' AND p."resource" = 'materials' AND p."action" = 'read')
)
ON CONFLICT DO NOTHING;
