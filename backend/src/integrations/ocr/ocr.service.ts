import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import {
  ParsedPanResult,
  ParsedAadhaarResult,
  PanOcrResult,
  ChequeOcrResponse,
} from './ocr.types';
import { googleVisionService } from './google-vision.service';
import { parsePanText } from './pan-parser.util';

export class OcrService {
  private panUrl = process.env.OCR_PAN_API_URL!;
  private ocrKey = process.env.OCR_API_KEY!;
  private gridlinesBaseUrl = process.env.GRIDLINES_BASE_URL!;
  private gridlinesApiKey = process.env.GRIDLINES_API_KEY!;

  private finanalyzOcrUrl =
    process.env.FINANALYZ_PAN_OCR_URL ??
    'https://aasandbox.finanalyz.com/eKyc/PanOCR';
  private finanalyzKey = process.env.FINANALYZ_X_API_KEY ?? '';

  // ---------------------------------------------------
  // 🔍 PAN OCR (Google Vision → Finanalyz fallback)
  // ⚠️ FUNCTION NAME UNCHANGED
  // ---------------------------------------------------
  async extractPanFromImage(
    imageBase64OrFile: string | Express.Multer.File,
  ): Promise<PanOcrResult> {
    if (!imageBase64OrFile) {
      throw new Error('Image input is required');
    }

    let imageBuffer: Buffer;

    // 🔁 Support existing base64 usage + new file usage
    if (typeof imageBase64OrFile === 'string') {
      imageBuffer = Buffer.from(imageBase64OrFile, 'base64');
    } else if (imageBase64OrFile.buffer) {
      imageBuffer = imageBase64OrFile.buffer;
    } else if (imageBase64OrFile.path) {
      imageBuffer = await fs.promises.readFile(imageBase64OrFile.path);
    } else {
      throw new Error('Invalid image input');
    }

    // ---------------------------
    // 1️⃣ Google Vision OCR
    // ---------------------------
    try {
      const lines = await googleVisionService.extractTextFromImage(imageBuffer);

      if (lines?.length) {
        const fullText = lines.join('\n').toLowerCase();
        const isPaymentDoc =
          fullText.includes('payment') ||
          fullText.includes('paytm') ||
          fullText.includes('upi');

        const parsed = parsePanText(lines);

        if (parsed.panNumber && !isPaymentDoc) {
          return {
            pan: parsed.panNumber,
            name: parsed.name,
            raw: {
              provider: 'GOOGLE_VISION',
              lines,
              name: parsed.name,
              dob: parsed.dob,
              fatherName: parsed.fatherName,
            },
          };
        }
      }
    } catch (_) {
      // silent fallback
    }

    // ---------------------------
    // 2️⃣ Finanalyz fallback
    // ---------------------------
    if (!this.finanalyzKey) {
      throw new Error('Finanalyz OCR not configured');
    }

    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'pan.jpg' });

    const { data } = await axios.post(this.finanalyzOcrUrl, form, {
      headers: {
        ...form.getHeaders(),
        accept: '*/*',
        XApiKey: this.finanalyzKey,
      },
      validateStatus: () => true,
    });

    return {
      pan: data?.data?.pan_number ?? null,
      name: data?.data?.name ?? data?.data?.response?.name ?? null,
      raw: {
        provider: 'FINANALYZ',
        data,
      },
    };
  }

  // ---------------------------------------------------
  // 🔎 PAN TEXT PARSING (UNCHANGED)
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
  // 🔎 AADHAAR TEXT PARSING (UNCHANGED)
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
  // 🧾 CHEQUE OCR (UNCHANGED)
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
