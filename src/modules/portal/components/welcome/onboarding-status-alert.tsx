"use client";

import NextLink from "next/link";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type OnboardingStatusAlertProps = {
  onboardingHref: string;
  dictionary: PortalDictionary["onboarding"];
};

/**
 * Alerta exibido no topo da página de boas-vindas quando o cadastro do
 * representante ainda não está `approved` — aponta para `/portal/onboarding`.
 * Client component só por causa da query tRPC (`representatives.me`); o
 * restante da página de boas-vindas é Server Component.
 *
 * Sem chave de dicionário dedicada a "complete seu cadastro" fora do fluxo
 * de onboarding em si: reaproveita `onboarding.title` ("Complete seu
 * cadastro") como rótulo do CTA e `onboarding.subtitle` como corpo da
 * mensagem — mesmo texto que o usuário já vê ao entrar no wizard, aqui só
 * como convite a partir da home do representante (ver relatório final).
 */
export function OnboardingStatusAlert({ onboardingHref, dictionary }: OnboardingStatusAlertProps) {
  const trpc = useTRPC();
  const meQuery = useQuery(trpc.representatives.me.queryOptions());

  if (meQuery.isLoading) {
    return <Skeleton variant="rounded" height={72} sx={{ mb: 4 }} />;
  }

  const status = meQuery.data?.status ?? "draft";

  // Aprovado com perfil completo: nada a pedir. Aprovado SEM território =
  // veio do pré-cadastro do site — o primeiro acesso completa o restante.
  const needsCompletion = status === "approved" && !meQuery.data?.region;
  if (status === "approved" && !needsCompletion) {
    return null;
  }

  const severity = status === "rejected" ? "warning" : needsCompletion ? "success" : "info";
  const title = needsCompletion ? dictionary.completion.title : dictionary.status[status];
  const body = needsCompletion ? dictionary.completion.subtitle : dictionary.subtitle;

  return (
    <Alert
      severity={severity}
      sx={{ mb: 4 }}
      action={
        <Button
          component={NextLink}
          href={onboardingHref}
          color="inherit"
          size="small"
          variant="outlined"
        >
          {dictionary.title}
        </Button>
      }
    >
      <Stack spacing={0.5}>
        <AlertTitle>{title}</AlertTitle>
        {body}
      </Stack>
    </Alert>
  );
}
