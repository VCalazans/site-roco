"use client";

import { useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { MaterialTable, type MaterialRow } from "./material-table";
import { MaterialFormDialog } from "./material-form-dialog";
import { MaterialDeleteDialog } from "./material-delete-dialog";

type MaterialsPageClientProps = {
  portal: PortalDictionary;
  canWrite: boolean;
  canDelete: boolean;
};

/**
 * Mirror de `hero-page-client.tsx`, sem reorder — a ordem do feed de
 * materiais é sempre `publishedAt DESC` (automática, ver
 * `materials.listPublished` no router tRPC), não há um campo `sortOrder`
 * editável pelo admin.
 */
export function MaterialsPageClient({ portal, canWrite, canDelete }: MaterialsPageClientProps) {
  const dictionary = portal.materials;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.materials.list.queryOptions());

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<MaterialRow | null>(null);

  const rows = useMemo<MaterialRow[]>(
    () =>
      (listQuery.data ?? []).map((material) => ({
        id: material.id,
        titlePt: material.titlePt,
        titleEn: material.titleEn,
        category: material.category,
        contentType: material.contentType,
        filename: material.filename,
        sizeBytes: material.sizeBytes,
        published: material.published,
        publishedAt: material.publishedAt,
        downloadUrl: material.downloadUrl,
        descriptionPt: material.descriptionPt,
        descriptionEn: material.descriptionEn,
      })),
    [listQuery.data]
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.materials.list.queryKey() });
  }

  const deleteMutation = useMutation(
    trpc.materials.delete.mutationOptions({
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
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {dictionary.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {dictionary.subtitle}
          </Typography>
        </Box>
        {canWrite ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {dictionary.actions.newMaterial}
          </Button>
        ) : null}
      </Stack>

      {listQuery.isError ? <Alert severity="error">{portal.errors.generic}</Alert> : null}

      {!listQuery.isLoading && rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h6">{dictionary.empty.title}</Typography>
          <Typography color="text.secondary">{dictionary.empty.description}</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <MaterialTable
            dictionary={dictionary}
            rows={rows}
            isLoading={listQuery.isLoading}
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </Paper>
      )}

      <MaterialFormDialog
        key={formInstance}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        materialId={editingId}
        dictionary={dictionary}
        errorLabel={portal.errors.generic}
      />

      <MaterialDeleteDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
        }}
        isDeleting={deleteMutation.isPending}
        dictionary={dictionary.deleteConfirm}
      />
    </Box>
  );
}
