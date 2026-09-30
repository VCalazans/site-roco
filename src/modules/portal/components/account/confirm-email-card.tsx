"use client";

import { useState } from "react";
import NextLink from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import {
  ACCOUNT_API,
  accountErrorMessage,
  postAccount,
  useAccountLinkToken,
} from "@/modules/portal/lib/account-client";
import type { AccountLinkFailure, PortalAccountDictionary } from "@/modules/portal/lib/types";
import { AuthCard } from "./auth-card";
import { EmailLinkRequestForm } from "./email-link-request-form";

const FAILURES: readonly AccountLinkFailure[] = ["invalid", "expired", "used"];

type ConfirmEmailCardProps = {
  logoAlt: string;
  locale: Locale;
  account: PortalAccountDictionary;
  loginHref: string;
};

/**
 * Tela do link de confirmação de cadastro (`/portal/confirmar-email#token=…`).
 * Confere o link ao abrir e só o CONSOME no clique do botão (leitores de link
 * de antivírus abrem a URL sozinhos). Link morto — ou página aberta sem link —
 * oferece reenviar a confirmação.
 */
export function ConfirmEmailCard({ logoAlt, locale, account, loginHref }: ConfirmEmailCardProps) {
  const copy = account.confirmEmail;
  const link = useAccountLinkToken("email_verification");
  const [phase, setPhase] = useState<"idle" | "confirming">("idle");
  const [result, setResult] = useState<{ submitted: boolean; cnpjConflict: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!link.token) return;
    setPhase("confirming");
    setError(null);
    const response = await postAccount(ACCOUNT_API.confirmVerification, { token: link.token });
    setPhase("idle");
    if (response.ok) {
      setResult({ submitted: response.data.submitted === true, cnpjConflict: response.data.cnpjConflict === true });
      return;
    }
    if ((FAILURES as readonly string[]).includes(response.error)) {
      link.markFailed(response.error as AccountLinkFailure);
      return;
    }
    setError(accountErrorMessage(response.error, account.errors));
  }

  const backToLogin = (
    <MuiLink component={NextLink} href={loginHref} variant="body2">
      {account.backToLogin}
    </MuiLink>
  );

  if (result) {
    return (
      <AuthCard logoAlt={logoAlt} title={copy.successTitle}>
        <Alert severity={result.cnpjConflict ? "warning" : "success"} sx={{ width: "100%", textAlign: "left" }}>
          {result.cnpjConflict ? copy.successCnpjConflict : result.submitted ? copy.successSubmitted : copy.successGeneric}
        </Alert>
        <Button component={NextLink} href={loginHref} variant="contained" size="large" fullWidth sx={{ py: 1.6 }}>
          {copy.loginButton}
        </Button>
      </AuthCard>
    );
  }

  if (link.status === "checking") {
    return (
      <AuthCard logoAlt={logoAlt} title={copy.title}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }} role="status">
          <CircularProgress size={20} />
          <Typography variant="body2">{account.linkStates.checking}</Typography>
        </Stack>
      </AuthCard>
    );
  }

  if (link.status === "valid") {
    return (
      <AuthCard logoAlt={logoAlt} title={copy.title} description={copy.description}>
        {error ? (
          <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => void confirm()}
          disabled={phase === "confirming"}
          startIcon={phase === "confirming" ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ py: 1.6 }}
        >
          {copy.button}
        </Button>
        {backToLogin}
      </AuthCard>
    );
  }

  const failure = (FAILURES as readonly string[]).includes(link.status) ? (link.status as AccountLinkFailure) : null;
  return (
    <AuthCard
      logoAlt={logoAlt}
      title={failure ? account.linkStates[`${failure}Title`] : copy.resendTitle}
      description={failure ? undefined : copy.resendDescription}
    >
      {failure ? (
        <Alert severity={failure === "used" ? "info" : "warning"} sx={{ width: "100%", textAlign: "left" }}>
          {copy[failure]}
        </Alert>
      ) : null}
      {link.status === "error" ? (
        <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>
          {accountErrorMessage(link.error ?? "generic", account.errors)}
        </Alert>
      ) : null}
      <EmailLinkRequestForm
        endpoint={ACCOUNT_API.resendVerification}
        locale={locale}
        emailLabel={account.emailLabel}
        buttonLabel={copy.resendButton}
        sentMessage={copy.resendSent}
        errors={account.errors}
      />
      {backToLogin}
    </AuthCard>
  );
}
