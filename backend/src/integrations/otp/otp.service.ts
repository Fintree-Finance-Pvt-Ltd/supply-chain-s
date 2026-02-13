import { generateOtp } from './generators';
import { OtpConfig, OtpSessionData } from './otp.types';

export class OtpService {
  private readonly config: OtpConfig;

  constructor(config?: Partial<OtpConfig>) {
    this.config = {
      expirySeconds: 300,
      maxAttempts: 3,
      resendCooldownSeconds: 10,
      ...config,
    };
  }

  createOtp(): OtpSessionData {
    const otp = generateOtp();

    return {
      otp,
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.expirySeconds * 1000),
    };
  }

  canResend(lastSentAt: Date): boolean {
    return (
      Date.now() - lastSentAt.getTime() >=
      this.config.resendCooldownSeconds * 1000
    );
  }

  verifyOtp(session: OtpSessionData, inputOtp: string): boolean {
    if (new Date() > session.expiresAt) {
      throw new Error('OTP expired');
    }

    if (session.attempts >= this.config.maxAttempts) {
      throw new Error('Maximum attempts exceeded');
    }

    session.attempts++;

    if (session.otp !== inputOtp) {
      throw new Error('Invalid OTP');
    }

    return true;
  }
}
