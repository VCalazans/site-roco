"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type HeroFormDialogProps = {
  open: boolean;
  onClose: () => void;
  slideId: string | null;
  dictionary: PortalDictionary["hero"];
  commonDictionary: PortalDictionary["common"];
  errorLabel: string;
};

type TabKey = "media" | "copy" | "ctas" | "playback" | "schedule";

type FormState = {
  kind: "youtube" | "upload";
  slug: string;
  youtubeId: string;
  r2Key: string;
  r2PosterKey: string;
  eyebrowPt: string;
  eyebrowEn: string;
  headlinePt: string;
  headlineEn: string;
  descriptionPt: string;
  descriptionEn: string;
  primaryCtaLabelPt: string;
  primaryCtaLabelEn: string;
  primaryCtaHref: string;
  secondaryCtaLabelPt: string;
  secondaryCtaLabelEn: string;
  secondaryCtaHref: string;
  loopWindowStartSeconds: string;
  loopWindowEndSeconds: string;
  autoAdvanceSeconds: string;
  muted: boolean;
  published: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY: FormState = {
  kind: "youtube",
  slug: "",
  youtubeId: "",
  r2Key: "",
  r2PosterKey: "",
  eyebrowPt: "",
  eyebrowEn: "",
  headlinePt: "",
  headlineEn: "",
  descriptionPt: "",
  descriptionEn: "",
  primaryCtaLabelPt: "",
  primaryCtaLabelEn: "",
  primaryCtaHref: "",
  secondaryCtaLabelPt: "",
  secondaryCtaLabelEn: "",
  secondaryCtaHref: "",
  loopWindowStartSeconds: "",
  loopWindowEndSeconds: "",
  autoAdvanceSeconds: "",
  muted: true,
  published: false,
  startsAt: "",
  endsAt: "",
};

function toInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  // Formato compatível com <input type="datetime-local">: YYYY-MM-DDTHH:mm
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputValue(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function HeroFormDialog({
  open,
  onClose,
  slideId,
  dictionary,
  commonDictionary,
  errorLabel,
}: HeroFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(slideId);
  const [tab, setTab] = useState<TabKey>("media");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [hydratedFrom, setHydratedFrom] = useState<unknown>(undefined);

  const detailQuery = useQuery(
    trpc.heroSlides.list.queryOptions(undefined, {
      enabled: Boolean(currentId) && open,
      select: (data) => data.find((s) => s.id === currentId) ?? null,
    })
  );

  if (detailQuery.data && detailQuery.data !== hydratedFrom) {
    const s = detailQuery.data;
    setHydratedFrom(s);
    setForm({
      kind: s.kind,
      slug: s.slug,
      youtubeId: s.youtubeId ?? "",
      r2Key: s.r2Key ?? "",
      r2PosterKey: s.r2PosterKey ?? "",
      eyebrowPt: s.eyebrowPt ?? "",
      eyebrowEn: s.eyebrowEn ?? "",
      headlinePt: s.headlinePt,
      headlineEn: s.headlineEn ?? "",
      descriptionPt: s.descriptionPt ?? "",
      descriptionEn: s.descriptionEn ?? "",
      primaryCtaLabelPt: s.primaryCtaLabelPt ?? "",
      primaryCtaLabelEn: s.primaryCtaLabelEn ?? "",
      primaryCtaHref: s.primaryCtaHref ?? "",
      secondaryCtaLabelPt: s.secondaryCtaLabelPt ?? "",
      secondaryCtaLabelEn: s.secondaryCtaLabelEn ?? "",
      secondaryCtaHref: s.secondaryCtaHref ?? "",
      loopWindowStartSeconds: s.loopWindowStartSeconds?.toString() ?? "",
      loopWindowEndSeconds: s.loopWindowEndSeconds?.toString() ?? "",
      autoAdvanceSeconds: s.autoAdvanceSeconds?.toString() ?? "",
      muted: s.muted,
      published: s.published,
      startsAt: toInputValue(s.startsAt),
      endsAt: toInputValue(s.endsAt),
    });
  }

  // Sincroniza `currentId` e a aba inicial quando o pai troca de slide (de
  // nenhum para um existente, ou de um para outro). `currentId` é puro
  // (derivado de `slideId`); a aba volta para "media" no remount — quando o
  // pai usa `key={formInstance}`, todo o componente remonta e este bloco
  // é executado uma única vez por abertura.
  if (slideId !== currentId) {
    setCurrentId(slideId);
    setTab("media");
    setHydratedFrom(undefined);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.heroSlides.list.queryKey() });
  }

  const createMutation = useMutation(
    trpc.heroSlides.create.mutationOptions({
      onSuccess: (created) => {
        setCurrentId(created.id);
        invalidate();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.heroSlides.update.mutationOptions({ onSuccess: invalidate })
  );

  const isEditing = Boolean(currentId);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload() {
    return {
      slug: form.slug || undefined,
      kind: form.kind,
      youtubeId: form.kind === "youtube" ? form.youtubeId.trim() : undefined,
      r2Key: form.kind === "upload" ? form.r2Key.trim() : undefined,
      r2PosterKey: form.r2PosterKey.trim() || undefined,
      eyebrowPt: form.eyebrowPt || undefined,
      eyebrowEn: form.eyebrowEn || undefined,
      headlinePt: form.headlinePt.trim(),
      headlineEn: form.headlineEn || undefined,
      descriptionPt: form.descriptionPt || undefined,
      descriptionEn: form.descriptionEn || undefined,
      primaryCtaLabelPt: form.primaryCtaLabelPt || undefined,
      primaryCtaLabelEn: form.primaryCtaLabelEn || undefined,
      primaryCtaHref: form.primaryCtaHref || undefined,
      secondaryCtaLabelPt: form.secondaryCtaLabelPt || undefined,
      secondaryCtaLabelEn: form.secondaryCtaLabelEn || undefined,
      secondaryCtaHref: form.secondaryCtaHref || undefined,
      loopWindowStartSeconds: parseIntOrNull(form.loopWindowStartSeconds),
      loopWindowEndSeconds: parseIntOrNull(form.loopWindowEndSeconds),
      autoAdvanceSeconds: parseIntOrNull(form.autoAdvanceSeconds),
      muted: form.muted,
      published: form.published,
      startsAt: fromInputValue(form.startsAt),
      endsAt: fromInputValue(form.endsAt),
    };
  }

  async function handleSave() {
    const payload = buildPayload();
    if (currentId) {
      await updateMutation.mutateAsync({ id: currentId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        {isEditing ? dictionary.form.editTitle : dictionary.form.createTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="media" label={dictionary.form.tabs.media} />
          <Tab value="copy" label={dictionary.form.tabs.copy} />
          <Tab value="ctas" label={dictionary.form.tabs.ctas} />
          <Tab value="playback" label={dictionary.form.tabs.playback} />
          <Tab value="schedule" label={dictionary.form.tabs.schedule} />
        </Tabs>

        {tab === "media" ? (
          <Stack spacing={2}>
            <TextField
              select
              label={dictionary.form.fields.kind}
              value={form.kind}
              onChange={(e) => setField("kind", e.target.value as FormState["kind"])}
              fullWidth
            >
              <MenuItem value="youtube">{dictionary.kind.youtube}</MenuItem>
              <MenuItem value="upload">{dictionary.kind.upload}</MenuItem>
            </TextField>
            {form.kind === "youtube" ? (
              <TextField
                label={dictionary.form.fields.kind === dictionary.form.fields.kind ? "YouTube ID" : "YouTube ID"}
                value={form.youtubeId}
                onChange={(e) => setField("youtubeId", e.target.value)}
                helperText={dictionary.media.youtubeHelper}
                fullWidth
              />
            ) : (
              <>
                <TextField
                  label="R2 Key (vídeo)"
                  value={form.r2Key}
                  onChange={(e) => setField("r2Key", e.target.value)}
                  helperText={dictionary.media.uploadHelper}
                  fullWidth
                />
                <TextField
                  label="R2 Key (pôster)"
                  value={form.r2PosterKey}
                  onChange={(e) => setField("r2PosterKey", e.target.value)}
                  fullWidth
                />
              </>
            )}
            <TextField
              label={dictionary.form.fields.slug}
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              fullWidth
            />
            {detailQuery.isError ? <Alert severity="error">{errorLabel}</Alert> : null}
          </Stack>
        ) : null}

        {tab === "copy" ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.eyebrowPt}
                value={form.eyebrowPt}
                onChange={(e) => setField("eyebrowPt", e.target.value)}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.eyebrowEn}
                value={form.eyebrowEn}
                onChange={(e) => setField("eyebrowEn", e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.headlinePt}
                value={form.headlinePt}
                onChange={(e) => setField("headlinePt", e.target.value)}
                required
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.headlineEn}
                value={form.headlineEn}
                onChange={(e) => setField("headlineEn", e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.descriptionPt}
                value={form.descriptionPt}
                onChange={(e) => setField("descriptionPt", e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.descriptionEn}
                value={form.descriptionEn}
                onChange={(e) => setField("descriptionEn", e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
          </Stack>
        ) : null}

        {tab === "ctas" ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.primaryCtaLabelPt}
                value={form.primaryCtaLabelPt}
                onChange={(e) => setField("primaryCtaLabelPt", e.target.value)}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.primaryCtaLabelEn}
                value={form.primaryCtaLabelEn}
                onChange={(e) => setField("primaryCtaLabelEn", e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label={dictionary.form.fields.primaryCtaHref}
              value={form.primaryCtaHref}
              onChange={(e) => setField("primaryCtaHref", e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.secondaryCtaLabelPt}
                value={form.secondaryCtaLabelPt}
                onChange={(e) => setField("secondaryCtaLabelPt", e.target.value)}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.secondaryCtaLabelEn}
                value={form.secondaryCtaLabelEn}
                onChange={(e) => setField("secondaryCtaLabelEn", e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label={dictionary.form.fields.secondaryCtaHref}
              value={form.secondaryCtaHref}
              onChange={(e) => setField("secondaryCtaHref", e.target.value)}
              fullWidth
            />
          </Stack>
        ) : null}

        {tab === "playback" ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.loopWindowStart}
                value={form.loopWindowStartSeconds}
                onChange={(e) => setField("loopWindowStartSeconds", e.target.value)}
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                helperText={dictionary.loopWindowHelper}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.loopWindowEnd}
                value={form.loopWindowEndSeconds}
                onChange={(e) => setField("loopWindowEndSeconds", e.target.value)}
                type="number"
                slotProps={{ htmlInput: { min: 0 } }}
                fullWidth
              />
            </Stack>
            <TextField
              label={dictionary.form.fields.autoAdvance}
              value={form.autoAdvanceSeconds}
              onChange={(e) => setField("autoAdvanceSeconds", e.target.value)}
              type="number"
              slotProps={{ htmlInput: { min: 0, max: 60 } }}
              helperText={dictionary.autoAdvanceHelper}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.muted}
                  onChange={(e) => setField("muted", e.target.checked)}
                />
              }
              label={dictionary.form.fields.muted}
            />
          </Stack>
        ) : null}

        {tab === "schedule" ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={dictionary.form.fields.startsAt}
                value={form.startsAt}
                onChange={(e) => setField("startsAt", e.target.value)}
                type="datetime-local"
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label={dictionary.form.fields.endsAt}
                value={form.endsAt}
                onChange={(e) => setField("endsAt", e.target.value)}
                type="datetime-local"
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={form.published}
                  onChange={(e) => setField("published", e.target.checked)}
                />
              }
              label={dictionary.form.fields.published}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                {commonDictionary.save}
              </Typography>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{dictionary.form.actions.cancel}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !form.headlinePt.trim()}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {dictionary.form.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
