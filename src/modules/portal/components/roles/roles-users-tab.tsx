"use client";

import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type RolesUsersTabProps = {
  portal: PortalDictionary;
};

type RoleOption = { id: string; name: string };

type AssignMenuState = {
  anchorEl: HTMLElement;
  userId: string;
  assignableRoles: RoleOption[];
};

/** Debounce da busca (ms) — mesmo padrão de `representatives-page-client.tsx`. */
const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_PER_PAGE = 10;

/**
 * Aba "Usuários" — busca + tabela paginada (`roles.listUsers`), com Chips
 * de perfis atribuídos (remover via `unassignUserRole`) e atribuição de
 * novo perfil via menu popover por linha (`assignUserRole`). Erros do
 * servidor (último admin, anti-escalonamento) só são exibidos — a lógica
 * de guarda não é replicada aqui.
 */
export function RolesUsersTab({ portal }: RolesUsersTabProps) {
  const dictionary = portal.roles;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [assignMenu, setAssignMenu] = useState<AssignMenuState | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const listQuery = useQuery(
    trpc.roles.listUsers.queryOptions({ search: search || undefined, page: page + 1, perPage })
  );
  const rolesQuery = useQuery(trpc.roles.listRoles.queryOptions());

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const roles = rolesQuery.data ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.roles.listUsers.queryKey() });
  }

  const assignMutation = useMutation(
    trpc.roles.assignUserRole.mutationOptions({
      onSuccess: () => {
        invalidate();
        setAssignMenu(null);
      },
    })
  );
  const unassignMutation = useMutation(
    trpc.roles.unassignUserRole.mutationOptions({ onSuccess: invalidate })
  );

  const mutationError = assignMutation.error?.message ?? unassignMutation.error?.message ?? null;

  return (
    <Box>
      <TextField
        label={dictionary.users.searchPlaceholder}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 360 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {listQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {portal.errors.generic}
        </Alert>
      ) : null}
      {mutationError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {mutationError}
        </Alert>
      ) : null}

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{dictionary.users.table.name}</TableCell>
                <TableCell>{dictionary.users.table.email}</TableCell>
                <TableCell>{dictionary.users.table.roles}</TableCell>
                <TableCell>{dictionary.users.table.status}</TableCell>
                <TableCell align="right">{dictionary.users.table.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell colSpan={5}>
                        <Skeleton variant="text" />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((user) => {
                    const assignableRoles: RoleOption[] = roles.filter(
                      (role) => !user.roles.some((assigned) => assigned.id === role.id)
                    );
                    return (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.name ?? "—"}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                            {user.roles.map((role) => (
                              <Chip
                                key={role.id}
                                size="small"
                                label={role.name}
                                onDelete={() =>
                                  unassignMutation.mutate({ userId: user.id, roleId: role.id })
                                }
                                deleteIcon={<CloseIcon aria-label={dictionary.users.removeRole} />}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {/* Dicionário `roles` não tem rótulo dedicado para
                              status de usuário — reaproveita
                              `portal.products.status.active`/`inactive`
                              ("Ativo"/"Inativo", genérico o bastante), mesmo
                              padrão de reuso documentado em
                              `product-form-dialog.tsx`; ver relatório final. */}
                          {user.active ? portal.products.status.active : portal.products.status.inactive}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={dictionary.users.assignRole}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={dictionary.users.assignRole}
                                disabled={assignableRoles.length === 0}
                                onClick={(event) =>
                                  setAssignMenu({
                                    anchorEl: event.currentTarget,
                                    userId: user.id,
                                    assignableRoles,
                                  })
                                }
                              >
                                <AddIcon fontSize="small" />
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
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          rowsPerPage={perPage}
          onRowsPerPageChange={(event) => {
            setPerPage(Number(event.target.value));
            setPage(0);
          }}
        />
      </Paper>

      <Menu anchorEl={assignMenu?.anchorEl ?? null} open={Boolean(assignMenu)} onClose={() => setAssignMenu(null)}>
        {assignMenu
          ? assignMenu.assignableRoles.map((role) => (
              <MenuItem
                key={role.id}
                onClick={() => assignMutation.mutate({ userId: assignMenu.userId, roleId: role.id })}
              >
                {role.name}
              </MenuItem>
            ))
          : null}
      </Menu>
    </Box>
  );
}
