"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageIcon from "@mui/icons-material/Image";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import { pickItemText, type HomeCategoryItemDocument } from "@/modules/home/lib/home-content";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { CtaFields, FieldGroup, HrefField, LocalizedField } from "./fields";
import {
  HOME_MAX_CATEGORY_ITEMS,
  emptyCategoryItem,
  moveItem,
  prefillCategoryItems,
  resolveImagePreview,
  type FieldErrors,
} from "./home-editor-model";
import { ImageField } from "./image-field";
import { ItemActions } from "./item-actions";
import { pairOf, type SectionEditorProps } from "./section-editor-props";

type CategoryItemCardProps = {
  index: number;
  count: number;
  item: HomeCategoryItemDocument;
  onChange: (next: HomeCategoryItemDocument) => void;
  expanded: boolean;
  onToggle: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  locale: Locale;
  errors: FieldErrors;
  disabled: boolean;
  readOnly: boolean;
  dictionary: PortalHomeContentDictionary;
  imageUrls: Readonly<Record<string, string>>;
  onImageUrl: (key: string, url: string) => void;
};

/**
 * Card recolhível: o cabeçalho (miniatura, título, link e ações) fica sempre à
 * vista e os campos aparecem ao abrir — 12 cards de formulário completo seriam
 * uma parede de campos. Os botões de ação ficam FORA do botão de expandir
 * (botão dentro de botão não é HTML válido nem acessível).
 */
function CategoryItemCard({
  index,
  count,
  item,
  onChange,
  expanded,
  onToggle,
  onMove,
  onRemove,
  locale,
  errors,
  disabled,
  readOnly,
  dictionary,
  imageUrls,
  onImageUrl,
}: CategoryItemCardProps) {
  const copy = dictionary.categories.items;
  const fields = dictionary.fields;
  const name = pickItemText(item.label, locale) || copy.newItem;
  const title = interpolate(copy.itemTitle, { position: String(index + 1), label: name });
  const thumb = resolveImagePreview({ imageKey: item.imageKey, defaultPath: item.imagePath, imageUrls });
  const bodyId = `category-item-${index}-body`;

  return (
    <Paper variant="outlined">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5 }}>
        <Avatar
          variant="rounded"
          src={thumb.url ?? undefined}
          alt=""
          sx={{ width: 48, height: 48, bgcolor: "action.hover", color: "text.secondary" }}
        >
          <ImageIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" component="h4" noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {item.href.trim() || "—"}
          </Typography>
        </Box>
        <ItemActions
          index={index}
          count={count}
          disabled={disabled}
          removeDisabled={count <= 1}
          onMove={onMove}
          onRemove={onRemove}
          moveUpLabel={interpolate(copy.moveUpAria, { name })}
          moveDownLabel={interpolate(copy.moveDownAria, { name })}
          removeLabel={interpolate(copy.removeAria, { name })}
        />
        <IconButton
          size="small"
          aria-label={interpolate(copy.expandAria, { name })}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
          />
        </IconButton>
      </Box>

      {/* Sem `unmountOnExit`: o `id` precisa existir para o `aria-controls` do botão, e
          o MUI já esconde o conteúdo recolhido (`visibility: hidden`) do foco e dos leitores de tela. */}
      <Collapse in={expanded} id={bodyId}>
        <Divider />
        <Stack spacing={2.5} sx={{ p: 2 }}>
          <LocalizedField
            label={fields.itemLabel}
            value={item.label}
            onChange={(label) => onChange({ ...item, label })}
            maxLength={60}
            errors={errors}
            errorPath={`items.${index}.label`}
            disabled={disabled}
            dictionary={fields}
          />
          <Box>
            <HrefField
              label={fields.itemHref}
              value={item.href}
              onChange={(href) => onChange({ ...item, href })}
              error={errors[`items.${index}.href`]}
              disabled={disabled}
              dictionary={fields}
            />
            <FormHelperText sx={{ mx: 1.75 }}>{fields.hrefHelper}</FormHelperText>
          </Box>
          <ImageField
            dictionary={dictionary.image}
            imageKey={item.imageKey}
            defaultPath={item.imagePath}
            imageUrls={imageUrls}
            onChange={(imageKey) => onChange({ ...item, imageKey })}
            onImageUrl={onImageUrl}
            disabled={disabled}
            readOnly={readOnly}
            error={errors[`items.${index}.image`]}
          />
          <LocalizedField
            label={fields.imageAlt}
            value={item.alt}
            onChange={(alt) => onChange({ ...item, alt })}
            maxLength={200}
            errors={errors}
            errorPath={`items.${index}.alt`}
            disabled={disabled}
            dictionary={fields}
            helper={copy.altHelper}
          />
        </Stack>
      </Collapse>
    </Paper>
  );
}

/** Categorias: textos, cards (lista com imagem própria) e botão. */
export function CategoriesEditor({
  form,
  onChange,
  locale,
  defaults,
  errors,
  disabled,
  readOnly,
  dictionary,
  imageUrls,
  onImageUrl,
}: SectionEditorProps<"categories">) {
  const fields = dictionary.fields;
  const copy = dictionary.categories.items;
  const update = (patch: Partial<typeof form>) => onChange({ ...form, ...patch });
  const items = form.items;

  // Qual card está aberto vive AQUI (não em cada card) para acompanhar o item
  // quando ele muda de posição. `version` entra na key dos cards: depois de
  // mover/remover, o estado interno do uploader de cada card (arquivo escolhido,
  // pré-visualização local) pertenceria a outra posição — remontar é o jeito
  // barato de garantir que cada card mostre o SEU item.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  function hasItemErrors(index: number): boolean {
    const prefix = `items.${index}.`;
    return Object.keys(errors).some((key) => key.startsWith(prefix));
  }

  function moveCard(index: number, delta: -1 | 1) {
    if (!items) return;
    const target = index + delta;
    update({ items: moveItem(items, index, target) });
    setOpenIndex(openIndex === index ? target : openIndex === target ? index : openIndex);
    setVersion((current) => current + 1);
  }

  function removeCard(index: number) {
    if (!items) return;
    update({ items: items.filter((_, i) => i !== index) });
    setOpenIndex(null);
    setVersion((current) => current + 1);
  }

  return (
    <Stack spacing={4}>
      <FieldGroup title={fields.groupTexts}>
        <LocalizedField
          label={fields.eyebrow}
          value={form.eyebrow}
          onChange={(eyebrow) => update({ eyebrow })}
          defaults={pairOf((l) => defaults[l].categories.eyebrow)}
          maxLength={80}
          errors={errors}
          errorPath="eyebrow"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.headline}
          value={form.headline}
          onChange={(headline) => update({ headline })}
          defaults={pairOf((l) => defaults[l].categories.headline)}
          maxLength={120}
          errors={errors}
          errorPath="headline"
          disabled={disabled}
          dictionary={fields}
        />
        <LocalizedField
          label={fields.description}
          value={form.description}
          onChange={(description) => update({ description })}
          defaults={pairOf((l) => defaults[l].categories.description)}
          maxLength={400}
          errors={errors}
          errorPath="description"
          disabled={disabled}
          dictionary={fields}
          multiline
          minRows={3}
        />
      </FieldGroup>

      <FieldGroup title={copy.title} description={copy.description}>
        {items === null ? (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
            <Typography variant="body2" color="text.secondary">
              {copy.usingDefault}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }} useFlexGap>
              {defaults[locale].categories.items.map((item) => (
                <Stack key={item.href} spacing={0.5} sx={{ alignItems: "center", width: 64 }}>
                  <Avatar variant="rounded" src={item.image} alt="" sx={{ width: 48, height: 48 }} />
                  <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}>
                    {item.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            {!disabled ? (
              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => {
                  update({ items: prefillCategoryItems(defaults) });
                  setOpenIndex(null);
                  setVersion((current) => current + 1);
                }}
              >
                {copy.customize}
              </Button>
            ) : null}
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {items.map((item, index) => (
              <CategoryItemCard
                key={`${version}:${index}`}
                index={index}
                count={items.length}
                item={item}
                onChange={(next) => update({ items: items.map((current, i) => (i === index ? next : current)) })}
                expanded={openIndex === index || hasItemErrors(index)}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                onMove={(delta) => moveCard(index, delta)}
                onRemove={() => removeCard(index)}
                locale={locale}
                errors={errors}
                disabled={disabled}
                readOnly={readOnly}
                dictionary={dictionary}
                imageUrls={imageUrls}
                onImageUrl={onImageUrl}
              />
            ))}

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
              <Button
                startIcon={<AddIcon />}
                disabled={disabled || items.length >= HOME_MAX_CATEGORY_ITEMS}
                onClick={() => {
                  update({ items: [...items, emptyCategoryItem()] });
                  setOpenIndex(items.length);
                }}
              >
                {copy.add}
              </Button>
              <Button
                color="inherit"
                startIcon={<RestartAltIcon />}
                disabled={disabled}
                onClick={() => {
                  update({ items: null });
                  setOpenIndex(null);
                  setVersion((current) => current + 1);
                }}
              >
                {copy.useDefaultList}
              </Button>
            </Stack>
            {items.length >= HOME_MAX_CATEGORY_ITEMS ? (
              <FormHelperText>{interpolate(copy.maxReached, { max: HOME_MAX_CATEGORY_ITEMS })}</FormHelperText>
            ) : null}
            {items.length === 1 ? <FormHelperText>{copy.minOne}</FormHelperText> : null}
          </Stack>
        )}
      </FieldGroup>

      <FieldGroup title={fields.groupButton}>
        <CtaFields
          ctaLabel={form.ctaLabel}
          ctaHref={form.ctaHref}
          onChange={update}
          defaults={{
            label: pairOf((l) => defaults[l].categories.ctaLabel),
            href: defaults.pt.categories.ctaHref,
          }}
          errors={errors}
          disabled={disabled}
          dictionary={fields}
        />
      </FieldGroup>
    </Stack>
  );
}
