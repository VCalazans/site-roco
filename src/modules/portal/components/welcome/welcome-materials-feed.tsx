"use client";

import DownloadIcon from "@mui/icons-material/Download";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type WelcomeMaterialsFeedProps = {
  locale: Locale;
  dictionary: PortalDictionary["welcome"]["materialsFeed"];
};

function contentTypeIcon(contentType: string) {
  if (contentType === "application/pdf") return PictureAsPdfIcon;
  if (contentType.startsWith("video/")) return OndemandVideoIcon;
  if (contentType.startsWith("image/")) return ImageIcon;
  return InsertDriveFileIcon;
}

/**
 * Feed de materiais publicados, em linha do tempo (mais recente primeiro —
 * já vem ordenado do servidor por `publishedAt DESC`, ver
 * `trpc.materials.listPublished`). Substitui os 4 cards estáticos "Em
 * breve" que existiam para Contatos/Política Comercial/Logística/Biblioteca
 * de vídeos (ver decisionLog 2026-08-24, "Materiais dinâmicos para
 * representantes"). Componente client (não Server Component) porque
 * consome tRPC via React Query — por isso recebe `locale` como prop (não
 * tem acesso direto a `params`) para decidir `titlePt`/`titleEn` etc.
 *
 * Limitação conhecida e ACEITA (mesmo padrão já usado para os documentos de
 * onboarding de representante): `downloadUrl` é uma URL presignada de curta
 * duração — se o usuário demorar muito antes de clicar, pode expirar. Não
 * há aqui uma segunda chamada para "renovar" o link.
 */
export function WelcomeMaterialsFeed({ locale, dictionary }: WelcomeMaterialsFeedProps) {
  const trpc = useTRPC();
  const listQuery = useQuery(trpc.materials.listPublished.queryOptions());
  const items = listQuery.data ?? [];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h6" component="h2">
              {dictionary.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dictionary.subtitle}
            </Typography>
          </Stack>

          {listQuery.isLoading ? (
            <Stack spacing={1.5}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={64} />
              ))}
            </Stack>
          ) : items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {dictionary.empty}
            </Typography>
          ) : (
            <Stack
              spacing={2}
              divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}
            >
              {items.map((item) => {
                const Icon = contentTypeIcon(item.contentType);
                const isVideo = item.contentType.startsWith("video/");
                const title = locale === "en" && item.titleEn ? item.titleEn : item.titlePt;
                const description =
                  locale === "en" && item.descriptionEn ? item.descriptionEn : item.descriptionPt;
                return (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    <Box sx={{ color: "primary.main" }}>
                      <Icon />
                    </Box>
                    <Stack spacing={0.25} sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2">{title}</Typography>
                      {description ? (
                        <Typography variant="body2" color="text.secondary">
                          {description}
                        </Typography>
                      ) : null}
                      {item.publishedAt ? (
                        <Typography variant="caption" color="text.secondary">
                          {interpolate(dictionary.publishedOn, {
                            date: new Date(item.publishedAt).toLocaleDateString(locale),
                          })}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={
                        isVideo ? <PlayCircleIcon fontSize="small" /> : <DownloadIcon fontSize="small" />
                      }
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={isVideo ? undefined : item.filename}
                      sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                    >
                      {isVideo ? dictionary.watchLabel : dictionary.downloadLabel}
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
