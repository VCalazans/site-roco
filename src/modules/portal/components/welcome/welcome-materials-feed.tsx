"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import TableChartIcon from "@mui/icons-material/TableChart";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import {
  isRecentMaterial,
  materialDownloadHref,
  materialKind,
  opensInBrowser,
  type MaterialKind,
} from "@/modules/portal/lib/materials-library";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type WelcomeMaterialsFeedProps = {
  locale: Locale;
  dictionary: PortalDictionary["welcome"]["materialsFeed"];
  /** Biblioteca completa, organizada por setor (`/{locale}/portal/materiais`). */
  libraryHref: string;
};

/** Quantos materiais recentes a home do representante mostra. */
const FEED_LIMIT = 4;

const KIND_ICONS: Record<MaterialKind, typeof PictureAsPdfIcon> = {
  pdf: PictureAsPdfIcon,
  video: OndemandVideoIcon,
  image: ImageIcon,
  spreadsheet: TableChartIcon,
  presentation: SlideshowIcon,
  document: DescriptionIcon,
  archive: FolderZipIcon,
  file: InsertDriveFileIcon,
};

/**
 * "Materiais recentes" na home do representante (revisão 2026-09-30): os
 * últimos publicados (mais recente primeiro — `publishedAt DESC` no servidor)
 * e um atalho para a biblioteca completa em `/portal/materiais`, organizada por
 * setor. Antes esta era a ÚNICA porta para os materiais: uma lista corrida no
 * fim da página, sem item de menu — o representante não os encontrava.
 *
 * Os links usam a rota autenticada de download (URL do R2 gerada no clique),
 * então não vencem com a página aberta.
 */
export function WelcomeMaterialsFeed({ locale, dictionary, libraryHref }: WelcomeMaterialsFeedProps) {
  const trpc = useTRPC();
  const listQuery = useQuery(trpc.materials.listPublished.queryOptions());
  const items = (listQuery.data ?? []).slice(0, FEED_LIMIT);
  const now = new Date();
  const dateLocale = locale === "pt" ? "pt-BR" : "en";

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h6" component="h2">
                {dictionary.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dictionary.subtitle}
              </Typography>
            </Stack>
            <Button
              href={libraryHref}
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}
            >
              {dictionary.viewAll}
            </Button>
          </Stack>

          {listQuery.isLoading ? (
            <Stack spacing={1.5}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={64} />
              ))}
            </Stack>
          ) : listQuery.isError ? (
            // O erro NÃO cai no ramo "lista vazia": permissão negada aparecia como
            // "Nenhum material publicado ainda." — indistinguível de não haver material.
            <Alert severity={listQuery.error.data?.code === "FORBIDDEN" ? "warning" : "error"}>
              {listQuery.error.data?.code === "FORBIDDEN" ? dictionary.forbidden : dictionary.error}
            </Alert>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {dictionary.empty}
            </Typography>
          ) : (
            <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {items.map((item) => {
                const kind = materialKind(item.contentType);
                const Icon = KIND_ICONS[kind];
                const inline = opensInBrowser(kind);
                const title = locale === "en" && item.titleEn ? item.titleEn : item.titlePt;
                return (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ alignItems: { sm: "center" }, py: 1.5 }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        display: "grid",
                        placeItems: "center",
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        flexShrink: 0,
                        color: "primary.main",
                        bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.1)",
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    <Stack spacing={0.25} sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" sx={{ wordBreak: "break-word" }}>
                          {title}
                        </Typography>
                        {isRecentMaterial(item.publishedAt, now) ? (
                          <Chip size="small" color="secondary" label={dictionary.newBadge} />
                        ) : null}
                      </Stack>
                      {item.publishedAt ? (
                        <Typography variant="caption" color="text.secondary">
                          {interpolate(dictionary.publishedOn, {
                            date: new Date(item.publishedAt).toLocaleDateString(dateLocale),
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={
                        kind === "video" ? (
                          <PlayCircleIcon fontSize="small" />
                        ) : inline ? (
                          <OpenInNewIcon fontSize="small" />
                        ) : (
                          <DownloadIcon fontSize="small" />
                        )
                      }
                      href={materialDownloadHref(item.id, inline ? "inline" : "attachment")}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}
                    >
                      {kind === "video" ? dictionary.watchLabel : inline ? dictionary.openLabel : dictionary.downloadLabel}
                    </Button>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
