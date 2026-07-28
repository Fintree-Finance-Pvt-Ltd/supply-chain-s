import { AppDataSource } from '../config/database';
import { Document, Customer } from '../entities';
import { Repository } from 'typeorm';
import { normalizePagination, PaginationOptions } from '../utils/pagination';

export interface DocumentListItem {
  id: number;
  customerId: number;
  applicantId: number | null;
  coApplicantId: number | null;
  applicantType: string;
  applicantIndex: number;
  documentType: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedBy: number;
  uploadedByUser: {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    defaultRole: string | null;
  } | null;
  verified: boolean;
  status: string;
  verifiedBy: number | null;
  verifiedAt: Date | null;
  remarks: string | null;
  rmRemarks: string | null;
  lender: string | null;
  renewalCycleId: number | null;
  isCarriedForward: boolean;
  carriedForwardFromDocumentId: number | null;
  documentLabel: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDocuments {
  data: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
}

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
    lender?: string;
    renewalCycleId?: number;
    isCarriedForward?: boolean;
    carriedForwardFromDocumentId?: number;
    documentLabel?: string;
  }): Promise<Document> {
    // Verify customer exists
    const customer = await this.customerRepository.findOne({
      where: { id: data.customerId },
      select: { id: true },
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

  async getDocumentsByCustomer(
    customerId: number,
    pagination?: PaginationOptions,
  ): Promise<PaginatedDocuments> {
    const { page, limit, skip } = normalizePagination(pagination);
    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoin('document.uploadedByUser', 'uploadedByUser')
      .select([
        'document.id',
        'document.customerId',
        'document.applicantId',
        'document.coApplicantId',
        'document.documentType',
        'document.fileName',
        'document.filePath',
        'document.mimeType',
        'document.fileSize',
        'document.uploadedBy',
        'document.verified',
        'document.status',
        'document.verifiedBy',
        'document.verifiedAt',
        'document.remarks',
        'document.rmRemarks',
        'document.lender',
        'document.renewalCycleId',
        'document.isCarriedForward',
        'document.carriedForwardFromDocumentId',
        'document.documentLabel',
        'document.issueDate',
        'document.expiryDate',
        'document.createdAt',
        'document.updatedAt',
        'uploadedByUser.id',
        'uploadedByUser.name',
        'uploadedByUser.email',
        'uploadedByUser.mobile',
        'uploadedByUser.defaultRole',
      ])
      .where('document.customerId = :customerId', { customerId })
      .orderBy('document.createdAt', 'DESC')
      // .skip(skip)
      // .take(limit);

    const [documents, total] = await queryBuilder.getManyAndCount();

    return {
      data: documents.map((document) => ({
        id: document.id,
        customerId: document.customerId,
        applicantId: document.applicantId,
        coApplicantId: document.coApplicantId,
        applicantType: document.coApplicantId ? 'co-applicant' : 'applicant',
        applicantIndex: document.coApplicantId ? 1 : 0,
        documentType: document.documentType,
        fileName: document.fileName,
        filePath: document.filePath,
        mimeType: document.mimeType || null,
        fileSize: document.fileSize || null,
        uploadedBy: document.uploadedBy,
        uploadedByUser: document.uploadedByUser?.id
          ? {
              id: document.uploadedByUser.id,
              name: document.uploadedByUser.name,
              email: document.uploadedByUser.email,
              mobile: document.uploadedByUser.mobile || null,
              defaultRole: document.uploadedByUser.defaultRole || null,
            }
          : null,
        verified: document.verified,
        status: document.status,
        verifiedBy: document.verifiedBy,
        verifiedAt: document.verifiedAt || null,
        remarks: document.remarks || null,
        rmRemarks: document.rmRemarks || null,
        lender: document.lender || null,
        renewalCycleId: document.renewalCycleId || null,
        isCarriedForward: Boolean(document.isCarriedForward),
        carriedForwardFromDocumentId: document.carriedForwardFromDocumentId || null,
        documentLabel: document.documentLabel || null,
        issueDate: document.issueDate || null,
        expiryDate: document.expiryDate || null,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getDocumentById(id: number): Promise<Document | null> {
    return await this.documentRepository.findOne({
      where: { id },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        mimeType: true,
      },
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
      lender?: string | null;
      renewalCycleId?: number | null;
      isCarriedForward?: boolean;
      carriedForwardFromDocumentId?: number | null;
      documentLabel?: string | null;
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
    if (data.lender !== undefined) document.lender = data.lender;
    if (data.renewalCycleId !== undefined) document.renewalCycleId = data.renewalCycleId;
    if (data.isCarriedForward !== undefined) document.isCarriedForward = data.isCarriedForward;
    if (data.carriedForwardFromDocumentId !== undefined) document.carriedForwardFromDocumentId = data.carriedForwardFromDocumentId;
    if (data.documentLabel !== undefined) document.documentLabel = data.documentLabel;

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


