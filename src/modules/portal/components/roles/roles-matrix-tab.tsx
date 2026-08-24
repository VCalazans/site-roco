"use client";

import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type RolesMatrixTabProps = {
  portal: PortalDictionary;
};

/**
 * Aba "Matriz de permissões" — para o perfil selecionado, grid de
 * checkboxes agrupado por `resource` (módulo) × `action`, usando
 * `roles.listPermissionsCatalog` como universo de checkboxes possíveis e
 * `role.permissionSlugs` (de `roles.listRoles`) como estado inicial
 * marcado. O perfil `admin` é sempre exibido 100% marcado e DESABILITADO
 * (acesso total implícito hardcoded em `hasPermission()`/`can()` — editar
 * a matriz dele não teria efeito real; o botão salvar nem aparece). Erros
 * de guarda do servidor (ex.: autolockout) são só exibidos — a lógica não
 * é replicada no client.
 */
export function RolesMatrixTab({ portal }: RolesMatrixTabProps) {
  const dictionary = portal.roles;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery(trpc.roles.listRoles.queryOptions());
  const catalogQuery = useQuery(trpc.roles.listPermissionsCatalog.queryOptions());

  const roles = rolesQuery.data ?? [];
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const isAdminRole = selectedRole?.slug === "admin";

  // Hidratação por referência: o estado local dos checkboxes vira a fonte
  // de verdade até o usuário salvar (mesmo padrão de outros formulários do
  // portal) — re-hidrata só quando o PERFIL selecionado muda.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [hydratedForRoleId, setHydratedForRoleId] = useState<string | null>(null);

  if (selectedRole && selectedRole.id !== hydratedForRoleId) {
    const slugSet = new Set(selectedRole.permissionSlugs);
    const ids = catalog
      .filter((permission) => slugSet.has(`${permission.resource}:${permission.action}`))
      .map((permission) => permission.id);
    setCheckedIds(new Set(ids));
    setHydratedForRoleId(selectedRole.id);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    for (const permission of catalog) {
      const list = map.get(permission.resource) ?? [];
      list.push(permission);
      map.set(permission.resource, list);
    }
    return map;
  }, [catalog]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.roles.listRoles.queryKey() });
  }

  const saveMutation = useMutation(
    trpc.roles.updateRolePermissions.mutationOptions({
      onSuccess: invalidate,
    })
  );

  function toggle(permissionId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  }

  function handleSave() {
    if (!selectedRole) return;
    saveMutation.mutate({ roleId: selectedRole.id, permissionIds: Array.from(checkedIds) });
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {dictionary.matrix.subtitle}
      </Typography>

      <FormControl size="small" sx={{ minWidth: 280, mb: 3 }}>
        <InputLabel id="roles-matrix-select-label">{dictionary.matrix.selectRole}</InputLabel>
        <Select
          labelId="roles-matrix-select-label"
          label={dictionary.matrix.selectRole}
          value={selectedRoleId}
          onChange={(event) => {
            saveMutation.reset();
            setSelectedRoleId(event.target.value as string);
          }}
        >
          {roles.map((role) => (
            <MenuItem key={role.id} value={role.id}>
              {role.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {rolesQuery.isError || catalogQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {portal.errors.generic}
        </Alert>
      ) : null}

      {selectedRole ? (
        <Stack spacing={3}>
          {isAdminRole ? <Alert severity="info">{dictionary.matrix.adminLockedNote}</Alert> : null}

          {Array.from(grouped.entries()).map(([resource, permissions]) => (
            <Paper key={resource} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {dictionary.matrix.modules[resource] ?? resource}
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {permissions.map((permission) => (
                  <FormControlLabel
                    key={permission.id}
                    control={
                      <Checkbox
                        checked={isAdminRole || checkedIds.has(permission.id)}
                        disabled={isAdminRole}
                        onChange={() => toggle(permission.id)}
                      />
                    }
                    label={dictionary.matrix.actionsLabels[permission.action] ?? permission.action}
                  />
                ))}
              </Stack>
            </Paper>
          ))}

          {saveMutation.isError ? <Alert severity="error">{saveMutation.error.message}</Alert> : null}
          {saveMutation.isSuccess ? (
            <Alert severity="success">{dictionary.matrix.savedMessage}</Alert>
          ) : null}

          {!isAdminRole ? (
            <Box>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : null}
              >
                {dictionary.matrix.saveButton}
              </Button>
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
