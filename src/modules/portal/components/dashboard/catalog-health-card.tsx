"use client";

import Link from "next/link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HideImageIcon from "@mui/icons-material/HideImage";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { PortalDashboardDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type HealthStats = {
  total: number;
  published: number;
  unpublished: number;
  publishedWithoutImage: number;
};

type CatalogHealthCardProps = {
  dictionary: PortalDashboardDictionary["health"];
  stats?: HealthStats;
  loading: boolean;
  error: boolean;
  /** `portal.errors.generic`. */
  errorLabel: string;
  /** Listagem já filtrada em "publicados sem foto" / "não publicados". */
  noPhotoHref: string;
  unpublishedHref: string;
};

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

function ProgressRow({
  label,
  valueText,
  value,
  color,
}: {
  label: string;
  valueText: string;
  value: number;
  color: "primary" | "success" | "warning";
}) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {valueText}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        color={color}
        aria-label={label}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

/**
 * "Saúde do catálogo": duas réguas do que o visitante encontra no site — quanto
 * do cadastro está publicado e quanto do publicado tem foto — com atalho para a
 * lista já filtrada no que precisa de atenção. Produto não publicado NÃO é
 * tratado como problema (rascunho é um estado normal): só "publicado sem foto"
 * vira alerta.
 */
export function CatalogHealthCard({
  dictionary,
  stats,
  loading,
  error,
  errorLabel,
  noPhotoHref,
  unpublishedHref,
}: CatalogHealthCardProps) {
  const withPhoto = stats ? Math.max(0, stats.published - stats.publishedWithoutImage) : 0;
  const photoPercent = stats ? percent(withPhoto, stats.published) : 0;

  return (
    <Paper variant="outlined" component="section" aria-labelledby="dashboard-catalog-health" sx={{ p: 2.5 }}>
      <Typography id="dashboard-catalog-health" variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
        {dictionary.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {dictionary.subtitle}
      </Typography>

      {error ? <Alert severity="warning">{errorLabel}</Alert> : null}

      {loading ? (
        <Box aria-hidden>
          <Skeleton variant="text" height={28} />
          <Skeleton variant="rounded" height={8} sx={{ mb: 2 }} />
          <Skeleton variant="text" height={28} />
          <Skeleton variant="rounded" height={8} />
        </Box>
      ) : null}

      {!loading && stats && stats.total === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          {dictionary.noProducts}
        </Typography>
      ) : null}

      {!loading && stats && stats.total > 0 ? (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          <ProgressRow
            label={dictionary.published}
            valueText={interpolate(dictionary.ofTotal, {
              value: stats.published,
              total: stats.total,
            })}
            value={percent(stats.published, stats.total)}
            color="primary"
          />
          <ProgressRow
            label={dictionary.withPhoto}
            valueText={interpolate(dictionary.ofTotal, {
              value: withPhoto,
              total: stats.published,
            })}
            value={photoPercent}
            color={stats.publishedWithoutImage > 0 ? "warning" : "success"}
          />

          {stats.publishedWithoutImage === 0 ? (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
              {dictionary.healthy}
            </Alert>
          ) : null}

          {stats.publishedWithoutImage > 0 || stats.unpublished > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {stats.publishedWithoutImage > 0 ? (
                <Button
                  component={Link}
                  href={noPhotoHref}
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<HideImageIcon fontSize="small" />}
                >
                  {dictionary.reviewNoPhoto}
                </Button>
              ) : null}
              {stats.unpublished > 0 ? (
                <Button component={Link} href={unpublishedHref} size="small" variant="text">
                  {interpolate(dictionary.reviewUnpublished, { count: stats.unpublished })}
                </Button>
              ) : null}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Paper>
  );
}
