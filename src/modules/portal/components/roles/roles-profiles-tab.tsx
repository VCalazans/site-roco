"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { RoleFormDialog } from "./role-form-dialog";
import { RoleDeleteDialog } from "./role-delete-dialog";

export type RoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionSlugs: string[];
  userCount: number;
};

type RolesProfilesTabProps = {
  portal: PortalDictionary;
};

/**
 * Aba "Perfis" — tabela de `roles` (sistema + customizados) com CRUD.
 * Exclusão: os dois motivos de bloqueio (`isSystem`/`userCount > 0`) são
 * detectáveis no client a partir da própria linha — o botão de excluir já
 * nasce desabilitado nesses casos (UX melhor e mais barata que deixar o
 * usuário tentar e o servidor rejeitar); o dialog de confirmação também
 * mostra `deleteConfirm.blockedMessage` como nota permanente.
 */
export function RolesProfilesTab({ portal }: RolesProfilesTabProps) {
  const dictionary = portal.roles;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.roles.listRoles.queryOptions());
  const rows: RoleRow[] = listQuery.data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.roles.listRoles.queryKey() });
  }

  const deleteMutation = useMutation(
    trpc.roles.deleteRole.mutationOptions({
      onSuccess: () => {
        invalidate();
        setDeleteTarget(null);
      },
    })
  );

  function openCreate() {
    setEditingId(null);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  }
  function openEdit(id: string) {
    setEditingId(id);
    setFormInstance((n) => n + 1);
    setFormOpen(true);
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {dictionary.actions.newProfile}
        </Button>
      </Stack>

      {listQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {portal.errors.generic}
        </Alert>
      ) : null}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{dictionary.table.name}</TableCell>
                <TableCell>{dictionary.table.slug}</TableCell>
                <TableCell>{dictionary.table.description}</TableCell>
                <TableCell>{dictionary.table.usersCount}</TableCell>
                <TableCell>{dictionary.table.system}</TableCell>
                <TableCell align="right">{dictionary.table.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell colSpan={6}>
                        <Skeleton variant="text" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((role) => {
                    const canDelete = !role.isSystem && role.userCount === 0;
                    return (
                      <TableRow key={role.id} hover>
                        <TableCell>{role.name}</TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {role.slug}
                          </Typography>
                        </TableCell>
                        <TableCell>{role.description ?? "—"}</TableCell>
                        <TableCell>{role.userCount}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={role.isSystem ? dictionary.badges.system : dictionary.badges.custom}
                            color={role.isSystem ? "default" : "primary"}
                            variant={role.isSystem ? "outlined" : "filled"}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={dictionary.form.editTitle}>
                            <IconButton
                              size="small"
                              onClick={() => openEdit(role.id)}
                              aria-label={dictionary.form.editTitle}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={canDelete ? dictionary.deleteConfirm.title : dictionary.deleteConfirm.blockedMessage}
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={!canDelete}
                                onClick={() => setDeleteTarget(role)}
                                aria-label={dictionary.deleteConfirm.title}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <RoleFormDialog
        key={formInstance}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        roleId={editingId}
        roles={rows}
        dictionary={dictionary}
        errorLabel={portal.errors.generic}
      />

      <RoleDeleteDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
        isDeleting={deleteMutation.isPending}
        dictionary={dictionary.deleteConfirm}
        errorMessage={deleteMutation.isError ? deleteMutation.error.message : null}
      />
    </Box>
  );
}
