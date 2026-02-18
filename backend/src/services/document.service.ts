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
    applicantId?: number;
    coApplicantId?: number;
    fileName: string;
    filePath: string;
    mimeType?: string;
    fileSize?: number;
    uploadedBy: number;
    issueDate?: Date;
    expiryDate?: Date;
    remarks?: string;
    rmRemarks?: string;
  }): Promise<Document> {
    // Verify customer exists
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const payload: any = { ...data };
    // ensure explicit nulls for optional ids if undefined
    if (payload.applicantId === undefined) payload.applicantId = null;
    if (payload.coApplicantId === undefined) payload.coApplicantId = null;

    const document = this.documentRepository.create(payload);
    return (await this.documentRepository.save(document)) as unknown as Document;
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
    remarks?: string,
    status: string = 'approved'
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    document.verified = status === 'approved';
    document.status = status;
    document.verifiedBy = verifiedBy;
    document.verifiedAt = new Date();
    if (remarks !== undefined) {
      document.remarks = remarks;
    }

    return await this.documentRepository.save(document);
  }

  async updateMetadata(
    id: number,
    data: {
      issueDate?: Date;
      expiryDate?: Date;
      remarks?: string;
      rmRemarks?: string;
      documentType?: string;
    }
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });

    if (!document) {
      throw new Error('Document not found');
    }

    if (data.issueDate !== undefined) document.issueDate = data.issueDate;
    if (data.expiryDate !== undefined) document.expiryDate = data.expiryDate;
    if (data.remarks !== undefined) document.remarks = data.remarks;
    if (data.rmRemarks !== undefined) document.rmRemarks = data.rmRemarks;
    if (data.documentType !== undefined) document.documentType = data.documentType;

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



