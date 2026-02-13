export interface OtpConfig {
  expirySeconds: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
}

export interface SendOtpOptions {
  channel: 'SMS' | 'EMAIL';
  destination: string;
}

export interface OtpSessionData {
  otp: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
}
