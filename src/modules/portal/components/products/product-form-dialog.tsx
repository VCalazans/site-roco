"use client";

import { useId, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import {
  PRODUCT_FIELD_LIMITS,
  buildProductPayload,
  formFromDetail,
  hasProductFormErrors,
  validateProductForm,
} from "@/modules/portal/lib/product-form";
import { productPublicPath } from "@/modules/portal/lib/product-links";
import {
  EMPTY_PRODUCT_FORM,
  PACKAGING_TYPES,
  PRODUCT_BADGES,
  type PackagingType,
  type ProductBadge,
  type ProductCategoryOption,
  type ProductDetail,
  type ProductFormState,
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
  /** `portal.errors.generic` — mensagem de fallback para falhas sem código conhecido. */
  errorLabel: string;
  categories: ProductCategoryOption[];
  user: PortalPermissionUser;
  /** Locale da rota: monta o link "Ver no site". */
  locale: Locale;
};

/** Seção do formulário: título, dica e conteúdo, com landmark próprio. */
function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {hint}
      </Typography>
      {children}
    </Box>
  );
}

/** Switch com texto de apoio ligado ao controle (`aria-describedby`). */
function SwitchField({
  checked,
  onChange,
  label,
  helper,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  helper: string;
  disabled?: boolean;
}) {
  const helperId = useId();
  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{ input: { "aria-describedby": helperId } }}
          />
        }
        label={label}
      />
      <FormHelperText id={helperId} sx={{ mt: -0.5, ml: 6.5 }}>
        {helper}
      </FormHelperText>
    </Box>
  );
}

/** Mensagem de erro do salvamento conforme o código tRPC (sem vazar texto do servidor). */
function saveErrorMessage(
  error: unknown,
  errors: PortalDictionary["products"]["form"]["errors"],
  fallback: string
): string {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  if (code === "CONFLICT") return errors.duplicate;
  if (code === "FORBIDDEN") return errors.forbidden;
  return fallback;
}

/**
 * Diálogo único para criar/editar produto, organizado em seções (Identificação,
 * Nome e descrição, Categorias e selos, Vitrine do site, Embalagens, Imagens).
 * Mantém o usuário no contexto da tabela/filtros.
 *
 * Fluxo de criação: `create` salva os campos base e passa a exibir a seção de
 * imagens (a mutation de imagem exige `productId`); a partir daí o diálogo se
 * comporta como edição. O formulário é hidratado UMA vez (a partir do detalhe
 * ou do retorno da mutation) — refetches em segundo plano nunca sobrescrevem o
 * que a pessoa está digitando.
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
  locale,
}: ProductFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // A permissão de publicar é distinta da de editar (`products:publish`).
  const canPublish = can(user, "products", "publish");

  // Reset ao abrir: em vez de um `useEffect` sincronizando `open`/`productId`
  // (proibido por `react-hooks/set-state-in-effect` quando faz `setState`
  // síncrono), o dono do state (`products-page-client.tsx`) remonta este
  // componente com um `key` novo a cada abertura — `currentProductId` já
  // nasce correto a partir do `productId` inicial, sem efeito nenhum.
  const [currentProductId, setCurrentProductId] = useState<string | null>(productId);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  // Foto do formulário no último salvamento/carga: diferença = alterações não salvas.
  const [baseline, setBaseline] = useState(() => JSON.stringify(EMPTY_PRODUCT_FORM));
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState<{ slug: string; published: boolean } | null>(null);
  const [notice, setNotice] = useState<"saved" | "created" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState({ sku: false, namePt: false });

  const skuRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery(
    trpc.products.byId.queryOptions(
      { id: currentProductId ?? "" },
      { enabled: Boolean(currentProductId) && open }
    )
  );

  function applyDetail(product: ProductDetail) {
    const next = formFromDetail(product);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setSaved({ slug: product.slug, published: product.published });
    setHydrated(true);
  }

  // Hidrata o form a partir de `detailQuery.data` no render (não em
  // `useEffect`) — mesmo padrão de `onboarding-wizard.tsx` ("adjusting state
  // when a prop changes"), agora guardado por um booleano (uma vez só).
  if (detailQuery.data && !hydrated) {
    applyDetail(detailQuery.data);
  }

  function invalidateCatalog(id: string) {
    queryClient.invalidateQueries(trpc.products.list.pathFilter());
    queryClient.invalidateQueries(trpc.products.stats.pathFilter());
    queryClient.invalidateQueries({ queryKey: trpc.products.byId.queryKey({ id }) });
  }

  const createMutation = useMutation(trpc.products.create.mutationOptions());
  const updateMutation = useMutation(trpc.products.update.mutationOptions());

  const isEditing = Boolean(currentProductId);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  // Editando, mas o detalhe (`byId`) ainda não chegou para hidratar o formulário.
  const detailLoading = isEditing && !hydrated && !detailQuery.isError;
  const detailUnavailable = isEditing && !hydrated;
  const dirty = JSON.stringify(form) !== baseline;
  const errors = validateProductForm(form);
  const showSkuError = (attempted || touched.sku) && errors.sku;
  const showNameError = (attempted || touched.namePt) && errors.namePt;
  const requiredText = dictionary.form.validation.required;

  /** Toda edição limpa o aviso de "salvo" — ele deixa de descrever a tela. */
  function patchForm(updater: (current: ProductFormState) => ProductFormState) {
    setForm(updater);
    setNotice(null);
  }

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    patchForm((current) => ({ ...current, [key]: value }));
  }

  function toggleBadge(badge: ProductBadge) {
    patchForm((current) => ({
      ...current,
      badges: current.badges.includes(badge)
        ? current.badges.filter((item) => item !== badge)
        : [...current.badges, badge],
    }));
  }

  function addPackaging() {
    patchForm((current) => ({
      ...current,
      packagings: [
        ...current.packagings,
        // Sem embalagem "padrão" (regra do negócio): toda nova nasce igual às demais.
        { packagingType: "peca", unitsPerPack: 1, isDefault: false },
      ],
    }));
  }

  function removePackaging(index: number) {
    patchForm((current) => ({
      ...current,
      packagings: current.packagings.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updatePackaging(index: number, patch: Partial<ProductFormState["packagings"][number]>) {
    patchForm((current) => ({
      ...current,
      packagings: current.packagings.map((packaging, itemIndex) =>
        itemIndex === index ? { ...packaging, ...patch } : packaging
      ),
    }));
  }

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    setAttempted(true);
    setSaveError(null);

    if (hasProductFormErrors(errors)) {
      setSaveError(dictionary.form.errors.invalid);
      // Leva o foco ao primeiro campo obrigatório com problema.
      if (errors.sku) skuRef.current?.focus();
      else if (errors.namePt) nameRef.current?.focus();
      return;
    }

    const payload = buildProductPayload(form);
    try {
      if (currentProductId) {
        const updated = await updateMutation.mutateAsync({ id: currentProductId, patch: payload });
        applyDetail(updated);
        invalidateCatalog(currentProductId);
        setNotice("saved");
      } else {
        const created = await createMutation.mutateAsync(payload);
        setCurrentProductId(created.id);
        applyDetail(created);
        invalidateCatalog(created.id);
        setNotice("created");
      }
    } catch (error) {
      setSaveError(saveErrorMessage(error, dictionary.form.errors, errorLabel));
    }
  }

  const selectedCategories = categories.filter((category) => form.categoryIds.includes(category.id));

  // O papel do diálogo vira o próprio <form> (padrão "form dialog" do MUI): o
  // Enter em qualquer campo salva e o botão "Salvar" fica no rodapé fixo, fora
  // do conteúdo rolável. `noValidate` desliga os balões nativos do navegador —
  // a validação é a inline abaixo. Objeto à parte (não literal) porque o tipo
  // do slot não lista `noValidate`, embora o <form> o aceite.
  const formPaperProps = { component: "form", onSubmit: handleSubmit, noValidate: true } as const;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      scroll="paper"
      slotProps={{ paper: formPaperProps }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        {isEditing ? dictionary.form.editTitle : dictionary.form.createTitle}
      </DialogTitle>
      {/* Fora do <h2> do título: um botão dentro do cabeçalho entraria no nome
          acessível do diálogo ("Editar Produto Fechar"). */}
      <IconButton
        aria-label={dictionary.form.actions.close}
        onClick={onClose}
        sx={{ position: "absolute", right: 12, top: 12 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      {detailLoading ? <LinearProgress aria-label={commonDictionary.loading} /> : null}

      <DialogContent dividers>
        {detailQuery.isError && !hydrated ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorLabel}
          </Alert>
        ) : null}
        {/* Enquanto o detalhe não chega o formulário está vazio: fica inerte
            (sem digitação nem salvar) em vez de convidar a sobrescrever. */}
        <Stack
          spacing={4}
          divider={<Divider flexItem />}
          sx={detailUnavailable ? { opacity: 0.5, pointerEvents: "none" } : undefined}
          aria-busy={detailLoading}
        >
          <FormSection
            title={dictionary.form.sections.identification.title}
            hint={dictionary.form.sections.identification.hint}
          >
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  required
                  label={dictionary.form.fields.sku}
                  value={form.sku}
                  inputRef={skuRef}
                  onChange={(event) => updateField("sku", event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, sku: true }))}
                  error={showSkuError}
                  helperText={showSkuError ? requiredText : undefined}
                  slotProps={{ htmlInput: { maxLength: PRODUCT_FIELD_LIMITS.sku } }}
                />
                <TextField
                  label={dictionary.form.fields.erpCode}
                  value={form.erpCode}
                  onChange={(event) => updateField("erpCode", event.target.value)}
                  slotProps={{ htmlInput: { maxLength: PRODUCT_FIELD_LIMITS.erpCode } }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={dictionary.form.fields.ncm}
                  value={form.ncm}
                  onChange={(event) => updateField("ncm", event.target.value)}
                  slotProps={{ htmlInput: { maxLength: PRODUCT_FIELD_LIMITS.ncm } }}
                />
                <TextField
                  label={dictionary.form.fields.barcode}
                  value={form.barcodeEan13}
                  onChange={(event) => updateField("barcodeEan13", event.target.value)}
                  slotProps={{ htmlInput: { maxLength: PRODUCT_FIELD_LIMITS.barcodeEan13 } }}
                />
              </Stack>
            </Stack>
          </FormSection>

          <FormSection
            title={dictionary.form.sections.copy.title}
            hint={dictionary.form.sections.copy.hint}
          >
            <Stack spacing={2.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  required
                  label={dictionary.form.fields.name}
                  value={form.namePt}
                  inputRef={nameRef}
                  onChange={(event) => updateField("namePt", event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, namePt: true }))}
                  error={showNameError}
                  helperText={showNameError ? requiredText : undefined}
                />
                <TextField
                  label={dictionary.form.fields.nameEn}
                  value={form.nameEn}
                  onChange={(event) => updateField("nameEn", event.target.value)}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label={dictionary.form.fields.description}
                  value={form.descriptionPt}
                  onChange={(event) => updateField("descriptionPt", event.target.value)}
                  multiline
                  minRows={3}
                />
                <TextField
                  label={dictionary.form.fields.descriptionEn}
                  value={form.descriptionEn}
                  onChange={(event) => updateField("descriptionEn", event.target.value)}
                  multiline
                  minRows={3}
                />
              </Stack>
            </Stack>
          </FormSection>

          <FormSection
            title={dictionary.form.sections.categories.title}
            hint={dictionary.form.sections.categories.hint}
          >
            <Stack spacing={2.5}>
              <Autocomplete
                multiple
                options={categories}
                getOptionLabel={(option) => option.namePt}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedCategories}
                onChange={(_event, value) => {
                  const categoryIds = value.map((option) => option.id);
                  patchForm((current) => ({
                    ...current,
                    categoryIds,
                    primaryCategoryId: categoryIds.includes(current.primaryCategoryId)
                      ? current.primaryCategoryId
                      : (categoryIds[0] ?? ""),
                  }));
                }}
                renderInput={(params) => (
                  <TextField {...params} label={dictionary.form.fields.category} />
                )}
              />
              {form.categoryIds.length > 1 ? (
                <TextField
                  select
                  label={dictionary.form.fields.primaryCategory}
                  value={form.primaryCategoryId}
                  onChange={(event) => updateField("primaryCategoryId", event.target.value)}
                  helperText={dictionary.form.fields.primaryCategoryHelper}
                  sx={{ maxWidth: 360 }}
                >
                  {selectedCategories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.namePt}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}

              <Box role="group" aria-labelledby="product-badges-label">
                <Typography id="product-badges-label" variant="subtitle2" sx={{ mb: 0.5 }}>
                  {dictionary.table.badges}
                </Typography>
                <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", columnGap: 2 }}>
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
              </Box>
            </Stack>
          </FormSection>

          <FormSection
            title={dictionary.form.sections.showcase.title}
            hint={dictionary.form.sections.showcase.hint}
          >
            <Stack spacing={1.5}>
              <SwitchField
                checked={form.published}
                onChange={(checked) => updateField("published", checked)}
                label={dictionary.form.fields.published}
                helper={dictionary.form.fields.publishedHelper}
                disabled={!canPublish}
              />
              <SwitchField
                checked={form.featured}
                onChange={(checked) => updateField("featured", checked)}
                label={dictionary.form.fields.featured}
                helper={dictionary.form.fields.featuredHelper}
              />
              {form.featured ? (
                <TextField
                  type="number"
                  label={dictionary.form.fields.featuredOrder}
                  value={form.featuredOrder}
                  onChange={(event) => updateField("featuredOrder", event.target.value)}
                  error={errors.featuredOrder}
                  helperText={
                    errors.featuredOrder
                      ? dictionary.form.validation.wholeNumber
                      : dictionary.form.fields.featuredOrderHelper
                  }
                  slotProps={{
                    htmlInput: { min: 0, max: PRODUCT_FIELD_LIMITS.featuredOrder, step: 1 },
                  }}
                  sx={{ maxWidth: 360, ml: 6.5 }}
                />
              ) : null}
              <SwitchField
                checked={form.bestSeller}
                onChange={(checked) => updateField("bestSeller", checked)}
                label={dictionary.form.fields.bestSeller}
                helper={dictionary.form.fields.bestSellerHelper}
              />
            </Stack>
          </FormSection>

          <FormSection
            title={dictionary.form.sections.packaging.title}
            hint={dictionary.form.sections.packaging.hint}
          >
            <Stack spacing={1.5}>
              {form.packagings.map((packaging, index) => {
                const duplicate = attempted && errors.duplicatePackagings.includes(index);
                const unitsInvalid = (attempted && errors.packagings.includes(index)) || duplicate;
                return (
                  <Stack
                    key={packaging.id ?? index}
                    direction="row"
                    useFlexGap
                    spacing={1.5}
                    sx={{ alignItems: "flex-start", flexWrap: "wrap" }}
                  >
                    {/* `size="small"` + `fullWidth={false}` deliberados: linha
                        densa dentro de uma lista já editável em loco — ver "Regra
                        de densidade de campos" em `src/core/theme/index.ts`. */}
                    <TextField
                      select
                      size="small"
                      fullWidth={false}
                      label={dictionary.form.fields.packagingType}
                      value={packaging.packagingType}
                      onChange={(event) =>
                        updatePackaging(index, { packagingType: event.target.value as PackagingType })
                      }
                      sx={{ minWidth: 180 }}
                    >
                      {PACKAGING_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {dictionary.form.packagingTypes[PACKAGING_LABEL_KEY[type]]}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small"
                      fullWidth={false}
                      type="number"
                      label={dictionary.form.fields.unitsPerPack}
                      value={packaging.unitsPerPack > 0 ? packaging.unitsPerPack : ""}
                      onChange={(event) =>
                        updatePackaging(index, {
                          unitsPerPack: event.target.value === "" ? 0 : Number(event.target.value),
                        })
                      }
                      error={unitsInvalid}
                      helperText={
                        duplicate
                          ? dictionary.form.validation.duplicatePackaging
                          : unitsInvalid
                            ? dictionary.form.validation.positiveNumber
                            : undefined
                      }
                      slotProps={{ htmlInput: { min: 1, step: 1 } }}
                      sx={{ width: 200 }}
                    />
                    <IconButton
                      size="small"
                      aria-label={dictionary.form.actions.removePackaging}
                      onClick={() => removePackaging(index)}
                      sx={{ mt: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                );
              })}
              <Box>
                <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addPackaging}>
                  {dictionary.form.actions.addPackaging}
                </Button>
              </Box>
            </Stack>
          </FormSection>

          <FormSection
            title={dictionary.form.sections.images.title}
            hint={dictionary.form.sections.images.hint}
          >
            {currentProductId ? (
              <ProductImagesManager
                productId={currentProductId}
                images={detailQuery.data?.images ?? []}
                dictionary={dictionary.form.images}
                saveLabel={dictionary.form.images.upload}
                removeLabel={dictionary.form.images.remove}
                canUpload={can(user, "product_images", "create")}
                canDelete={can(user, "product_images", "delete")}
                onImagesChanged={() => {
                  queryClient.invalidateQueries({
                    queryKey: trpc.products.byId.queryKey({ id: currentProductId }),
                  });
                  // A capa e o contador de fotos da tabela também mudam.
                  queryClient.invalidateQueries(trpc.products.list.pathFilter());
                  queryClient.invalidateQueries(trpc.products.stats.pathFilter());
                }}
                hideTitle
              />
            ) : (
              <Alert severity="info">{dictionary.form.images.saveFirst}</Alert>
            )}
          </FormSection>

        </Stack>
      </DialogContent>

      {/* Resultado do salvamento FORA da área rolável: o formulário é longo e um
          aviso no fim dele passaria despercebido a quem clicou em "Salvar" lá
          em cima. Erro de validação/servidor usa role="alert"; o sucesso é
          anunciado de forma educada (`role="status"`). */}
      {saveError || notice ? (
        <Box sx={{ px: 3, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
          {!saveError && notice ? (
            <Alert severity="success" role="status">
              {notice === "created" ? dictionary.feedback.created : dictionary.feedback.saved}
            </Alert>
          ) : null}
        </Box>
      ) : null}

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
        {/* Só com o produto JÁ publicado no servidor: o link de um rascunho
            (ou de uma publicação ainda não salva) cairia num 404 no site. */}
        {saved?.published ? (
          <Button
            component="a"
            href={productPublicPath(locale, saved.slug)}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<OpenInNewIcon fontSize="small" />}
            sx={{ mr: "auto" }}
          >
            {dictionary.form.actions.viewOnSite}
          </Button>
        ) : null}
        <Button onClick={onClose}>
          {dirty ? dictionary.form.actions.cancel : dictionary.form.actions.close}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSaving || detailUnavailable}
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {dictionary.form.actions.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
