import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';
import { AppDataSource } from '../config/database';
import { Applicant } from '../entities/Applicant';
import { CoApplicant } from '../entities/CoApplicant';
import * as path from 'path';
import * as fs from 'fs';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      console.log('--- Upload Document Debug ---');
      console.log('Raw Body:', req.body);
      console.log('File:', req.file ? req.file.originalname : 'None');

      const { customerId, documentType, applicantType, applicantIndex, coApplicantId, issueDate, expiryDate, remarks, rmRemarks } = req.body;

      // Resolve applicantId when applicantType is 'applicant'
      let resolvedApplicantId: number | undefined = undefined;
      let resolvedCoApplicantId: number | undefined = undefined;
      let effectiveDocumentType = documentType;

      try {
        if (applicantType === 'applicant') {
          const applicantRepo = AppDataSource.getRepository(Applicant);
          const applicant = await applicantRepo.findOne({ where: { customerId: Number(customerId) } });
          if (applicant) resolvedApplicantId = applicant.id;

          // normalize documentType for applicant
          if (documentType === 'pan') effectiveDocumentType = 'applicant_pan';
          else if (documentType === 'gst_certificate') effectiveDocumentType = 'applicant_gst';
        }

        if (coApplicantId) {
          const coApplicantRepo = AppDataSource.getRepository(CoApplicant);
          const coApp = await coApplicantRepo.findOne({ where: { id: Number(coApplicantId), customerId: Number(customerId) } });
          if (coApp) resolvedCoApplicantId = coApp.id;

          // normalize documentType for co-applicant
          if (documentType === 'pan') effectiveDocumentType = 'coapplicant_pan';
        }
      } catch (e) {
        // if resolution fails, proceed without applicant/co-applicant linkage
        console.error('Applicant/co-applicant resolution failed', e);
      }

      // Robust parsing
      const parsedIssueDate = (issueDate && typeof issueDate === 'string' && issueDate.trim() !== '') ? new Date(issueDate) : undefined;
      const parsedExpiryDate = (expiryDate && typeof expiryDate === 'string' && expiryDate.trim() !== '') ? new Date(expiryDate) : undefined;
      const parsedRemarks = (remarks && typeof remarks === 'string' && remarks.trim() !== '') ? remarks : undefined;
      const parsedRmRemarks = (rmRemarks && typeof rmRemarks === 'string' && rmRemarks.trim() !== '') ? rmRemarks : undefined;

      if (!customerId || !documentType) {
        res.status(400).json({
          success: false,
          message: 'customerId and documentType are required',
        });
        return;
      }

      const document = await this.documentService.uploadDocument({
        customerId: Number(customerId),
        documentType: effectiveDocumentType,
        applicantType: applicantType || 'applicant',
        applicantIndex: applicantIndex !== undefined ? Number(applicantIndex) : 0,
        coApplicantId: resolvedCoApplicantId ?? (coApplicantId ? Number(coApplicantId) : undefined),
        applicantId: resolvedApplicantId,
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.userId!,
        issueDate: parsedIssueDate,
        expiryDate: parsedExpiryDate,
        remarks: parsedRemarks,
        rmRemarks: parsedRmRemarks,
      });

      res.status(201).json({
        success: true,
        data: document,
        message: 'Document uploaded successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload document',
      });
    }
  };

  updateMetadata = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { issueDate, expiryDate, remarks, rmRemarks, documentType } = req.body;

      const parsedIssueDate = (issueDate && typeof issueDate === 'string' && issueDate.trim() !== '') ? new Date(issueDate) : undefined;
      const parsedExpiryDate = (expiryDate && typeof expiryDate === 'string' && expiryDate.trim() !== '') ? new Date(expiryDate) : undefined;
      const parsedRemarks = (remarks && typeof remarks === 'string' && remarks.trim() !== '') ? remarks : undefined;

      const document = await this.documentService.updateMetadata(Number(id), {
        issueDate: parsedIssueDate,
        expiryDate: parsedExpiryDate,
        remarks: parsedRemarks,
        rmRemarks: rmRemarks,
        documentType: documentType
      });

      res.json({
        success: true,
        data: document,
        message: 'Metadata updated successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update metadata',
      });
    }
  };

  getDocumentsByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.customerId || req.params.id);
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const documents = await this.documentService.getDocumentsByCustomer(customerId, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: documents.data,
        meta: {
          page: documents.page,
          limit: documents.limit,
          total: documents.total,
          totalPages: Math.ceil(documents.total / documents.limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch documents',
      });
    }
  };

  verifyDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { remarks } = req.body;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const document = await this.documentService.verifyDocument(
        Number(id),
        req.userId!,
        remarks
      );

      res.json({
        success: true,
        data: document,
        message: 'Document verified successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to verify document',
      });
    }
  };

  deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.documentService.deleteDocument(Number(id));

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete document',
      });
    }
  };

downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const mode = (req.query.mode as string) || 'inline';

    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const document = await this.documentService.getDocumentById(Number(id));

    if (!document) {
      res.status(404).json({
        success: false,
        message: 'Document not found',
      });
      return;
    }

    // Resolve file path directly
    const absolutePath = path.resolve(process.cwd(), document.filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error('File not found at:', absolutePath);

      res.status(404).json({
        success: false,
        message: 'File not found on server',
      });
      return;
    }

    // Set headers
    res.setHeader(
      'Content-Type',
      document.mimeType || 'application/octet-stream'
    );

    if (mode === 'attachment') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.fileName}"`
      );
    } else {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.fileName}"`
      );
    }

    // Stream file
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Download document error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download document',
    });
  }
};
}
