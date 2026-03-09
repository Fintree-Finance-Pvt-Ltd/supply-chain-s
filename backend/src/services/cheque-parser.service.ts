import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export interface ChequeOcrResult {
  bank_account_number: string;
  ifsc_code: string;
  bank_name: string;
  account_holder_name: string;
  micr_code?: string;
  cheque_number?: string;
  raw_response?: any;
  quality_check?: {
    is_complete_image: string;
    message?: string;
  };
}

export class ChequeParserService {
  private ocrApiUrl: string;
  private ocrApiKey: string;

  constructor() {
    this.ocrApiUrl = process.env.CHEQUE_OCR_API_URL || 'https://sandbox.fintreelms.com/ocr/v1/cheque';
    this.ocrApiKey = process.env.CHEQUE_OCR_API_KEY || '';
  }

  /**
   * Extract bank details from cheque image using external OCR API
   * @param file - Multer file object containing buffer or path
   * @param accountHolderName - Optional account holder name for API
   */
  async extractBankDetailsFromCheque(file: Express.Multer.File, accountHolderName?: string): Promise<ChequeOcrResult> {
    try {
      let fileBuffer: Buffer;
      let fileName: string;

      // Use buffer if available (from multer memory storage), otherwise read from disk
      if (file.buffer && file.buffer.length > 0) {
        fileBuffer = file.buffer;
        fileName = file.originalname;
      } else if (file.path) {
        // Read from disk
        fileBuffer = await fs.promises.readFile(file.path);
        fileName = file.originalname;
      } else {
        throw new Error('No file data available');
      }

      // Generate client reference ID
      const clientRefId = `SUPPLIER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('imageUrl', fileBuffer, {
        filename: fileName,
        contentType: file.mimetype || this.getContentType(fileName),
      });
      
      // Add required fields
      formData.append('clientRefId', clientRefId);
      if (accountHolderName) {
        formData.append('accountHolderName', accountHolderName);
      }

      // Make API call to external OCR service
      const headers: any = {
        ...formData.getHeaders(),
        'Accept': 'application/json',
      };

      // Add API key if available
      if (this.ocrApiKey) {
        headers['X-API-Key'] = this.ocrApiKey;
      }

      console.log('Calling OCR API:', this.ocrApiUrl);
      console.log('Client Ref ID:', clientRefId);
      
      const response = await axios.post(this.ocrApiUrl, formData, {
        headers,
        timeout: 30000, // 30 seconds timeout
        validateStatus: () => true, // Don't throw on non-2xx status
      });

      console.log('OCR API Response:', JSON.stringify(response.data));

      // Parse the OCR response
      return this.parseOcrResponse(response.data);
    } catch (error: any) {
      console.error('Cheque OCR API Error:', error.message);
      
      // Return a result that indicates manual entry is needed
      return {
        bank_account_number: '',
        ifsc_code: '',
        bank_name: '',
        account_holder_name: '',
        micr_code: '',
        cheque_number: '',
        raw_response: { error: error.message },
        quality_check: { is_complete_image: 'no' },
      };
    }
  }

  /**
   * Parse OCR API response and extract bank details
   */
  private parseOcrResponse(response: any): ChequeOcrResult {
    // Check if the API call was successful
    if (!response.success) {
      console.error('OCR API returned unsuccessful response:', response.message);
      return {
        bank_account_number: '',
        ifsc_code: '',
        bank_name: '',
        account_holder_name: '',
        micr_code: '',
        cheque_number: '',
        raw_response: response,
        quality_check: { is_complete_image: 'no' },
      };
    }

    // Navigate to the details - handle different response structures
    const resultData = response?.data?.result?.[0];
    const details = resultData?.details;
    
    if (!details) {
      console.error('No details found in OCR response:', JSON.stringify(response));
      return {
        bank_account_number: '',
        ifsc_code: '',
        bank_name: '',
        account_holder_name: '',
        micr_code: '',
        cheque_number: '',
        raw_response: response,
        quality_check: { is_complete_image: 'no' },
      };
    }

    // Check image quality
    const qualityCheck = resultData?.qualityCheck;
    const isCompleteImage = qualityCheck?.isCompleteImage?.value || qualityCheck?.is_complete_image?.value || 'no';

    // Extract values from the OCR response
    return {
      bank_account_number: details.account_number?.value || '',
      ifsc_code: details.ifsc_code?.value || '',
      bank_name: details.bank_name?.value || '',
      account_holder_name: details.name?.value || '',
      micr_code: details.micr_code?.value || '',
      cheque_number: details.cheque_number?.value || '',
      raw_response: response,
      quality_check: {
        is_complete_image: isCompleteImage,
        message: isCompleteImage !== 'yes' ? 'Please upload a clear cheque image' : undefined,
      },
    };
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}
