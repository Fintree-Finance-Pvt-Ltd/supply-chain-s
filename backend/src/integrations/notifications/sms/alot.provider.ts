import axios from 'axios';
import { SmsProvider } from './sms.provider';

export class AlotSmsProvider implements SmsProvider {
  constructor(private readonly config: {
    apiUrl: string;
    user: string;
    password: string;
    senderId: string;
    route: string;
    templateId: string;
    peid: string;
  }) {}

  async sendSms(to: string, message: string): Promise<void> {
    const { data } = await axios.get(this.config.apiUrl, {
      params: {
        user: this.config.user,
        password: this.config.password,
        senderid: this.config.senderId,
        channel: 'TRANS',
        DCS: '0',
        flashsms: '0',
        number: to,
        text: message,
        route: this.config.route,
        DLTTemplateId: this.config.templateId,
        PEID: this.config.peid,
      },
      timeout: 10000,
    });

    const success = data?.ErrorCode === '0' || typeof data?.JobId === 'string';
    if (!success) {
      throw new Error('ALot SMS failed');
    }
  }
}
