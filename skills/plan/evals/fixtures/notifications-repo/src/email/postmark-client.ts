interface EmailMessage {
  to: string;
  subject: string;
  htmlBody: string;
}

/**
 * PostmarkClient — thin wrapper over the Postmark HTTP API for transactional email.
 * Already in use for password-reset and receipt emails.
 */
export class PostmarkClient {
  constructor(private readonly serverToken: string) {}

  async send(message: EmailMessage): Promise<void> {
    // Stub: POSTs to https://api.postmarkapp.com/email for fixture purposes.
    console.log(`sending email to ${message.to}: ${message.subject}`);
  }
}
