import axios from 'axios';
import FormData from 'form-data';
import { ParsedPanResult, ParsedAadhaarResult, PanOcrResult, ChequeOcrResponse } from './ocr.types';

export class OcrService {
  private panUrl = process.env.OCR_PAN_API_URL!;
  private ocrKey = process.env.OCR_API_KEY!;
  private gridlinesBaseUrl = process.env.GRIDLINES_BASE_URL!;
  private gridlinesApiKey = process.env.GRIDLINES_API_KEY!;

  // ---------------------------------------------------
  // 🔍 PAN OCR (API)
  // ---------------------------------------------------
  async extractPanFromImage(imageBase64: string): Promise<PanOcrResult> {
    if (!imageBase64) {
      throw new Error('Image base64 is required');
    }

    const { data } = await axios.post(
      this.panUrl,
      { image: imageBase64 },
      {
        headers: { 'x-api-key': this.ocrKey },
        validateStatus: () => true,
      },
    );

    return {
      pan: data?.panNumber,
      raw: data,
    };
  }

  // ---------------------------------------------------
  // 🔎 PAN TEXT PARSING
  // ---------------------------------------------------
  async parsePanFromOcr(text: string): Promise<ParsedPanResult> {
    const panRegex = /[A-Z]{5}\d{4}[A-Z]{1}/;
    const panMatch = text.match(panRegex);
    const panNumber = panMatch ? panMatch[0] : null;

    const nameRegex = /(?:Name|Holder)[:\s]*([A-Z\s]+)/i;
    const nameMatch = text.match(nameRegex);
    const name = nameMatch ? nameMatch[1].trim() : null;

    if (!panNumber) {
      throw new Error('PAN not found in OCR text');
    }

    return { panNumber, name };
  }

  // ---------------------------------------------------
  // 🔎 AADHAAR TEXT PARSING
  // ---------------------------------------------------
  async parseAadhaarFromOcr(text: string): Promise<ParsedAadhaarResult> {
    const aadhaarRegex = /\b\d{12}\b/;
    const aadhaarMatch = text.match(aadhaarRegex);
    const aadhaarNumber = aadhaarMatch ? aadhaarMatch[0] : null;

    const nameRegex = /(?:Name|Applicant)[:\s]*([A-Z\s]+)/i;
    const nameMatch = text.match(nameRegex);
    const name = nameMatch ? nameMatch[1].trim() : null;

    if (!aadhaarNumber) {
      throw new Error('Aadhaar not found in OCR text');
    }

    return { aadhaarNumber, name };
  }

  // ---------------------------------------------------
  // 🧾 CHEQUE OCR (GRIDLINES)
  // ---------------------------------------------------
  async extractChequeData(
    file: Express.Multer.File,
    referenceId?: string,
  ): Promise<ChequeOcrResponse> {
    if (!file) {
      throw new Error('Cheque file is required');
    }

    const formData = new FormData();
    formData.append('file_front', file.buffer, file.originalname);
    formData.append('consent', 'Y');

    const { data } = await axios.post(
      `${this.gridlinesBaseUrl}/bank-api/cheque/ocr`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'X-API-Key': this.gridlinesApiKey,
          'X-Auth-Type': 'API-Key',
          'X-Reference-ID': referenceId ?? '',
          Accept: 'application/json',
        },
        maxBodyLength: Infinity,
        validateStatus: () => true,
      },
    );

    return data;
  }
}
