"use client";

import { useState, type FormEvent } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import {
  ACCOUNT_API,
  accountErrorMessage,
  postAccount,
  useAccountLinkToken,
} from "@/modules/portal/lib/account-client";
import type { AccountLinkFailure, PortalAccountDictionary } from "@/modules/portal/lib/types";
import { checkPassword, type PasswordIssue } from "@/shared/lib/password-policy";
import { AuthCard } from "./auth-card";

const FAILURES: readonly AccountLinkFailure[] = ["invalid", "expired", "used"];

type ResetPasswordCardProps = {
  logoAlt: string;
  locale: Locale;
  account: PortalAccountDictionary;
  loginHref: string;
  /** Login com o aviso "senha alterada". */
  loginAfterResetHref: string;
  forgotPasswordHref: string;
};

/**
 * Nova senha pelo link de redefinição (`/portal/redefinir-senha#token=…`).
 * Confere o link antes de mostrar o formulário (ninguém digita a senha nova
 * para só então descobrir que o link venceu) e valida com a MESMA política do
 * servidor. Deu certo: volta ao login com o aviso de senha alterada.
 */
export function ResetPasswordCard({
  logoAlt,
  locale,
  account,
  loginHref,
  loginAfterResetHref,
  forgotPasswordHref,
}: ResetPasswordCardProps) {
  const copy = account.resetPassword;
  const router = useRouter();
  const link = useAccountLinkToken("password_reset");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = checkPassword(password);
    setPasswordError(issue ? copy.passwordIssues[issue] : null);
    setConfirmationError(confirmation !== password ? copy.mismatch : null);
    if (issue || confirmation !== password || !link.token) return;

    setError(null);
    setPhase("saving");
    const result = await postAccount(ACCOUNT_API.resetPassword, { token: link.token, password, locale });
    if (result.ok) {
      setPhase("saved");
      router.replace(loginAfterResetHref);
      return;
    }
    setPhase("idle");
    if (result.error === "weak_password" && result.issue && result.issue in copy.passwordIssues) {
      setPasswordError(copy.passwordIssues[result.issue as PasswordIssue]);
      return;
    }
    if ((FAILURES as readonly string[]).includes(result.error)) {
      link.markFailed(result.error as AccountLinkFailure);
      return;
    }
    setError(accountErrorMessage(result.error, account.errors));
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

  if (link.status !== "valid") {
    const failure: AccountLinkFailure = (FAILURES as readonly string[]).includes(link.status)
      ? (link.status as AccountLinkFailure)
      : "invalid";
    return (
      <AuthCard logoAlt={logoAlt} title={account.linkStates[`${failure}Title`]}>
        <Alert severity="warning" sx={{ width: "100%", textAlign: "left" }}>
          {link.status === "error" ? accountErrorMessage(link.error ?? "generic", account.errors) : copy[failure]}
        </Alert>
        <Button component={NextLink} href={forgotPasswordHref} variant="contained" size="large" fullWidth sx={{ py: 1.6 }}>
          {copy.requestNew}
        </Button>
        <MuiLink component={NextLink} href={loginHref} variant="body2">
          {account.backToLogin}
        </MuiLink>
      </AuthCard>
    );
  }

  return (
    <AuthCard logoAlt={logoAlt} title={copy.title} description={copy.description}>
      <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5} sx={{ width: "100%" }}>
        {error ? (
          <Alert severity="error" sx={{ textAlign: "left" }}>
            {error}
          </Alert>
        ) : null}
        <TextField
          type="password"
          label={copy.password}
          autoComplete="new-password"
          required
          fullWidth
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError(null);
          }}
          error={Boolean(passwordError)}
          helperText={passwordError ?? copy.hint}
        />
        <TextField
          type="password"
          label={copy.passwordConfirm}
          autoComplete="new-password"
          required
          fullWidth
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setConfirmationError(null);
          }}
          error={Boolean(confirmationError)}
          helperText={confirmationError ?? undefined}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={phase !== "idle"}
          startIcon={phase !== "idle" ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ py: 1.6 }}
        >
          {copy.button}
        </Button>
      </Stack>
      <MuiLink component={NextLink} href={loginHref} variant="body2">
        {account.backToLogin}
      </MuiLink>
    </AuthCard>
  );
}
