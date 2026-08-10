"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import {
  EMPTY_PRODUCT_FORM,
  PACKAGING_TYPES,
  PRODUCT_BADGES,
  type ProductBadge,
  type ProductCategoryOption,
  type ProductFormState,
  type PackagingType,
} from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { ProductImagesManager } from "./product-images-manager";

const BADGE_LABEL_KEY: Record<ProductBadge, keyof PortalDictionary["products"]["badges"]> = {
  nacional: "nacional",
  universal: "universal",
  top: "top",
  tres_em_um: "tresEmUm",
  seguro: "seguro",
};

const PACKAGING_LABEL_KEY: Record<
  PackagingType,
  keyof PortalDictionary["products"]["form"]["packagingTypes"]
> = {
  peca: "peca",
  blister: "blister",
  caixa: "caixa",
  saco_plastico: "sacoPlastico",
};

type ProductFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** `null` = criação de um produto novo. */
  productId: string | null;
  dictionary: PortalDictionary["products"];
  commonDictionary: PortalDictionary["common"];
  /** `portal.errors.generic` — não há mensagem de erro dedicada para o form
   *  de produto no dicionário; reaproveitada aqui (ver relatório final). */
  errorLabel: string;
  categories: ProductCategoryOption[];
  user: PortalPermissionUser;
};

/**
 * Dialog única para criar/editar produto (escolha de UX documentada no
 * relatório final: Dialog em vez de página dedicada — mantém o usuário no
 * contexto da tabela/filtros). Fluxo de criação: `create` salva os campos
 * base e passa a exibir a seção de imagens (mutation de imagem exige
 * `productId`); a partir daí o dialog se comporta como edição.
 */
export function ProductFormDialog({
  open,
  onClose,
  productId,
  dictionary,
  commonDictionary,
  errorLabel,
  categories,
  user,
}: ProductFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Reset ao abrir: em vez de um `useEffect` sincronizando `open`/`productId`
  // (proibido por `react-hooks/set-state-in-effect` quando faz `setState`
  // síncrono), o dono do state (`products-page-client.tsx`) remonta este
  // componente com um `key` novo a cada abertura — `currentProductId` já
  // nasce correto a partir do `productId` inicial, sem efeito nenhum.
  const [currentProductId, setCurrentProductId] = useState<string | null>(productId);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);

  const detailQuery = useQuery(
    trpc.products.byId.queryOptions(
      { id: currentProductId ?? "" },
      { enabled: Boolean(currentProductId) && open }
    )
  );

  // Hidrata o form a partir de `detailQuery.data` no render (não em
  // `useEffect`) — mesmo padrão de `onboarding-wizard.tsx` ("adjusting state
  // when a prop changes"), guardado por referência (`hydratedFrom`).
  const [hydratedFrom, setHydratedFrom] = useState<typeof detailQuery.data>(undefined);
  if (detailQuery.data && detailQuery.data !== hydratedFrom) {
    const product = detailQuery.data;
    setHydratedFrom(product);
    setForm({
      sku: product.sku,
      erpCode: product.erpCode ?? "",
      namePt: product.namePt,
      nameEn: product.nameEn ?? "",
      descriptionPt: product.descriptionPt ?? "",
      descriptionEn: product.descriptionEn ?? "",
      ncm: product.ncm ?? "",
      barcodeEan13: product.barcodeEan13 ?? "",
      published: product.published,
      categoryIds: product.categories.map((category) => category.id),
      primaryCategoryId: product.categories.find((category) => category.isPrimary)?.id ?? "",
      badges: product.badges,
      packagings: product.packagings,
    });
  }

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: trpc.products.list.queryKey() });
  }

  const createMutation = useMutation(
    trpc.products.create.mutationOptions({
      onSuccess: (created) => {
        setCurrentProductId(created.id);
        invalidateList();
      },
    })
  );

  const updateMutation = useMutation(
    trpc.products.update.mutationOptions({
      onSuccess: () => {
        invalidateList();
        if (currentProductId) {
          queryClient.invalidateQueries({
            queryKey: trpc.products.byId.queryKey({ id: currentProductId }),
          });
        }
      },
    })
  );

  const isEditing = Boolean(currentProductId);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleBadge(badge: ProductBadge) {
    setForm((current) => ({
      ...current,
      badges: current.badges.includes(badge)
        ? current.badges.filter((item) => item !== badge)
        : [...current.badges, badge],
    }));
  }

  function addPackaging() {
    setForm((current) => ({
      ...current,
      packagings: [
        ...current.packagings,
        { packagingType: "peca", unitsPerPack: 1, isDefault: current.packagings.length === 0 },
      ],
    }));
  }

  function removePackaging(index: number) {
    setForm((current) => ({
      ...current,
      packagings: current.packagings.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updatePackaging(index: number, patch: Partial<ProductFormState["packagings"][number]>) {
    setForm((current) => ({
      ...current,
      packagings: current.packagings.map((packaging, itemIndex) => {
        if (itemIndex !== index) {
          return patch.isDefault ? { ...packaging, isDefault: false } : packaging;
        }
        return { ...packaging, ...patch };
      }),
    }));
  }

  async function handleSave() {
    const patch = {
      sku: form.sku,
      erpCode: form.erpCode || undefined,
      namePt: form.namePt,
      nameEn: form.nameEn || undefined,
      descriptionPt: form.descriptionPt || undefined,
      descriptionEn: form.descriptionEn || undefined,
      ncm: form.ncm || undefined,
      barcodeEan13: form.barcodeEan13 || undefined,
      published: form.published,
      categoryIds: form.categoryIds,
      primaryCategoryId: form.primaryCategoryId || undefined,
      badges: form.badges,
      packagings: form.packagings,
    };

    if (currentProductId) {
      await updateMutation.mutateAsync({ id: currentProductId, patch });
    } else {
      await createMutation.mutateAsync(patch);
    }
  }

  const selectedCategories = categories.filter((category) => form.categoryIds.includes(category.id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{isEditing ? dictionary.form.editTitle : dictionary.form.createTitle}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.sku}
              value={form.sku}
              onChange={(event) => updateField("sku", event.target.value)}
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.erpCode}
              value={form.erpCode}
              onChange={(event) => updateField("erpCode", event.target.value)}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.name}
              value={form.namePt}
              onChange={(event) => updateField("namePt", event.target.value)}
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.nameEn}
              value={form.nameEn}
              onChange={(event) => updateField("nameEn", event.target.value)}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.description}
              value={form.descriptionPt}
              onChange={(event) => updateField("descriptionPt", event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.descriptionEn}
              value={form.descriptionEn}
              onChange={(event) => updateField("descriptionEn", event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={dictionary.form.fields.ncm}
              value={form.ncm}
              onChange={(event) => updateField("ncm", event.target.value)}
              fullWidth
            />
            <TextField
              label={dictionary.form.fields.barcode}
              value={form.barcodeEan13}
              onChange={(event) => updateField("barcodeEan13", event.target.value)}
              fullWidth
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={form.published}
                onChange={(event) => updateField("published", event.target.checked)}
              />
            }
            label={dictionary.form.fields.published}
          />

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="subtitle1">{dictionary.form.fields.category}</Typography>
            <Autocomplete
              multiple
              options={categories}
              getOptionLabel={(option) => option.namePt}
              value={selectedCategories}
              onChange={(_event, value) => {
                const categoryIds = value.map((option) => option.id);
                setForm((current) => ({
                  ...current,
                  categoryIds,
                  primaryCategoryId: categoryIds.includes(current.primaryCategoryId)
                    ? current.primaryCategoryId
                    : (categoryIds[0] ?? ""),
                }));
              }}
              renderInput={(params) => <TextField {...params} label={dictionary.form.fields.category} />}
            />
            {form.categoryIds.length > 0 ? (
              <TextField
                select
                label={dictionary.form.fields.category}
                value={form.primaryCategoryId}
                onChange={(event) => updateField("primaryCategoryId", event.target.value)}
                helperText={dictionary.form.fields.category}
                sx={{ maxWidth: 320 }}
              >
                {categories
                  .filter((category) => form.categoryIds.includes(category.id))
                  .map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.namePt}
                    </MenuItem>
                  ))}
              </TextField>
            ) : null}
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="subtitle1">{dictionary.table.badges}</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {PRODUCT_BADGES.map((badge) => (
                <FormControlLabel
                  key={badge}
                  control={
                    <Checkbox
                      checked={form.badges.includes(badge)}
                      onChange={() => toggleBadge(badge)}
                    />
                  }
                  label={dictionary.badges[BADGE_LABEL_KEY[badge]]}
                />
              ))}
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle1">{dictionary.table.packaging}</Typography>
              {/* Sem rótulo textual dedicado a "adicionar embalagem" no
                  dicionário — ícone + `aria-label` reaproveitando
                  `table.packaging` ("Embalagem"), ver relatório final. */}
              <Tooltip title={dictionary.table.packaging}>
                <IconButton size="small" aria-label={dictionary.table.packaging} onClick={addPackaging}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            {form.packagings.map((packaging, index) => (
              <Stack key={packaging.id ?? index} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <TextField
                  select
                  size="small"
                  label={dictionary.form.fields.packagingType}
                  value={packaging.packagingType}
                  onChange={(event) =>
                    updatePackaging(index, { packagingType: event.target.value as PackagingType })
                  }
                  sx={{ minWidth: 160 }}
                >
                  {PACKAGING_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {dictionary.form.packagingTypes[PACKAGING_LABEL_KEY[type]]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label={dictionary.form.fields.unitsPerPack}
                  value={packaging.unitsPerPack}
                  onChange={(event) =>
                    updatePackaging(index, { unitsPerPack: Number(event.target.value) })
                  }
                  sx={{ maxWidth: 140 }}
                />
                {/* Sem rótulo dedicado a "embalagem padrão" no dicionário —
                    reaproveita `status.active` ("Ativo") como o mais próximo
                    disponível, ver relatório final. */}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={packaging.isDefault}
                      onChange={() => updatePackaging(index, { isDefault: true })}
                    />
                  }
                  label={dictionary.status.active}
                />
                <IconButton
                  size="small"
                  aria-label={dictionary.form.actions.delete}
                  onClick={() => removePackaging(index)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>

          {currentProductId ? (
            <>
              <Divider />
              <ProductImagesManager
                productId={currentProductId}
                images={detailQuery.data?.images ?? []}
                dictionary={dictionary.form.images}
                saveLabel={commonDictionary.save}
                removeLabel={dictionary.form.images.remove}
                canUpload={can(user, "product_images", "create")}
                canDelete={can(user, "product_images", "delete")}
                onImagesChanged={() =>
                  queryClient.invalidateQueries({
                    queryKey: trpc.products.byId.queryKey({ id: currentProductId }),
                  })
                }
              />
            </>
          ) : null}

          {createMutation.isError || updateMutation.isError ? (
            <Alert severity="error">{errorLabel}</Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{dictionary.form.actions.cancel}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {dictionary.form.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
