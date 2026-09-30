"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import HandshakeIcon from "@mui/icons-material/Handshake";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SchoolIcon from "@mui/icons-material/School";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import TableChartIcon from "@mui/icons-material/TableChart";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import {
  MATERIAL_CATEGORY_ORDER,
  formatFileSize,
  groupMaterialsByCategory,
  isRecentMaterial,
  matchesMaterialSearch,
  materialDownloadHref,
  materialKind,
  normalizeMaterialCategory,
  opensInBrowser,
  type MaterialCategory,
  type MaterialKind,
} from "@/modules/portal/lib/materials-library";
import type { PortalMaterialsDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";

type MaterialsLibraryProps = {
  locale: Locale;
  dictionary: PortalMaterialsDictionary;
  /** Admin pré-visualizando a biblioteca: aviso + link de volta para a gestão. */
  preview?: { backHref: string };
};

type LibraryItem = {
  id: string;
  titlePt: string;
  titleEn: string | null;
  descriptionPt: string | null;
  descriptionEn: string | null;
  category: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  publishedAt: string | Date | null;
};

const CATEGORY_ICONS: Record<MaterialCategory, typeof HandshakeIcon> = {
  commercial_policy: HandshakeIcon,
  logistics: LocalShippingIcon,
  contacts: ContactPhoneIcon,
  training: SchoolIcon,
  other: FolderOpenIcon,
};

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

/** Quantos "publicados recentemente" aparecem no topo (sem filtro ativo). */
const RECENT_LIMIT = 3;
/**
 * A faixa de recentes só aparece com a biblioteca MAIOR que ela: com poucos
 * materiais ela repetiria os mesmos cards logo abaixo, nas seções.
 */
const RECENT_MIN_LIBRARY_SIZE = RECENT_LIMIT + 2;

/**
 * Biblioteca de materiais do REPRESENTANTE (revisão 2026-09-30): os materiais
 * publicados organizados por SETOR (categoria), com busca, filtro por assunto
 * e os mais recentes em destaque — substitui a lista corrida que ficava no
 * fim da página de boas-vindas, onde o material "sumia" abaixo da dobra.
 *
 * Os links passam pela rota autenticada de download
 * (`materialDownloadHref`), que gera a URL do R2 no clique — nunca expiram na
 * tela. Estados de erro distinguem "sem permissão" de falha de rede, e nenhum
 * dos dois se parece com "lista vazia".
 */
export function MaterialsLibrary({ locale, dictionary, preview }: MaterialsLibraryProps) {
  const trpc = useTRPC();
  const library = dictionary.library;
  const listQuery = useQuery(trpc.materials.listPublished.queryOptions());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MaterialCategory | "all">("all");
  const sectorsLabelId = useId();

  const items: LibraryItem[] = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const now = useMemo(() => new Date(), []);

  const countsByCategory = useMemo(() => {
    const counts = new Map<MaterialCategory, number>();
    for (const item of items) {
      const key = normalizeMaterialCategory(item.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "all" || normalizeMaterialCategory(item.category) === category) &&
          matchesMaterialSearch(item, search)
      ),
    [items, category, search]
  );
  const groups = useMemo(() => groupMaterialsByCategory(filtered), [filtered]);
  const filtering = category !== "all" || search.trim() !== "";
  const recent =
    filtering || items.length < RECENT_MIN_LIBRARY_SIZE
      ? []
      : items.filter((item) => isRecentMaterial(item.publishedAt, now)).slice(0, RECENT_LIMIT);

  const sectorTitle = (key: MaterialCategory) => (key === "other" ? library.otherTitle : dictionary.categories[key]);
  const countLabel = (count: number) => interpolate(count === 1 ? library.countOne : library.countOther, { count });

  let body: ReactNode;
  if (listQuery.isLoading) {
    body = (
      <Box sx={gridSx}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={188} />
        ))}
      </Box>
    );
  } else if (listQuery.isError) {
    const forbidden = listQuery.error.data?.code === "FORBIDDEN";
    body = (
      <Alert
        severity={forbidden ? "warning" : "error"}
        action={
          forbidden ? undefined : (
            <Button color="inherit" size="small" onClick={() => void listQuery.refetch()}>
              {library.retry}
            </Button>
          )
        }
      >
        {forbidden ? library.forbidden : library.error}
      </Alert>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState icon={<FolderOpenIcon sx={{ fontSize: 40 }} />} title={library.empty.title} description={library.empty.description} />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={<SearchOffIcon sx={{ fontSize: 40 }} />}
        title={library.emptyFilter.title}
        description={library.emptyFilter.description}
        action={
          <Button
            variant="outlined"
            onClick={() => {
              setSearch("");
              setCategory("all");
            }}
          >
            {library.emptyFilter.clear}
          </Button>
        }
      />
    );
  } else {
    body = (
      <Stack spacing={5}>
        {recent.length > 0 ? (
          <Box component="section" aria-labelledby="materials-recent-title">
            <Typography id="materials-recent-title" variant="h6" component="h2" sx={{ mb: 2 }}>
              {library.recentTitle}
            </Typography>
            <Box sx={gridSx}>
              {recent.map((item) => (
                <MaterialCard key={item.id} item={item} locale={locale} dictionary={dictionary} now={now} highlight />
              ))}
            </Box>
          </Box>
        ) : null}

        {groups.map((group) => {
          const Icon = CATEGORY_ICONS[group.category];
          const titleId = `materials-sector-${group.category}`;
          return (
            <Box key={group.category} component="section" aria-labelledby={titleId}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5 }}>
                <Box
                  aria-hidden
                  sx={{
                    display: "grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    color: "primary.main",
                    bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12)",
                    flexShrink: 0,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography id={titleId} variant="h6" component="h2">
                  {sectorTitle(group.category)}
                </Typography>
                <Chip size="small" variant="outlined" label={countLabel(group.items.length)} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: { sm: 6.5 } }}>
                {library.sectors[group.category]}
              </Typography>
              <Box sx={gridSx}>
                {group.items.map((item) => (
                  <MaterialCard key={item.id} item={item} locale={locale} dictionary={dictionary} now={now} />
                ))}
              </Box>
            </Box>
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {preview ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" href={preview.backHref}>
              {library.backToManage}
            </Button>
          }
        >
          {library.previewNotice}
        </Alert>
      ) : null}

      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {library.title}
        </Typography>
        <Typography color="text.secondary">{library.subtitle}</Typography>
      </Box>

      {items.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={2}>
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={library.searchPlaceholder}
              slotProps={{
                htmlInput: { "aria-label": library.searchLabel, maxLength: 120, enterKeyHint: "search" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: "wrap" }} role="group" aria-labelledby={sectorsLabelId}>
              <Typography id={sectorsLabelId} variant="caption" color="text.secondary" sx={{ width: "100%" }}>
                {library.sectorsLabel}
              </Typography>
              <Chip
                label={`${library.all} (${items.length})`}
                color={category === "all" ? "primary" : "default"}
                variant={category === "all" ? "filled" : "outlined"}
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
              />
              {MATERIAL_CATEGORY_ORDER.filter((key) => countsByCategory.has(key)).map((key) => (
                <Chip
                  key={key}
                  label={`${sectorTitle(key)} (${countsByCategory.get(key)})`}
                  color={category === key ? "primary" : "default"}
                  variant={category === key ? "filled" : "outlined"}
                  onClick={() => setCategory(category === key ? "all" : key)}
                  aria-pressed={category === key}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      {body}
    </Stack>
  );
}

const gridSx = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
} as const;

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, textAlign: "center" }}>
      <Box sx={{ color: "text.secondary", mb: 1.5 }} aria-hidden>
        {icon}
      </Box>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 520, mx: "auto" }}>
        {description}
      </Typography>
      {action ? <Box sx={{ mt: 3 }}>{action}</Box> : null}
    </Paper>
  );
}

function MaterialCard({
  item,
  locale,
  dictionary,
  now,
  highlight = false,
}: {
  item: LibraryItem;
  locale: Locale;
  dictionary: PortalMaterialsDictionary;
  now: Date;
  highlight?: boolean;
}) {
  const library = dictionary.library;
  const kind = materialKind(item.contentType);
  const KindIcon = KIND_ICONS[kind];
  const title = locale === "en" && item.titleEn ? item.titleEn : item.titlePt;
  const description = locale === "en" && item.descriptionEn ? item.descriptionEn : item.descriptionPt;
  const inline = opensInBrowser(kind);
  const primaryLabel = kind === "video" ? library.watch : inline ? library.open : library.download;
  const PrimaryIcon = kind === "video" ? PlayCircleIcon : inline ? OpenInNewIcon : DownloadIcon;
  const meta = [
    library.fileTypes[kind],
    formatFileSize(item.sizeBytes, locale === "pt" ? "pt-BR" : "en"),
    item.publishedAt
      ? interpolate(library.publishedOn, { date: new Date(item.publishedAt).toLocaleDateString(locale === "pt" ? "pt-BR" : "en") })
      : null,
  ].filter(Boolean);

  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderColor: highlight ? "primary.main" : undefined,
        transition: "border-color 150ms ease",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.25, flexGrow: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box
            aria-hidden
            sx={{
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: 2,
              flexShrink: 0,
              color: "primary.main",
              bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.1)",
            }}
          >
            <KindIcon />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word" }}>
                {title}
              </Typography>
              {isRecentMaterial(item.publishedAt, now) ? (
                <Chip size="small" color="secondary" label={library.newBadge} />
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {meta.join(" · ")}
            </Typography>
          </Box>
        </Stack>

        {description ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              whiteSpace: "pre-line",
            }}
          >
            {description}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} sx={{ mt: "auto", pt: 1, alignItems: "center" }}>
          <Button
            variant={highlight ? "contained" : "outlined"}
            size="small"
            startIcon={<PrimaryIcon fontSize="small" />}
            href={materialDownloadHref(item.id, inline ? "inline" : "attachment")}
            target="_blank"
            rel="noopener noreferrer"
          >
            {primaryLabel}
          </Button>
          {inline ? (
            <Tooltip title={library.download}>
              <IconButton
                size="small"
                href={materialDownloadHref(item.id, "attachment")}
                aria-label={interpolate(library.downloadAria, { title })}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
