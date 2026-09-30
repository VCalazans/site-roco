"use client";

import { useEffect, useState, type ReactNode } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MailIcon from "@mui/icons-material/Mail";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { interpolate } from "@/shared/lib/interpolate";
import { LeadChannelStatus } from "./lead-channel-status";
import { LeadSubjectChip } from "./lead-subject-chip";
import {
  buildReplyActions,
  channelErrorMessage,
  describeChannel,
  formatDateTime,
  isNotFoundError,
  mailtoHref,
  originLabel,
  summarizeLeadItems,
  type LeadReplyTemplates,
} from "./leads-helpers";

type LeadDetail = inferRouterOutputs<AppRouter>["leads"]["byId"];

const TITLE_ID = "lead-detail-title";
const COPY_FEEDBACK_MS = 2500;

/** Texto só para leitor de tela (avisa que o link abre em outra aba). */
const SR_ONLY_SX = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

// ---------------------------------------------------------------------------
// Blocos de layout
// ---------------------------------------------------------------------------

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="subtitle2" component="h3" color="text.secondary" sx={{ mb: 1.5, fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** Lista de definição (rótulo + valor): a marcação certa para "campo: valor" e lida assim por leitores de tela. */
function DetailList({ children }: { children: ReactNode }) {
  return (
    <Box component="dl" sx={{ m: 0, display: "grid", rowGap: 1.5 }}>
      {children}
    </Box>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </div>
  );
}

function ExternalLink({ href, children, newTab }: { href: string; children: ReactNode; newTab: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
    >
      {children}
      <OpenInNewIcon sx={{ fontSize: 14 }} aria-hidden />
      <Box component="span" sx={SR_ONLY_SX}>
        ({newTab})
      </Box>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Envio para os canais internos
// ---------------------------------------------------------------------------

type DeliveryRowProps = {
  label: string;
  status: string;
  error: string | null;
  dictionary: PortalLeadsDictionary;
};

/**
 * O erro só aparece quando o canal FALHOU — um envio bem-sucedido não precisa de
 * explicação. Única exceção: `validation_retry_ok` (enviado, mas sem os campos
 * personalizados), que é um aviso de configuração no RD Station.
 */
function DeliveryRow({ label, status, error, dictionary }: DeliveryRowProps) {
  const state = describeChannel(status, error);
  const message = channelErrorMessage(error, dictionary.detail.delivery.errors);
  const showNote = message !== null && (status === "failed" || error === "validation_retry_ok");
  const note = !showNote
    ? null
    : state.tone === "error"
      ? interpolate(dictionary.detail.delivery.reason, { error: message })
      : message;

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      {/* Largura fixa: o texto do estado alinha nas duas linhas ("RD Station" e "E-mail" têm larguras diferentes). */}
      <Box sx={{ minWidth: 128, flexShrink: 0 }}>
        <LeadChannelStatus
          channel={label}
          shortLabel={label}
          status={status}
          error={error}
          dictionary={dictionary.channels}
        />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, pt: 0.25 }}>
          {dictionary.channels.status[state.status]}
        </Typography>
        {note ? (
          <Typography variant="caption" color={state.tone === "error" ? "error" : "text.secondary"} sx={{ display: "block" }}>
            {note}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo
// ---------------------------------------------------------------------------

type LeadDetailBodyProps = {
  lead: LeadDetail;
  locale: Locale;
  dictionary: PortalLeadsDictionary;
  whatsappUrl: string | null;
};

/** Exportado só para o teste de renderização (`leads-render.test.tsx`): o diálogo em si monta num portal. */
export function LeadDetailBody({ lead, locale, dictionary, whatsappUrl }: LeadDetailBodyProps) {
  const detail = dictionary.detail;
  const origin = originLabel(lead.origin, dictionary.origins);
  const campaign = [
    lead.utmSource ? interpolate(detail.campaign.source, { source: lead.utmSource }) : null,
    lead.utmMedium ? interpolate(detail.campaign.medium, { medium: lead.utmMedium }) : null,
    lead.utmCampaign ? interpolate(detail.campaign.campaign, { campaign: lead.utmCampaign }) : null,
  ].filter((part): part is string => part !== null);
  const phoneDigits = lead.phone.replace(/[^\d+]/g, "");
  const totalUnits = lead.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsSummary = summarizeLeadItems(
    { productName: null, productSku: null, itemsCount: lead.items.length, unitsCount: totalUnits },
    dictionary.items
  );
  const productHref = (slug: string | null) => (slug ? `/${locale}/produtos/${encodeURIComponent(slug)}` : null);

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
        <DetailSection title={detail.sections.contact}>
          <DetailList>
            <DetailField label={detail.fields.name}>{lead.name}</DetailField>
            <DetailField label={detail.fields.email}>
              <Link href={mailtoHref(lead.email)} underline="hover">
                {lead.email}
              </Link>
            </DetailField>
            <DetailField label={detail.fields.phone}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                <Link href={`tel:${phoneDigits}`} underline="hover">
                  {lead.phone}
                </Link>
                {whatsappUrl ? (
                  <ExternalLink href={whatsappUrl} newTab={detail.newTab}>
                    {detail.actions.openWhatsapp}
                  </ExternalLink>
                ) : null}
              </Stack>
            </DetailField>
            <DetailField label={detail.fields.company}>{lead.companyName || "—"}</DetailField>
            <DetailField label={detail.fields.cnpj}>{lead.cnpj || "—"}</DetailField>
          </DetailList>
        </DetailSection>

        <DetailSection title={detail.sections.request}>
          <DetailList>
            <DetailField label={detail.fields.subject}>{dictionary.subjects[lead.subject]}</DetailField>
            <DetailField label={detail.fields.receivedAt}>{formatDateTime(lead.createdAt, locale)}</DetailField>
            <DetailField label={detail.fields.origin}>{origin ?? "—"}</DetailField>
            <DetailField label={detail.fields.campaign}>{campaign.length > 0 ? campaign.join(" · ") : "—"}</DetailField>
            <DetailField label={detail.fields.language}>
              {lead.locale === "en" ? detail.languages.en : detail.languages.pt}
            </DetailField>
            <DetailField label={detail.fields.consent}>
              {lead.consentGranted
                ? interpolate(detail.consentGranted, {
                    date: lead.consentAt ? formatDateTime(lead.consentAt, locale) : "—",
                  })
                : detail.consentMissing}
            </DetailField>
          </DetailList>
        </DetailSection>
      </Box>

      <Divider />

      <DetailSection title={detail.sections.message}>
        {lead.message ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {lead.message}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {detail.noMessage}
          </Typography>
        )}
      </DetailSection>

      {lead.items.length > 0 ? (
        <>
          <Divider />
          <DetailSection title={detail.sections.products}>
            {itemsSummary ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {itemsSummary.primary}
              </Typography>
            ) : null}
            <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
              <Table size="small" aria-label={detail.sections.products}>
                <TableHead>
                  <TableRow>
                    <TableCell>{detail.itemsTable.product}</TableCell>
                    <TableCell>{detail.itemsTable.sku}</TableCell>
                    <TableCell align="right">{detail.itemsTable.quantity}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lead.items.map((item, index) => {
                    const href = productHref(item.productSlug);
                    return (
                      <TableRow key={`${item.productSlug ?? "item"}-${index}`}>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>{item.productName || "—"}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{item.productSku || "—"}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {href ? (
                            <ExternalLink href={href} newTab={detail.newTab}>
                              {detail.itemsTable.viewOnSite}
                            </ExternalLink>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </DetailSection>
        </>
      ) : lead.productName ? (
        <>
          <Divider />
          <DetailSection title={detail.sections.products}>
            <DetailList>
              <DetailField label={detail.singleProduct}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                  <span>
                    {lead.productName}
                    {lead.productSku ? ` · ${interpolate(dictionary.items.sku, { sku: lead.productSku })}` : ""}
                  </span>
                  {productHref(lead.productSlug) ? (
                    <ExternalLink href={productHref(lead.productSlug) ?? ""} newTab={detail.newTab}>
                      {detail.itemsTable.viewOnSite}
                    </ExternalLink>
                  ) : null}
                </Stack>
              </DetailField>
            </DetailList>
          </DetailSection>
        </>
      ) : null}

      <Divider />

      <DetailSection title={detail.sections.delivery}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {detail.delivery.description}
          </Typography>
          <DeliveryRow
            label={detail.delivery.rdStation}
            status={lead.rdStationStatus}
            error={lead.rdStationError}
            dictionary={dictionary}
          />
          <DeliveryRow
            label={detail.delivery.email}
            status={lead.emailStatus}
            error={lead.emailError}
            dictionary={dictionary}
          />
        </Stack>
      </DetailSection>
    </Stack>
  );
}

type LeadDetailContentProps = {
  leadId: string;
  locale: Locale;
  dictionary: PortalLeadsDictionary;
  replyTemplates: LeadReplyTemplates;
  onClose: () => void;
};

/**
 * Carrega e mostra UMA solicitação. Só é montado com o diálogo aberto, e cada
 * abertura busca de novo (`staleTime`/`gcTime` zerados): `leads.byId` grava um
 * registro de auditoria por chamada (RF29) e o cache do cliente não pode
 * esconder uma visualização de dado pessoal — nem manter esse dado em memória
 * depois de fechar. Sem refetch ao voltar o foco/rede e sem retry, para uma
 * falha ou uma troca de aba não gerarem auditoria repetida.
 */
function LeadDetailContent({ leadId, locale, dictionary, replyTemplates, onClose }: LeadDetailContentProps) {
  const trpc = useTRPC();
  const detailQuery = useQuery(
    trpc.leads.byId.queryOptions(
      { id: leadId },
      { staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }
    )
  );
  const lead = detailQuery.data;
  const detail = dictionary.detail;

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [copyState]);

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopyState("copied");
    } catch {
      // Sem permissão da área de transferência ou contexto inseguro (http): avisa em vez de fingir que copiou.
      setCopyState("failed");
    }
  }

  const reply = lead ? buildReplyActions(lead, replyTemplates) : null;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 7 }}>
        {lead ? (
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Typography id={TITLE_ID} variant="h6" component="h2" sx={{ overflowWrap: "anywhere" }}>
                {lead.name}
              </Typography>
              <LeadSubjectChip subject={lead.subject} label={dictionary.subjects[lead.subject]} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {detail.fields.receivedAt}: {formatDateTime(lead.createdAt, locale)}
            </Typography>
          </Stack>
        ) : (
          <Typography id={TITLE_ID} variant="h6" component="h2">
            {dictionary.title}
          </Typography>
        )}
        <IconButton
          aria-label={detail.close}
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {detailQuery.isPending ? (
          <Stack spacing={2} aria-busy="true">
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={96} />
          </Stack>
        ) : detailQuery.isError || !lead ? (
          <Alert
            severity={isNotFoundError(detailQuery.error) ? "warning" : "error"}
            action={
              isNotFoundError(detailQuery.error) ? undefined : (
                <Button color="inherit" size="small" onClick={() => void detailQuery.refetch()}>
                  {detail.error.retry}
                </Button>
              )
            }
          >
            {isNotFoundError(detailQuery.error) ? detail.error.notFound : detail.error.description}
          </Alert>
        ) : (
          <LeadDetailBody lead={lead} locale={locale} dictionary={dictionary} whatsappUrl={reply?.whatsappUrl ?? null} />
        )}
      </DialogContent>

      <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, py: 2 }}>
        {lead && reply ? (
          <>
            <Button
              color="inherit"
              startIcon={copyState === "copied" ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={() => void copyEmail(lead.email)}
            >
              {copyState === "copied"
                ? detail.actions.copied
                : copyState === "failed"
                  ? detail.actions.copyFailed
                  : detail.actions.copyEmail}
            </Button>
            {reply.whatsappUrl ? (
              <Button
                variant="outlined"
                color="success"
                href={reply.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<WhatsAppIcon />}
              >
                {detail.actions.whatsapp}
                <Box component="span" sx={SR_ONLY_SX}>
                  {" "}
                  ({detail.newTab})
                </Box>
              </Button>
            ) : null}
            <Button variant="contained" href={reply.mailtoUrl} startIcon={<MailIcon />}>
              {detail.actions.replyEmail}
            </Button>
          </>
        ) : null}
        <Button onClick={onClose}>{detail.close}</Button>
      </DialogActions>
    </>
  );
}

// ---------------------------------------------------------------------------
// Diálogo
// ---------------------------------------------------------------------------

type LeadDetailDialogProps = {
  /** Solicitação em exibição. Continua definido durante a animação de saída. */
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  /** Depois da animação de saída — hora de limpar `leadId`. */
  onExited: () => void;
  locale: Locale;
  dictionary: PortalLeadsDictionary;
  replyTemplates: LeadReplyTemplates;
};

export function LeadDetailDialog({
  leadId,
  open,
  onClose,
  onExited,
  locale,
  dictionary,
  replyTemplates,
}: LeadDetailDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      scroll="paper"
      aria-labelledby={TITLE_ID}
      slotProps={{ transition: { onExited } }}
    >
      {leadId ? (
        <LeadDetailContent
          key={leadId}
          leadId={leadId}
          locale={locale}
          dictionary={dictionary}
          replyTemplates={replyTemplates}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}
