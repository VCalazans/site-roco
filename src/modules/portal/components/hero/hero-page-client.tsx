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
import { HeroTable, type HeroRow } from "./hero-table";
import { HeroFormDialog } from "./hero-form-dialog";
import { HeroDeleteDialog } from "./hero-delete-dialog";

type HeroPageClientProps = {
  portal: PortalDictionary;
  canWrite: boolean;
  canDelete: boolean;
};

export function HeroPageClient({ portal, canWrite, canDelete }: HeroPageClientProps) {
  const dictionary = portal.hero;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(trpc.heroSlides.list.queryOptions());

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HeroRow | null>(null);

  const rows = useMemo<HeroRow[]>(
    () =>
      (listQuery.data ?? []).map((slide) => ({
        id: slide.id,
        slug: slide.slug,
        kind: slide.kind,
        youtubeId: slide.youtubeId,
        videoUrl: slide.videoUrl,
        posterUrl: slide.posterUrl,
        headlinePt: slide.headlinePt,
        headlineEn: slide.headlineEn,
        sortOrder: slide.sortOrder,
        published: slide.published,
        startsAt: slide.startsAt,
        endsAt: slide.endsAt,
        autoAdvanceSeconds: slide.autoAdvanceSeconds,
        muted: slide.muted,
        r2Key: slide.r2Key,
        r2PosterKey: slide.r2PosterKey,
        eyebrowPt: slide.eyebrowPt,
        eyebrowEn: slide.eyebrowEn,
        descriptionPt: slide.descriptionPt,
        descriptionEn: slide.descriptionEn,
        primaryCtaLabelPt: slide.primaryCtaLabelPt,
        primaryCtaLabelEn: slide.primaryCtaLabelEn,
        primaryCtaHref: slide.primaryCtaHref,
        secondaryCtaLabelPt: slide.secondaryCtaLabelPt,
        secondaryCtaLabelEn: slide.secondaryCtaLabelEn,
        secondaryCtaHref: slide.secondaryCtaHref,
        loopWindowStartSeconds: slide.loopWindowStartSeconds,
        loopWindowEndSeconds: slide.loopWindowEndSeconds,
        createdAt: slide.createdAt,
        updatedAt: slide.updatedAt,
      })),
    [listQuery.data]
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.heroSlides.list.queryKey() });
  }

  const reorderMutation = useMutation(
    trpc.heroSlides.reorder.mutationOptions({ onSuccess: invalidate })
  );

  const deleteMutation = useMutation(
    trpc.heroSlides.delete.mutationOptions({
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
            {dictionary.actions.newSlide}
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
          <HeroTable
            dictionary={dictionary}
            rows={rows}
            isLoading={listQuery.isLoading}
            canWrite={canWrite}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onReorder={(orderedIds) => reorderMutation.mutate({ orderedIds })}
            isReordering={reorderMutation.isPending}
          />
        </Paper>
      )}

      <HeroFormDialog
        key={formInstance}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        slideId={editingId}
        dictionary={dictionary}
        commonDictionary={portal.common}
        errorLabel={portal.errors.generic}
      />

      <HeroDeleteDialog
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
