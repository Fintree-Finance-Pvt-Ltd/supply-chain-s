import { AppDataSource } from '../config/database';
import { Document, Customer } from '../entities';
import { Repository } from 'typeorm';

export class DocumentService {
  private documentRepository: Repository<Document>;
  private customerRepository: Repository<Customer>;

  constructor() {
    this.documentRepository = AppDataSource.getRepository(Document);
    this.customerRepository = AppDataSource.getRepository(Customer);
  }

  async uploadDocument(data: {
    customerId: number;
    documentType: string;
    applicantType?: string;
    applicantIndex?: number;
    fileName: string;
    filePath: string;
    mimeType?: string;
    fileSize?: number;
    uploadedBy: number;
  }): Promise<Document> {
    // Verify customer exists
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const document = this.documentRepository.create(data);
    return await this.documentRepository.save(document);
  }

  async getDocumentsByCustomer(customerId: number): Promise<Document[]> {
    return await this.documentRepository.find({
      where: { customerId },
      relations: ['uploadedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async getDocumentById(id: number): Promise<Document | null> {
    return await this.documentRepository.findOne({
      where: { id },
      relations: ['customer', 'uploadedByUser'],
    });
  }

  async verifyDocument(
    id: number,
    verifiedBy: number,
    remarks?: string
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    document.verified = true;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();
    if (remarks !== undefined) {
      document.remarks = remarks;
    }

    return await this.documentRepository.save(document);
  }

  async deleteDocument(id: number): Promise<void> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    await this.documentRepository.remove(document);
  }
}



