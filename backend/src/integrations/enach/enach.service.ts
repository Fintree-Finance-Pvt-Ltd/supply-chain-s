import { DigioClient } from './digio.client';
import {
  normalizeAccountType,
  pennyAmount,
  mapWebhookEvent,
} from './enach.utils';
import { BankVerificationResult, EnachMandateResult } from './enach.types';

export class EnachService {
  constructor(private readonly digio: DigioClient) {}

  // ---------------------------------------------------
  // 🏦 Bank verification (penny drop)
  // ---------------------------------------------------
  async verifyBank(input: {
    accountNo: string;
    ifsc: string;
    name: string;
  }): Promise<BankVerificationResult> {
    const resp = await this.digio.verifyBankAccount({
      beneficiary_account_no: input.accountNo,
      beneficiary_ifsc: input.ifsc,
      beneficiary_name: input.name,
      amount: pennyAmount(),
    });

    return {
      verified: !!resp?.verified,
      providerId: resp?.id,
      fuzzyMatchScore: resp?.fuzzy_match_score ?? null,
      raw: resp,
    };
  }

  // ---------------------------------------------------
  // 🧾 Create eNACH mandate
  // ---------------------------------------------------
  async createMandate(input: {
    customerIdentifier: string;
    amount: number;
    startDate: string;
    frequency?: string;
    bank: {
      accountNumber: string;
      accountType?: string;
      ifsc: string;
      bankName: string;
      nameInBank: string;
    };
    refNumber: string;
  }): Promise<EnachMandateResult> {
    const payload = {
      customer_identifier: input.customerIdentifier,
      auth_mode: 'api',
      mandate_type: 'create',
      corporate_config_id: process.env.DIGIO_CORPORATE_CONFIG_ID,
      notify_customer: true,
      include_authentication_url: true,
      mandate_data: {
        collection_amount: input.amount,
        instrument_type: 'debit',
        first_collection_date: input.startDate,
        is_recurring: true,
        frequency: input.frequency ?? 'Monthly',
        name_in_bank: input.bank.nameInBank,
        customer_account_number: input.bank.accountNumber,
        customer_account_type: normalizeAccountType(input.bank.accountType),
        destination_bank_id: input.bank.ifsc,
        destination_bank_name: input.bank.bankName,
        customer_ref_number: input.refNumber,
        scheme_ref_number: input.refNumber,
      },
    };

    const resp = await this.digio.createMandateForm(payload);

    return {
      documentId: resp.id,
      status: resp.state,
      authUrl: resp.authentication_url || resp.url || null,
      raw: resp,
    };
  }

  // ---------------------------------------------------
  // 🔔 Webhook parser (NO DB)
  // ---------------------------------------------------
  parseWebhook(body: any) {
    const mandate =
      body?.payload?.mandate ??
      body?.payload?.api_mandate ??
      body?.mandate ??
      null;

    if (!mandate?.id) return null;

    return {
      mandateId: mandate.id,
      status: mapWebhookEvent(body?.event ?? ''),
      umrn: mandate.umrn ?? null,
      raw: mandate,
    };
  }
}
