export interface EmailProvider {
  sendEmail(to: string, subject: string, html: string, text?: string): Promise<void>;
}
