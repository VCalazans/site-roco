"use client";

import { useState } from "react";
import NextLink from "next/link";
import MuiLink from "@mui/material/Link";
import type { Locale } from "@/i18n/config";
import { ACCOUNT_API } from "@/modules/portal/lib/account-client";
import type { PortalAccountDictionary } from "@/modules/portal/lib/types";
import { AuthCard } from "./auth-card";
import { EmailLinkRequestForm } from "./email-link-request-form";

type ForgotPasswordCardProps = {
  logoAlt: string;
  locale: Locale;
  account: PortalAccountDictionary;
  loginHref: string;
};

/** "Esqueci minha senha" (`/portal/esqueci-senha`): pede o link de redefinição por e-mail. */
export function ForgotPasswordCard({ logoAlt, locale, account, loginHref }: ForgotPasswordCardProps) {
  const copy = account.forgotPassword;
  const [sent, setSent] = useState(false);
  return (
    <AuthCard
      logoAlt={logoAlt}
      title={sent ? copy.sentTitle : copy.title}
      description={sent ? undefined : copy.description}
    >
      <EmailLinkRequestForm
        endpoint={ACCOUNT_API.forgotPassword}
        locale={locale}
        emailLabel={account.emailLabel}
        buttonLabel={copy.button}
        sentMessage={copy.sent}
        errors={account.errors}
        onSent={() => setSent(true)}
      />
      <MuiLink component={NextLink} href={loginHref} variant="body2">
        {account.backToLogin}
      </MuiLink>
    </AuthCard>
  );
}
