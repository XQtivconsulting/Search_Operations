export interface MailConfig {
  RESEND_API_KEY?: string;
  INVITATION_FROM?: string;
}

export type EmailStatus = 'accepted' | 'not_configured' | 'unconfirmed';

// Called only after the authenticated administrator has created an invitation.
// Never expose provider responses: they can echo recipient or token content.
export async function sendInvitationEmail(
  config: MailConfig,
  recipient: string,
  invitationUrl: string,
  transport: typeof fetch = fetch,
): Promise<EmailStatus> {
  if (!config.RESEND_API_KEY || !config.INVITATION_FROM) return 'not_configured';
  try {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.INVITATION_FROM,
        to: [recipient],
        subject: 'Your XQtiv Search Operations invitation',
        text: `You have been invited to XQtiv Search Operations.\n\nOpen this private link to choose your password and join:\n${invitationUrl}\n\nThis link can be used once and expires in seven days. If you already have an account, use your existing password.\n\nIf you were not expecting this invitation, you can ignore this email.`,
      }),
    });
    if (!response.ok) return 'unconfirmed';
    const result = await response.json() as {id?: unknown};
    return typeof result.id === 'string' && result.id.length > 0 ? 'accepted' : 'unconfirmed';
  } catch {
    return 'unconfirmed';
  }
}
