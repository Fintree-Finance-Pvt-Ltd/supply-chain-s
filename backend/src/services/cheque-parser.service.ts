export class ChequeParserService {
  /**
   * TODO: Replace with real cheque OCR integration.
   * For now returning sample mapping (as per your requirement).
   */
  async extractBankDetailsFromCheque(_filePath: string) {
    return {
      bank_account_number: '123356099012',
      ifsc_code: 'HDFC0001234',
      bank_name: 'HDFC Bank',
      account_holder_name: 'ABC Suppliers Pvt Ltd',
    };
  }
}