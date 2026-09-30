"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArticleIcon from "@mui/icons-material/Article";
import CategoryIcon from "@mui/icons-material/Category";
import CampaignIcon from "@mui/icons-material/Campaign";
import FactoryIcon from "@mui/icons-material/Factory";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import SaveIcon from "@mui/icons-material/Save";
import StarIcon from "@mui/icons-material/Star";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import type { HomeSectionId } from "@/modules/home/lib/home-content";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import type { LayoutItem } from "./home-editor-model";

const SECTION_ICONS: Record<HomeSectionId, ComponentType<{ fontSize?: "small" }>> = {
  facade: FactoryIcon,
  about: ArticleIcon,
  categories: CategoryIcon,
  featured: StarIcon,
  portalCta: CampaignIcon,
};

type SectionNavigatorProps = {
  dictionary: PortalHomeContentDictionary;
  /** Rota do editor de slides (`/{locale}/portal/hero`). */
  heroHref: string;
  /** `hero_slides:read` — sem ele o cartão do hero é só informativo. */
  canOpenHero: boolean;
  /** Ordem e visibilidade EXIBIDAS (o rascunho, se houver). */
  layout: readonly LayoutItem[];
  layoutDirty: boolean;
  selected: HomeSectionId;
  /** Seções com conteúdo salvo (= personalizadas). */
  savedSections: Readonly<Record<HomeSectionId, boolean>>;
  /** Seções com rascunho ainda não salvo. */
  dirtySections: Readonly<Record<HomeSectionId, boolean>>;
  canEdit: boolean;
  savingLayout: boolean;
  onSelect: (id: HomeSectionId) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onToggle: (id: HomeSectionId, enabled: boolean) => void;
  onSaveLayout: () => void;
  onDiscardLayout: () => void;
};

/**
 * Lista das seções da página na ORDEM em que aparecem no site: o hero fixo no
 * topo (cartão-atalho para o editor de slides) e as demais com interruptor de
 * visibilidade e setas de ordem. Escolher uma seção abre o editor dela ao lado.
 *
 * A ordem/visibilidade tem rascunho próprio e um botão de salvar próprio
 * (documento `layout`): mexer nela não toca no conteúdo das seções.
 */
export function SectionNavigator({
  dictionary,
  heroHref,
  canOpenHero,
  layout,
  layoutDirty,
  selected,
  savedSections,
  dirtySections,
  canEdit,
  savingLayout,
  onSelect,
  onMove,
  onToggle,
  onSaveLayout,
  onDiscardLayout,
}: SectionNavigatorProps) {
  const copy = dictionary.navigator;

  const heroContent = (
    <>
      <Box sx={{ color: "text.secondary", pt: 0.25, display: "flex" }}>
        <OndemandVideoIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2" component="span" sx={{ display: "block" }}>
          {copy.heroName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {canOpenHero ? copy.heroDescription : copy.heroLocked}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, alignItems: "center", flexWrap: "wrap" }} useFlexGap>
          <Chip size="small" variant="outlined" label={copy.pinned} />
          {canOpenHero ? (
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {copy.heroAction}
              <ArrowForwardIcon sx={{ fontSize: 14 }} />
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </>
  );

  return (
    <Paper
      variant="outlined"
      component="nav"
      aria-labelledby="home-content-navigator-title"
      sx={{
        p: 2,
        position: { lg: "sticky" },
        top: { lg: 88 },
      }}
    >
      <Typography id="home-content-navigator-title" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
        {copy.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {copy.description}
      </Typography>

      <Stack component="ol" spacing={1.25} sx={{ listStyle: "none", m: 0, p: 0 }}>
        <Paper component="li" variant="outlined" sx={{ bgcolor: "action.hover" }}>
          {canOpenHero ? (
            <ListItemButton
              component={Link}
              href={heroHref}
              sx={{ gap: 1.5, alignItems: "flex-start", borderRadius: "inherit" }}
            >
              {heroContent}
            </ListItemButton>
          ) : (
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", px: 2, py: 1 }}>{heroContent}</Box>
          )}
        </Paper>

        {layout.map((item, index) => {
          const Icon = SECTION_ICONS[item.id];
          const section = dictionary.sections[item.id];
          const isSelected = item.id === selected;
          const nameId = `home-nav-${item.id}-name`;
          return (
            <Paper
              key={item.id}
              component="li"
              variant="outlined"
              sx={{
                borderColor: isSelected ? "primary.main" : "divider",
                opacity: item.enabled ? 1 : 0.8,
              }}
            >
              <ListItemButton
                selected={isSelected}
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                sx={{ gap: 1.5, alignItems: "flex-start", borderRadius: "inherit" }}
              >
                <Box sx={{ color: isSelected ? "primary.main" : "text.secondary", pt: 0.25, display: "flex" }}>
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography id={nameId} variant="subtitle2" component="span" sx={{ display: "block" }}>
                    {section.name}
                  </Typography>
                  {/* No celular a lista já é longa: a descrição só aparece a partir de `sm`. */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: "none", sm: "block" } }}
                  >
                    {section.description}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: "wrap" }} useFlexGap>
                    {dirtySections[item.id] ? (
                      <Chip size="small" color="warning" label={copy.unsaved} />
                    ) : savedSections[item.id] ? (
                      <Chip size="small" color="primary" variant="outlined" label={copy.customized} />
                    ) : (
                      <Chip size="small" variant="outlined" label={copy.usingDefault} />
                    )}
                    {!item.enabled ? (
                      <Chip size="small" variant="outlined" icon={<VisibilityOffIcon />} label={copy.hidden} />
                    ) : null}
                  </Stack>
                </Box>
              </ListItemButton>
              <Divider />
              <Stack
                direction="row"
                sx={{ px: 1.5, py: 0.25, alignItems: "center", justifyContent: "space-between" }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={item.enabled}
                      disabled={!canEdit}
                      onChange={(event) => onToggle(item.id, event.target.checked)}
                      // O nome acessível é o rótulo visível ("Exibir no site" — WCAG 2.5.3); a seção
                      // a que ele se refere vem como descrição.
                      slotProps={{ input: { "aria-describedby": nameId } }}
                    />
                  }
                  label={copy.showOnSite}
                  slotProps={{ typography: { variant: "body2" } }}
                />
                {canEdit ? (
                  <Stack direction="row">
                    <IconButton
                      size="small"
                      aria-label={interpolate(copy.moveUpAria, { section: section.name })}
                      disabled={index === 0 || savingLayout}
                      onClick={() => onMove(index, -1)}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={interpolate(copy.moveDownAria, { section: section.name })}
                      disabled={index === layout.length - 1 || savingLayout}
                      onClick={() => onMove(index, 1)}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {canEdit ? (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {layoutDirty ? (
            <Alert severity="warning" variant="outlined">
              {copy.layoutUnsaved}
            </Alert>
          ) : null}
          <Button
            variant={layoutDirty ? "contained" : "outlined"}
            startIcon={savingLayout ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            disabled={!layoutDirty || savingLayout}
            onClick={onSaveLayout}
          >
            {savingLayout ? copy.savingLayout : copy.saveLayout}
          </Button>
          {layoutDirty ? (
            <Button color="inherit" disabled={savingLayout} onClick={onDiscardLayout}>
              {copy.discardLayout}
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Paper>
  );
}
