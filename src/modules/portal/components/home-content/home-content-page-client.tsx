"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert, { type AlertColor } from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import {
  HOME_SECTION_IDS,
  resolveHomeLayout,
  targetsHiddenSection,
  type HomeContentDocument,
  type HomeSectionId,
} from "@/modules/home/lib/home-content";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { AboutEditor } from "./about-editor";
import { CategoriesEditor } from "./categories-editor";
import { FacadeEditor } from "./facade-editor";
import { FeaturedEditor } from "./featured-editor";
import { srOnlySx } from "./fields";
import {
  baseFormFor,
  deepEqual,
  messageForMutationError,
  moveItem,
  setLayoutEnabled,
  validateSection,
  visibleErrors,
  type EditableSection,
  type FieldErrors,
  type HomeEditorDefaults,
  type LayoutItem,
  type SectionFormMap,
} from "./home-editor-model";
import { PortalCtaEditor } from "./portal-cta-editor";
import { SectionEditorFrame } from "./section-editor-frame";
import { SectionNavigator } from "./section-navigator";

type HomeContentData = inferRouterOutputs<AppRouter>["homeContent"]["get"];
type UpdateInput = inferRouterInputs<AppRouter>["homeContent"]["update"];

type Drafts = { [K in EditableSection]?: SectionFormMap[K] };
type Toast = { seq: number; severity: AlertColor; message: string };

export type HomeContentPageClientProps = {
  /** Idioma da interface do painel. */
  locale: Locale;
  dictionary: PortalHomeContentDictionary;
  /** Textos padrão do dicionário do SITE, nos dois idiomas (placeholders e pré-preenchimento de listas). */
  defaults: HomeEditorDefaults;
  /** `home_content:update`. */
  canEdit: boolean;
  /** `products:read` — ver a lista de produtos da vitrine. */
  canReadProducts: boolean;
  /** `products:update` — adicionar, remover e reordenar produtos da vitrine. */
  canEditProducts: boolean;
  /** `hero_slides:read` — o cartão do hero vira link para o editor de slides. */
  canOpenHero: boolean;
};

const TOAST_DURATION_MS = 6000;

/**
 * Editor da página inicial (`/portal/pagina-inicial`, spec 001, RF18–RF21).
 *
 * Arquitetura em uma frase: o servidor guarda UM documento por seção
 * (`homeContent.update`), e aqui cada seção tem seu RASCUNHO — o formulário é o
 * próprio documento, então o payload é validado pelo mesmo schema zod do
 * servidor antes de sair. Rascunhos ficam todos na página (não em cada
 * editor), então trocar de seção nunca perde o que foi digitado.
 */
export function HomeContentPageClient(props: HomeContentPageClientProps) {
  const { locale, dictionary } = props;
  const trpc = useTRPC();
  const query = useQuery(trpc.homeContent.get.queryOptions());

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
        <Button
          variant="outlined"
          href={`/${locale}`}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon fontSize="small" />}
          sx={{ flexShrink: 0 }}
        >
          {dictionary.viewSite}
          <Box component="span" sx={srOnlySx}>
            {" "}
            ({dictionary.newTab})
          </Box>
        </Button>
      </Stack>

      {!props.canEdit ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {dictionary.readOnly}
        </Alert>
      ) : null}

      {query.isLoading ? (
        <EditorSkeleton />
      ) : query.isError || !query.data ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {dictionary.retry}
            </Button>
          }
        >
          {dictionary.loadError}
        </Alert>
      ) : (
        <HomeContentEditor {...props} data={query.data} />
      )}
    </Box>
  );
}

function EditorSkeleton() {
  return (
    <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "340px minmax(0, 1fr)" } }}>
      <Skeleton variant="rounded" height={520} />
      <Skeleton variant="rounded" height={520} />
    </Box>
  );
}

type HomeContentEditorProps = HomeContentPageClientProps & { data: HomeContentData };

function HomeContentEditor({
  data,
  locale,
  dictionary,
  defaults,
  canEdit,
  canReadProducts,
  canEditProducts,
  canOpenHero,
}: HomeContentEditorProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<HomeSectionId>("facade");
  const [drafts, setDrafts] = useState<Drafts>({});
  const [layoutDraft, setLayoutDraft] = useState<LayoutItem[] | null>(null);
  /** Depois da 1ª tentativa de salvar uma seção, ela passa a mostrar TODOS os erros. */
  const [showAllErrors, setShowAllErrors] = useState<Partial<Record<EditableSection, boolean>>>({});
  /** Imagens enviadas nesta sessão e ainda não salvas: chave → URL pública. */
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const documents = data.documents;
  const savedLayout = useMemo(() => resolveHomeLayout(documents.layout), [documents.layout]);
  const layout = layoutDraft ?? savedLayout;
  const layoutDirty = layoutDraft !== null && !deepEqual(layoutDraft, savedLayout);
  const imageUrls = useMemo(() => ({ ...data.imageUrls, ...uploadedUrls }), [data.imageUrls, uploadedUrls]);

  function notify(severity: AlertColor, message: string) {
    setToast((current) => ({ seq: (current?.seq ?? 0) + 1, severity, message }));
    setToastOpen(true);
  }

  // ---- Rascunhos ----------------------------------------------------------

  function formFor<K extends EditableSection>(section: K): SectionFormMap[K] {
    return (drafts[section] as SectionFormMap[K] | undefined) ?? baseFormFor(section, documents);
  }

  function isDirty(section: EditableSection): boolean {
    const draft = drafts[section];
    return draft !== undefined && !deepEqual(draft, baseFormFor(section, documents));
  }

  function changeForm<K extends EditableSection>(section: K, next: SectionFormMap[K]) {
    setDrafts((current) => ({ ...current, [section]: next }));
  }

  function clearDraft(section: EditableSection) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[section];
      return next;
    });
    setShowAllErrors((current) => ({ ...current, [section]: false }));
  }

  const savedSections = Object.fromEntries(
    HOME_SECTION_IDS.map((id) => [id, documents[id] !== null])
  ) as Record<HomeSectionId, boolean>;
  const dirtySections = Object.fromEntries(HOME_SECTION_IDS.map((id) => [id, isDirty(id)])) as Record<
    HomeSectionId,
    boolean
  >;
  const anyDirty = layoutDirty || HOME_SECTION_IDS.some((id) => dirtySections[id]);

  // Sair da página com rascunho perde o trabalho — o navegador pergunta antes.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  // ---- Servidor -----------------------------------------------------------

  /**
   * Reflete o resultado de uma gravação no cache da query SEM esperar o refetch:
   * o formulário volta a ler o documento salvo, e um refetch em voo não faz o
   * conteúdo "piscar" de volta para o valor antigo.
   */
  function patchCache(document: HomeContentDocument, value: unknown, updatedAt: string | Date | null) {
    queryClient.setQueryData(trpc.homeContent.get.queryKey(), (old) => {
      if (!old) return old;
      const nextUpdatedAt: Record<string, string | Date> = { ...old.updatedAt };
      if (updatedAt) nextUpdatedAt[document] = updatedAt;
      else delete nextUpdatedAt[document];
      return {
        ...old,
        documents: { ...old.documents, [document]: value } as HomeContentData["documents"],
        updatedAt: nextUpdatedAt as HomeContentData["updatedAt"],
      };
    });
  }

  const updateMutation = useMutation(
    trpc.homeContent.update.mutationOptions({
      onSuccess: (result, variables) => {
        patchCache(variables.document, variables.data, result.updatedAt);
        setUploadedUrls((current) => ({ ...current, ...result.imageUrls }));
        if (variables.document === "layout") {
          setLayoutDraft(null);
          notify("success", dictionary.navigator.layoutSaved);
        } else {
          clearDraft(variables.document);
          notify("success", dictionary.editor.saved);
        }
        void queryClient.invalidateQueries({ queryKey: trpc.homeContent.get.queryKey() });
      },
      onError: (error) => notify("error", messageForMutationError(error, dictionary.editor)),
    })
  );

  const resetMutation = useMutation(
    trpc.homeContent.reset.mutationOptions({
      onSuccess: (result) => {
        patchCache(result.document, null, null);
        if (result.document !== "layout") clearDraft(result.document);
        notify("success", dictionary.editor.resetDone);
        void queryClient.invalidateQueries({ queryKey: trpc.homeContent.get.queryKey() });
      },
      onError: () => notify("error", dictionary.editor.resetFailed),
    })
  );

  const savingSection = updateMutation.isPending ? updateMutation.variables?.document : undefined;
  const savingLayout = savingSection === "layout";
  const busy = updateMutation.isPending || resetMutation.isPending;

  function focusFirstInvalid() {
    // Espera o próximo quadro: os erros só aparecem depois de o React re-renderizar.
    window.requestAnimationFrame(() => {
      editorRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }

  function saveSection(section: EditableSection) {
    const { data: payload } = validateSection(section, formFor(section) as never, dictionary.errors);
    if (!payload) {
      setShowAllErrors((current) => ({ ...current, [section]: true }));
      notify("error", dictionary.editor.fixErrors);
      focusFirstInvalid();
      return;
    }
    // O servidor revalida com o mesmo schema; o cast só ajuda a correlacionar `document` e `data`.
    updateMutation.mutate({ document: section, data: payload } as UpdateInput);
  }

  function saveLayout() {
    updateMutation.mutate({ document: "layout", data: { sections: layout } });
  }

  // ---- Navegação ----------------------------------------------------------

  function selectSection(id: HomeSectionId) {
    setSelected(id);
    // Abaixo de `lg` o editor fica ABAIXO da lista: leva a tela até ele.
    if (!window.matchMedia("(min-width: 1200px)").matches) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
      );
    }
  }

  function handleImageUrl(key: string, url: string) {
    setUploadedUrls((current) => ({ ...current, [key]: url }));
  }

  // ---- Editor da seção escolhida -----------------------------------------

  function renderEditor() {
    const errorsFor = <K extends EditableSection>(section: K): FieldErrors =>
      visibleErrors(section, formFor(section), dictionary.errors, showAllErrors[section] === true);

    const common = {
      locale,
      defaults,
      dictionary,
      imageUrls,
      onImageUrl: handleImageUrl,
      readOnly: !canEdit,
      disabled: !canEdit || busy,
    };

    switch (selected) {
      case "facade": {
        const facadeForm = formFor("facade");
        const visibleSections = layout.filter((section) => section.enabled).map((section) => section.id);
        const facadeHref = facadeForm.ctaHref.trim() || defaults.pt.facade.ctaHref;
        return (
          <FacadeEditor
            {...common}
            form={facadeForm}
            onChange={(next) => changeForm("facade", next)}
            errors={errorsFor("facade")}
            ctaTargetHidden={targetsHiddenSection(facadeHref, visibleSections)}
          />
        );
      }
      case "about":
        return (
          <AboutEditor
            {...common}
            form={formFor("about")}
            onChange={(next) => changeForm("about", next)}
            errors={errorsFor("about")}
          />
        );
      case "categories":
        return (
          <CategoriesEditor
            {...common}
            form={formFor("categories")}
            onChange={(next) => changeForm("categories", next)}
            errors={errorsFor("categories")}
          />
        );
      case "featured":
        return (
          <FeaturedEditor
            {...common}
            form={formFor("featured")}
            onChange={(next) => changeForm("featured", next)}
            errors={errorsFor("featured")}
            canReadProducts={canReadProducts}
            canManageProducts={canEditProducts}
            onNotify={notify}
          />
        );
      case "portalCta":
        return (
          <PortalCtaEditor
            {...common}
            form={formFor("portalCta")}
            onChange={(next) => changeForm("portalCta", next)}
            errors={errorsFor("portalCta")}
          />
        );
    }
  }

  const section = dictionary.sections[selected];

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 3,
          alignItems: "start",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "340px minmax(0, 1fr)" },
        }}
      >
        <SectionNavigator
          dictionary={dictionary}
          heroHref={`/${locale}/portal/hero`}
          canOpenHero={canOpenHero}
          layout={layout}
          layoutDirty={layoutDirty}
          selected={selected}
          savedSections={savedSections}
          dirtySections={dirtySections}
          canEdit={canEdit}
          savingLayout={savingLayout}
          onSelect={selectSection}
          onMove={(index, delta) => setLayoutDraft(moveItem(layout, index, index + delta))}
          onToggle={(id, enabled) => setLayoutDraft(setLayoutEnabled(layout, id, enabled))}
          onSaveLayout={saveLayout}
          onDiscardLayout={() => setLayoutDraft(null)}
        />

        <Box ref={editorRef} sx={{ minWidth: 0, scrollMarginTop: 88 }}>
          <SectionEditorFrame
            key={selected}
            headingId={`home-section-${selected}-title`}
            title={section.name}
            description={section.description}
            locale={locale}
            dictionary={dictionary.editor}
            hasSaved={savedSections[selected]}
            updatedAt={data.updatedAt[selected] ?? null}
            dirty={dirtySections[selected]}
            canEdit={canEdit}
            saving={savingSection === selected}
            resetting={resetMutation.isPending}
            onSave={() => saveSection(selected)}
            onDiscard={() => clearDraft(selected)}
            onReset={() => resetMutation.mutate({ document: selected })}
          >
            {renderEditor()}
          </SectionEditorFrame>
        </Box>
      </Box>

      <Snackbar
        key={toast?.seq}
        open={toastOpen}
        autoHideDuration={TOAST_DURATION_MS}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") setToastOpen(false);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast?.severity ?? "success"}
          variant="filled"
          onClose={() => setToastOpen(false)}
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
