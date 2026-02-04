import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';

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

      const { customerId, documentType } = req.body;

      if (!customerId || !documentType) {
        res.status(400).json({
          success: false,
          message: 'customerId and documentType are required',
        });
        return;
      }

      const document = await this.documentService.uploadDocument({
        customerId: Number(customerId),
        documentType,
        fileName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.userId!,
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

  getDocumentsByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const documents = await this.documentService.getDocumentsByCustomer(Number(customerId));

      res.json({
        success: true,
        data: documents,
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
}


