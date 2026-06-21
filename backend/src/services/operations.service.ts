import { AppDataSource } from '../config/database';
import {
  OperationsCheck,
  Customer,
  RepaymentUpload,
  REPAYMENT_UPLOAD_STATUS,
  LoanAccount,
  Partner,
  Supplier,
  SupplierBankDetail,
  CaseWorkflow,
  CaseStatusHistory,
  CreditSanction,
  Applicant,
  KycDetail,
  CustomerAddress,
  CoApplicant,
  LanSequence,
  PARTNER_STATUS,
} from '../entities';
import { EntityManager, In, Repository } from 'typeorm';
import { ApprovalService } from './approval.service';
import { ADDRESS_TYPES, CASE_STATUS, COMPANY_TYPES, KYC_TYPES } from '../config/constants';
import { internalLmsService } from './internal-lms.service';
import axios from 'axios';
import path from 'path';
import * as yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';

export interface RepaymentRecord {
  lan: string;
  collection_date: string;
  collection_utr: string;
  collection_amount: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface UploadResult {
  success: boolean;
  message: string;
  results?: {
    lan: string;
    collectionUtr: string;
    status: string;
    errorMessage?: string;
  }[];
}

interface ExcelRow {
  __rowNumber: number;
  [key: string]: string | number;
}

interface MigrationRowResult {
  rowNumber: number;
  reference: string;
  name: string;
  localStatus: 'SAVED' | 'FAILED';
  lmsStatus: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  message?: string;
  localId?: number;
}

interface MigrationUploadResult {
  success: boolean;
  message: string;
  summary: {
    totalRows: number;
    localSaved: number;
    lmsSent: number;
    failed: number;
  };
  results: MigrationRowResult[];
}

export class OperationsService {
  private operationsCheckRepository: Repository<OperationsCheck>;
  private customerRepository: Repository<Customer>;
  private repaymentUploadRepository: Repository<RepaymentUpload>;
  private loanAccountRepository: Repository<LoanAccount>;
  private partnerRepository: Repository<Partner>;
  private supplierRepository: Repository<Supplier>;
  private supplierBankRepository: Repository<SupplierBankDetail>;
  private workflowRepository: Repository<CaseWorkflow>;
  private historyRepository: Repository<CaseStatusHistory>;
  private sanctionRepository: Repository<CreditSanction>;
  private applicantRepository: Repository<Applicant>;
  private coApplicantRepository: Repository<CoApplicant>;
  private kycDetailRepository: Repository<KycDetail>;
  private customerAddressRepository: Repository<CustomerAddress>;
  private approvalService: ApprovalService;

  constructor() {
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.repaymentUploadRepository = AppDataSource.getRepository(RepaymentUpload);
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
    this.partnerRepository = AppDataSource.getRepository(Partner);
    this.supplierRepository = AppDataSource.getRepository(Supplier);
    this.supplierBankRepository = AppDataSource.getRepository(SupplierBankDetail);
    this.workflowRepository = AppDataSource.getRepository(CaseWorkflow);
    this.historyRepository = AppDataSource.getRepository(CaseStatusHistory);
    this.sanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.applicantRepository = AppDataSource.getRepository(Applicant);
    this.coApplicantRepository = AppDataSource.getRepository(CoApplicant);
    this.kycDetailRepository = AppDataSource.getRepository(KycDetail);
    this.customerAddressRepository = AppDataSource.getRepository(CustomerAddress);
    this.approvalService = new ApprovalService();
  }

  private asArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private normalizeHeader(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/%/g, ' percentage ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private getCell(row: ExcelRow, aliases: string[]): string {
    for (const alias of aliases) {
      const key = this.normalizeHeader(alias);
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private toNumber(value: string): number | null {
    if (!value) return null;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getSharedText(node: any): string {
    if (node === undefined || node === null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map((item) => this.getSharedText(item)).join('');
    if (typeof node === 'object') {
      if (node.t !== undefined) return this.getSharedText(node.t);
      if (node.r !== undefined) return this.getSharedText(node.r);
    }
    return '';
  }

  private getCellColumnIndex(cellRef: string): number {
    const letters = String(cellRef || '').replace(/[0-9]/g, '').toUpperCase();
    let index = 0;
    for (const letter of letters) {
      index = index * 26 + (letter.charCodeAt(0) - 64);
    }
    return Math.max(index - 1, 0);
  }

  private async readZipXmlEntries(filePath: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      const entries: Record<string, string> = {};

      yauzl.open(filePath, { lazyEntries: true }, (openError, zipfile) => {
        if (openError || !zipfile) {
          reject(openError || new Error('Unable to open Excel file'));
          return;
        }

        zipfile.readEntry();

        zipfile.on('entry', (entry: yauzl.Entry) => {
          const shouldRead =
            !entry.fileName.endsWith('/') &&
            (entry.fileName.endsWith('.xml') || entry.fileName.endsWith('.rels'));

          if (!shouldRead) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              zipfile.close();
              reject(streamError || new Error(`Unable to read ${entry.fileName}`));
              return;
            }

            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => {
              entries[entry.fileName] = Buffer.concat(chunks).toString('utf8');
              zipfile.readEntry();
            });
            stream.on('error', (error) => {
              zipfile.close();
              reject(error);
            });
          });
        });

        zipfile.on('end', () => resolve(entries));
        zipfile.on('error', reject);
      });
    });
  }

  private getFirstWorksheetXml(entries: Record<string, string>, parser: XMLParser): string {
    const workbookXml = entries['xl/workbook.xml'];
    const workbookRelsXml = entries['xl/_rels/workbook.xml.rels'];

    if (workbookXml && workbookRelsXml) {
      const workbook = parser.parse(workbookXml);
      const relationships = parser.parse(workbookRelsXml);
      const firstSheet = this.asArray<any>(workbook?.workbook?.sheets?.sheet)[0];
      const relationId = firstSheet?.['@_r:id'] || firstSheet?.['@_id'];
      const relation = this
        .asArray<any>(relationships?.Relationships?.Relationship)
        .find((item) => item?.['@_Id'] === relationId);

      if (relation?.['@_Target']) {
        const target = String(relation['@_Target']).replace(/^\/+/, '');
        const normalizedTarget = target.startsWith('xl/') ? target : `xl/${target}`;
        if (entries[normalizedTarget]) return entries[normalizedTarget];
      }
    }

    const fallbackSheet = Object.keys(entries).find((key) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(key)
    );

    if (!fallbackSheet) {
      throw new Error('Excel workbook does not contain a worksheet');
    }

    return entries[fallbackSheet];
  }

  private parseSharedStrings(entries: Record<string, string>, parser: XMLParser): string[] {
    const sharedXml = entries['xl/sharedStrings.xml'];
    if (!sharedXml) return [];

    const parsed = parser.parse(sharedXml);
    return this
      .asArray<any>(parsed?.sst?.si)
      .map((item) => this.getSharedText(item));
  }

  private getExcelCellValue(cell: any, sharedStrings: string[]): string {
    const type = cell?.['@_t'];
    const rawValue = cell?.v;

    if (type === 's') {
      const index = Number(rawValue);
      return Number.isInteger(index) ? sharedStrings[index] || '' : '';
    }

    if (type === 'inlineStr') {
      return this.getSharedText(cell?.is);
    }

    if (type === 'b') {
      return rawValue === '1' ? 'true' : 'false';
    }

    return this.getSharedText(rawValue);
  }

  private async parseXlsxRows(file: Express.Multer.File): Promise<ExcelRow[]> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx') {
      throw new Error('Please upload an .xlsx Excel file');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      trimValues: false,
      removeNSPrefix: true,
    });
    const entries = await this.readZipXmlEntries(file.path);
    const sharedStrings = this.parseSharedStrings(entries, parser);
    const worksheetXml = this.getFirstWorksheetXml(entries, parser);
    const worksheet = parser.parse(worksheetXml);

    const sheetRows = this.asArray<any>(worksheet?.worksheet?.sheetData?.row)
      .map((row, index) => {
        const values: string[] = [];
        this.asArray<any>(row?.c).forEach((cell, cellIndex) => {
          const columnIndex = cell?.['@_r']
            ? this.getCellColumnIndex(cell['@_r'])
            : cellIndex;
          values[columnIndex] = this.getExcelCellValue(cell, sharedStrings).trim();
        });

        return {
          rowNumber: Number(row?.['@_r']) || index + 1,
          values,
        };
      })
      .filter((row) => row.values.some((value) => String(value || '').trim() !== ''));

    if (sheetRows.length < 2) {
      return [];
    }

    const headerRow = sheetRows[0];
    const headers = headerRow.values.map((header) => this.normalizeHeader(header));

    return sheetRows.slice(1).reduce<ExcelRow[]>((acc, row) => {
      const hasData = row.values.some((value) => String(value || '').trim() !== '');
      if (!hasData) return acc;

      const parsedRow: ExcelRow = { __rowNumber: row.rowNumber };
      headers.forEach((header, index) => {
        if (header) parsedRow[header] = String(row.values[index] || '').trim();
      });
      acc.push(parsedRow);
      return acc;
    }, []);
  }

  private normalizeCompanyType(value: string): string | undefined {
    if (!value) return undefined;
    const normalized = this.normalizeHeader(value);
    const typeMap: Record<string, string> = {
      proprietorship: COMPANY_TYPES.PROPRIETORSHIP,
      sole_proprietorship: COMPANY_TYPES.PROPRIETORSHIP,
      partnership: COMPANY_TYPES.PARTNERSHIP,
      pvt_ltd: COMPANY_TYPES.PVT_LTD,
      pvt_ltd_ltd: COMPANY_TYPES.PVT_LTD,
      private_limited: COMPANY_TYPES.PVT_LTD,
      ltd: COMPANY_TYPES.PVT_LTD,
      llp: COMPANY_TYPES.LLP,
    };

    return typeMap[normalized] || Object.values(COMPANY_TYPES).find((type) => type === value);
  }

  private normalizeOwnership(value: string): string {
    return this.normalizeHeader(value).includes('rent') ? 'Rented' : 'Owned';
  }

  private normalizePartnerLookupValue(value: string): string {
    return this.normalizeHeader(value).replace(/_/g, '');
  }

  private async resolveMigrationPartner(manager: EntityManager, lenderType: string): Promise<Partner> {
    const normalizedInput = this.normalizePartnerLookupValue(lenderType);
    if (!normalizedInput) {
      throw new Error('lender_type is required');
    }

    const partners = await manager.getRepository(Partner).find();
    const partner = partners.find((item) => {
      const candidates = [item.name, item.code, item.lanPrefix]
        .filter(Boolean)
        .map((value) => this.normalizePartnerLookupValue(value));

      return candidates.some(
        (candidate) =>
          candidate === normalizedInput ||
          (normalizedInput.length >= 3 && candidate.includes(normalizedInput)) ||
          (candidate.length >= 3 && normalizedInput.includes(candidate)),
      );
    });

    if (!partner) {
      throw new Error(`Lender type "${lenderType}" was not found in the partners table`);
    }

    if (partner.status !== PARTNER_STATUS.ACTIVE) {
      throw new Error(`Lender type "${lenderType}" maps to inactive partner ${partner.code}`);
    }

    return partner;
  }

  private async getNextMigrationLanId(manager: EntityManager, partner: Partner): Promise<string> {
    const sequenceRepo = manager.getRepository(LanSequence);
    const prefix = partner.lanPrefix || partner.code;
    const sequence = await sequenceRepo
      .createQueryBuilder('seq')
      .setLock('pessimistic_write')
      .where('seq.partnerId = :partnerId', { partnerId: partner.id })
      .getOne();

    if (!sequence) {
      const initialValue = 10000100;
      const nextValue = initialValue + 1;
      const newSequence = sequenceRepo.create({
        partnerId: partner.id,
        currentValue: nextValue,
        prefix,
      } as Partial<LanSequence>);
      await sequenceRepo.save(newSequence);
      return `${prefix}${nextValue.toString().padStart(8, '0')}`;
    }

    sequence.currentValue += 1;
    await sequenceRepo.save(sequence);

    return `${sequence.prefix}${sequence.currentValue.toString().padStart(8, '0')}`;
  }

  private buildGeneratedCustomerCode(customerId: number): string {
    return `CUST${String(customerId).padStart(6, '0')}`;
  }

  private buildGeneratedSupplierCode(supplierId: number): string {
    return `SUP${String(supplierId).padStart(6, '0')}`;
  }

  private validateCustomerMigrationRow(row: ExcelRow): string[] {
    const errors: string[] = [];
    const requiredFields: Array<[string[], string]> = [
      [['customer_name', 'name'], 'customer_name'],
      [['mobile', 'customer_mobile'], 'mobile'],
      [['lender_type', 'lender_name', 'partner_name', 'lender'], 'lender_type'],
      [['sanction_amount', 'sanctioned_amount'], 'sanction_amount'],
      [['co_applicant_name'], 'co_applicant_name'],
      [['co_applicant_mobile'], 'co_applicant_mobile'],
      [['co_applicant_pan'], 'co_applicant_pan'],
      [['co_applicant_aadhaar'], 'co_applicant_aadhaar'],
      [['co_applicant_address'], 'co_applicant_address'],
    ];

    requiredFields.forEach(([aliases, label]) => {
      if (!this.getCell(row, aliases)) errors.push(`${label} is required`);
    });

    const sanctionAmount = this.toNumber(this.getCell(row, ['sanction_amount', 'sanctioned_amount']));
    if (sanctionAmount === null || sanctionAmount <= 0) {
      errors.push('sanction_amount must be a positive number');
    }

    const turnover = this.getCell(row, ['annual_turnover']);
    if (turnover && this.toNumber(turnover) === null) {
      errors.push('annual_turnover must be a valid number');
    }

    const companyType = this.getCell(row, ['company_type']);
    if (companyType && !this.normalizeCompanyType(companyType)) {
      errors.push('company_type must be Proprietorship, Partnership, Pvt Ltd / Ltd, or LLP');
    }

    const ifsc = this.getCell(row, ['bank_ifsc_code', 'ifsc_code']);
    if (ifsc && ifsc.length !== 11) {
      errors.push('bank_ifsc_code must be 11 characters');
    }

    return errors;
  }

  private validateSupplierMigrationRow(row: ExcelRow): string[] {
    const errors: string[] = [];
    if (!this.getCell(row, ['lan_id', 'lan', 'lanid', 'loan_account_number'])) {
      errors.push('lan_id is required');
    }
    if (!this.getCell(row, ['partner_loan_id'])) {
      errors.push('partner_loan_id is required');
    }

    const requiredFields: Array<[string[], string]> = [
      [['supplier_name'], 'supplier_name'],
      [['bank_account_number'], 'bank_account_number'],
      [['ifsc_code', 'bank_ifsc_code'], 'ifsc_code'],
      [['bank_name'], 'bank_name'],
      [['account_holder_name'], 'account_holder_name'],
    ];

    requiredFields.forEach(([aliases, label]) => {
      if (!this.getCell(row, aliases)) errors.push(`${label} is required`);
    });

    const ifsc = this.getCell(row, ['ifsc_code', 'bank_ifsc_code']);
    if (ifsc && ifsc.length !== 11) {
      errors.push('ifsc_code must be 11 characters');
    }

    return errors;
  }

  private applyIfPresent<T extends object>(target: T, key: keyof T, value: any): void {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      target[key] = value;
    }
  }

  private async upsertKycDetail(
    manager: EntityManager,
    customerId: number,
    kycType: string,
    kycNumber: string,
    userId: number,
    options: {
      applicantType?: string;
      applicantIndex?: number;
      coApplicantId?: number | null;
      remarks?: string;
    } = {},
  ): Promise<void> {
    if (!kycNumber) return;

    const repository = manager.getRepository(KycDetail);
    const applicantType = options.applicantType || 'applicant';
    const applicantIndex = options.applicantIndex ?? 0;
    const coApplicantId = options.coApplicantId ?? null;
    let kyc = await repository.findOne({
      where: {
        customerId,
        applicantType,
        applicantIndex,
        coApplicantId,
        kycType,
      } as any,
    });

    if (!kyc) {
      kyc = repository.create();
      kyc.customerId = customerId;
      kyc.applicantType = applicantType;
      kyc.applicantIndex = applicantIndex;
      kyc.coApplicantId = coApplicantId;
      kyc.kycType = kycType;
    }

    kyc.kycNumber = kycNumber;
    kyc.coApplicantId = coApplicantId;
    kyc.verified = true;
    kyc.verifiedAt = new Date();
    kyc.verifiedBy = userId;
    kyc.remarks = options.remarks || 'Migrated by operations';
    await repository.save(kyc);
  }

  private async upsertCustomerAddress(
    manager: EntityManager,
    customerId: number,
    type: string,
    fullAddress: string,
    city: string,
    state: string,
    pincode: string,
    ownership: string,
  ): Promise<void> {
    if (!fullAddress || !city || !state || !pincode) return;

    const repository = manager.getRepository(CustomerAddress);
    let address = await repository.findOne({ where: { customerId, type } as any });

    if (!address) {
      address = repository.create();
      address.customerId = customerId;
      address.type = type;
    }

    address.fullAddress = fullAddress;
    address.city = city;
    address.state = state;
    address.pincode = pincode;
    address.ownership = this.normalizeOwnership(ownership);
    await repository.save(address);
  }

  private normalizeGender(value: string): string | undefined {
    if (!value) return undefined;
    const normalized = this.normalizeHeader(value);
    if (normalized === 'male') return 'Male';
    if (normalized === 'female') return 'Female';
    if (normalized === 'other') return 'Other';
    return undefined;
  }

  private async upsertCoApplicantFromRow(
    manager: EntityManager,
    customerId: number,
    row: ExcelRow,
    userId: number,
  ): Promise<CoApplicant> {
    const repository = manager.getRepository(CoApplicant);
    const name = this.getCell(row, ['co_applicant_name', 'coapplicant_name']);
    const mobile = this.getCell(row, ['co_applicant_mobile', 'coapplicant_mobile']);
    const email = this.getCell(row, ['co_applicant_email', 'coapplicant_email']);
    const pan = this.getCell(row, ['co_applicant_pan', 'coapplicant_pan']);
    const aadhaar = this.getCell(row, ['co_applicant_aadhaar', 'coapplicant_aadhaar']);
    const address = this.getCell(row, ['co_applicant_address', 'coapplicant_address']);
    const gender = this.normalizeGender(this.getCell(row, ['co_applicant_gender', 'coapplicant_gender']));

    let coApplicant = pan
      ? await repository.findOne({ where: { customerId, pan } as any })
      : null;

    if (!coApplicant && mobile) {
      coApplicant = await repository.findOne({ where: { customerId, mobile } as any });
    }

    if (!coApplicant) {
      coApplicant = repository.create();
      coApplicant.customerId = customerId;
    }

    coApplicant.name = name;
    coApplicant.mobile = mobile;
    coApplicant.pan = pan;
    coApplicant.email = email || coApplicant.email || null;
    if (gender) coApplicant.gender = gender;

    const savedCoApplicant = await repository.save(coApplicant);

    await this.upsertKycDetail(manager, customerId, KYC_TYPES.PAN, pan, userId, {
      applicantType: 'co-applicant',
      applicantIndex: 1,
      coApplicantId: savedCoApplicant.id,
    });
    await this.upsertKycDetail(manager, customerId, KYC_TYPES.AADHAAR, aadhaar, userId, {
      applicantType: 'co-applicant',
      applicantIndex: 1,
      coApplicantId: savedCoApplicant.id,
      remarks: address,
    });

    return savedCoApplicant;
  }

  private async saveMigratedCustomerRow(
    manager: EntityManager,
    row: ExcelRow,
    userId: number,
  ): Promise<{ customerId: number; customerCode: string; partnerLoanId: string; lanId: string }> {
    const customerRepo = manager.getRepository(Customer);
    const applicantRepo = manager.getRepository(Applicant);
    const sanctionRepo = manager.getRepository(CreditSanction);
    const loanAccountRepo = manager.getRepository(LoanAccount);
    const workflowRepo = manager.getRepository(CaseWorkflow);
    const historyRepo = manager.getRepository(CaseStatusHistory);

    const customerName = this.getCell(row, ['customer_name', 'name']);
    const mobile = this.getCell(row, ['mobile', 'customer_mobile']);
    const email = this.getCell(row, ['email', 'customer_email']);
    const pan = this.getCell(row, ['pan', 'applicant_pan']);
    const aadhaar = this.getCell(row, ['aadhaar_number', 'applicant_aadhaar']);
    const companyType = this.normalizeCompanyType(this.getCell(row, ['company_type']));
    const companyName = this.getCell(row, ['company_name']);
    const companyMobile = this.getCell(row, ['company_mobile']);
    const companyEmail = this.getCell(row, ['company_email']);
    const companyPan = this.getCell(row, ['company_pan']);
    const gstNumber = this.getCell(row, ['gst_number', 'gst']);
    const partnerLoanId = this.getCell(row, ['partner_loan_id']);
    const lenderType = this.getCell(row, ['lender_type', 'lender_name', 'partner_name', 'lender']);
    const sanctionAmount = this.toNumber(this.getCell(row, ['sanction_amount', 'sanctioned_amount'])) || 0;
    const tenure = this.toNumber(this.getCell(row, ['tenure_months', 'tenure'])) || 0;
    const interestRate = this.toNumber(this.getCell(row, ['interest_rate', 'roi_percentage', 'roi'])) || 0;
    const penalRate = this.toNumber(this.getCell(row, ['penal_rate', 'penal_charges'])) || 0;
    const processingFeeInput = this.toNumber(this.getCell(row, ['processing_fee', 'processing_fees'])) || 0;
    const serviceFeeInput = this.toNumber(this.getCell(row, ['service_fee', 'processing_fee_amount'])) || 0;
    const processingFeeRate = processingFeeInput <= 999.99 ? processingFeeInput : 0;
    const serviceFee = serviceFeeInput || (processingFeeInput > 999.99 ? processingFeeInput : 0);
    const annualTurnover = this.toNumber(this.getCell(row, ['annual_turnover']));
    const partner = await this.resolveMigrationPartner(manager, lenderType);
    const lenderCode = partner.code.toUpperCase();

    let customer: Customer | null = null;
    if (gstNumber) {
      customer = await customerRepo.findOne({ where: { gstNumber } });
    }

    if (!customer) {
      customer = customerRepo.create({
        name: customerName,
        mobile,
        rmId: userId,
      } as Partial<Customer>);
    }

    customer.name = customerName;
    customer.customerName = customerName;
    customer.mobile = mobile;
    customer.rmId = customer.rmId || userId;
    customer.status = CASE_STATUS.COMPLETED;
    customer.kycVerified = true;
    customer.remarks = 'Migrated by operations';
    customer.pushedTo = Array.from(
      new Set(
        `${customer.pushedTo || ''},${lenderCode}`
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ).join(',');

    this.applyIfPresent(customer, 'email', email);
    this.applyIfPresent(customer, 'pan', pan);
    this.applyIfPresent(customer, 'companyType', companyType);
    this.applyIfPresent(customer, 'companyName', companyName);
    this.applyIfPresent(customer, 'companyMobile', companyMobile);
    this.applyIfPresent(customer, 'companyEmail', companyEmail);
    this.applyIfPresent(customer, 'companyPan', companyPan);
    this.applyIfPresent(customer, 'gstNumber', gstNumber);
    this.applyIfPresent(customer, 'industryType', this.getCell(row, ['industry_type']));
    this.applyIfPresent(customer, 'bankAccountNo', this.getCell(row, ['bank_account_no', 'bank_account_number']));
    this.applyIfPresent(customer, 'bankIfscCode', this.getCell(row, ['bank_ifsc_code', 'ifsc_code']).toUpperCase());
    this.applyIfPresent(customer, 'bankName', this.getCell(row, ['bank_name']));
    this.applyIfPresent(customer, 'bankBranch', this.getCell(row, ['bank_branch']));
    this.applyIfPresent(customer, 'bankType', this.getCell(row, ['bank_type', 'account_type']));
    if (annualTurnover !== null) customer.annualTurnover = annualTurnover;

    const savedCustomer = await customerRepo.save(customer);
    if (!savedCustomer.customerCode) {
      savedCustomer.customerCode = this.buildGeneratedCustomerCode(savedCustomer.id);
      await customerRepo.save(savedCustomer);
    }

    let applicant = await applicantRepo.findOne({ where: { customerId: savedCustomer.id } });
    if (!applicant) {
      applicant = applicantRepo.create({ customerId: savedCustomer.id } as Partial<Applicant>);
    }
    applicant.name = customerName;
    applicant.mobile = mobile;
    this.applyIfPresent(applicant, 'email', email);
    this.applyIfPresent(applicant, 'pan', pan);
    this.applyIfPresent(applicant, 'aadhaarNumber', aadhaar);
    this.applyIfPresent(applicant, 'aadhaarAddress', this.getCell(row, ['applicant_address', 'address_line']));
    await applicantRepo.save(applicant);

    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.PAN, pan, userId);
    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.AADHAAR, aadhaar, userId);
    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.GST, gstNumber, userId);
    await this.upsertCoApplicantFromRow(manager, savedCustomer.id, row, userId);

    await this.upsertCustomerAddress(
      manager,
      savedCustomer.id,
      ADDRESS_TYPES.RESIDENCE,
      this.getCell(row, ['applicant_address', 'address_line', 'residence_address']),
      this.getCell(row, ['applicant_city', 'city']),
      this.getCell(row, ['applicant_state', 'state']),
      this.getCell(row, ['applicant_pincode', 'pincode']),
      this.getCell(row, ['applicant_address_ownership', 'address_ownership']),
    );

    await this.upsertCustomerAddress(
      manager,
      savedCustomer.id,
      ADDRESS_TYPES.SHOP,
      this.getCell(row, ['company_address', 'shop_address']),
      this.getCell(row, ['company_city', 'shop_city', 'city']),
      this.getCell(row, ['company_state', 'shop_state', 'state']),
      this.getCell(row, ['company_pincode', 'shop_pincode', 'pincode']),
      this.getCell(row, ['company_address_ownership', 'shop_ownership']),
    );

    let sanction = await sanctionRepo.findOne({
      where: { customerId: savedCustomer.id, partner: lenderCode },
    });
    if (!sanction) {
      sanction = sanctionRepo.create({
        customerId: savedCustomer.id,
        partner: lenderCode,
        creditOfficerId: userId,
      } as Partial<CreditSanction>);
    }
    sanction.sanctionAmount = sanctionAmount;
    sanction.tenure = tenure;
    sanction.interestRate = interestRate;
    sanction.penalCharges = penalRate;
    sanction.processingFees = processingFeeRate;
    sanction.serviceFee = serviceFee;
    sanction.creditOfficerId = sanction.creditOfficerId || userId;
    sanction.status = 'approved';
    sanction.creditRemarks = 'Migrated by operations';
    await sanctionRepo.save(sanction);

    const loanAccount = loanAccountRepo.create({
      customerId: savedCustomer.id,
      lanId: await this.getNextMigrationLanId(manager, partner),
      disbursedAmount: 0,
    } as Partial<LoanAccount>);

    loanAccount.customerId = savedCustomer.id;
    loanAccount.partnerId = partner.id;
    loanAccount.lender = lenderCode;
    loanAccount.sanctionedAmount = sanctionAmount;
    loanAccount.status = 'active';
    loanAccount.isOnboarded = false;
    loanAccount.utilizedLimit = loanAccount.utilizedLimit || 0;
    loanAccount.unutilizedLimit = sanctionAmount - Number(loanAccount.utilizedLimit || 0);
    await loanAccountRepo.save(loanAccount);

    let workflow = await workflowRepo.findOne({
      where: { customerId: savedCustomer.id, workflowType: 'CUSTOMER_ONBOARDING' as any },
    });
    if (!workflow) {
      workflow = workflowRepo.create({
        workflowType: 'CUSTOMER_ONBOARDING',
        customerId: savedCustomer.id,
      } as Partial<CaseWorkflow>);
    }
    workflow.currentStatus = CASE_STATUS.COMPLETED;
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = 'Migrated by operations';
    await workflowRepo.save(workflow);

    await historyRepo.save(
      historyRepo.create({
        customerId: savedCustomer.id,
        caseWorkflowId: workflow.id,
        status: CASE_STATUS.COMPLETED,
        previousStatus: null,
        changedBy: userId,
        remarks: 'Migrated by operations',
        sanctionAmount,
        tenure,
        interestRate,
        penalCharges: penalRate,
        processingFees: processingFeeRate,
      } as any),
    );

    return {
      customerId: savedCustomer.id,
      customerCode: savedCustomer.customerCode || String(savedCustomer.id),
      partnerLoanId: partnerLoanId || String(savedCustomer.id),
      lanId: loanAccount.lanId,
    };
  }

  private async saveMigratedSupplierRow(
    manager: EntityManager,
    row: ExcelRow,
    userId: number,
  ): Promise<{ supplierId: number; supplierCode: string; partnerLoanId: string }> {
    const supplierRepo = manager.getRepository(Supplier);
    const supplierBankRepo = manager.getRepository(SupplierBankDetail);
    const customerRepo = manager.getRepository(Customer);
    const loanAccountRepo = manager.getRepository(LoanAccount);
    const workflowRepo = manager.getRepository(CaseWorkflow);
    const historyRepo = manager.getRepository(CaseStatusHistory);

    const lanId = this.getCell(row, ['lan_id', 'lan', 'lanid', 'loan_account_number']);
    const partnerLoanId = this.getCell(row, ['partner_loan_id']);
    const supplierName = this.getCell(row, ['supplier_name']);

    const loanAccount = await loanAccountRepo.findOne({ where: { lanId } });
    if (!loanAccount) {
      throw new Error(`LAN ${lanId} was not found in loan accounts`);
    }

    const customer = await customerRepo.findOne({ where: { id: loanAccount.customerId } });
    if (!customer) {
      throw new Error(`Customer for LAN ${lanId} was not found`);
    }

    const supplier = supplierRepo.create({
      supplierCode: `SUP-TEMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      customerId: customer.id,
    } as Partial<Supplier>);

    supplier.customerId = customer.id;
    supplier.supplierName = supplierName;
    supplier.email = this.getCell(row, ['email', 'supplier_email']);
    supplier.contactNumber = this.getCell(row, ['contact_number', 'mobile_number', 'mobile']);
    supplier.address = this.getCell(row, ['address', 'supplier_address']);
    supplier.gstNumber = this.getCell(row, ['gst_number', 'supplier_gst']);
    supplier.panNumber = this.getCell(row, ['pan_number', 'supplier_pan']);
    supplier.createdByUserId = supplier.createdByUserId || userId;
    supplier.status = 'COMPLETED';
    supplier.isActive = true;
    const savedSupplier = await supplierRepo.save(supplier);
    savedSupplier.supplierCode = this.buildGeneratedSupplierCode(savedSupplier.id);
    await supplierRepo.save(savedSupplier);

    let bankDetail = await supplierBankRepo.findOne({ where: { supplierId: savedSupplier.id } });
    if (!bankDetail) {
      bankDetail = supplierBankRepo.create({ supplierId: savedSupplier.id } as Partial<SupplierBankDetail>);
    }
    bankDetail.bankAccountNumber = this.getCell(row, ['bank_account_number']);
    bankDetail.ifscCode = this.getCell(row, ['ifsc_code', 'bank_ifsc_code']).toUpperCase();
    bankDetail.bankName = this.getCell(row, ['bank_name']);
    bankDetail.accountHolderName = this.getCell(row, ['account_holder_name']);
    bankDetail.micrCode = this.getCell(row, ['micr_code']) || '';
    bankDetail.chequeNumber = this.getCell(row, ['cheque_number']) || '';
    await supplierBankRepo.save(bankDetail);

    let workflow = await workflowRepo.findOne({
      where: { supplierId: savedSupplier.id, workflowType: 'SUPPLIER_ONBOARDING' as any },
    });
    if (!workflow) {
      workflow = workflowRepo.create({
        workflowType: 'SUPPLIER_ONBOARDING',
        supplierId: savedSupplier.id,
        customerId: customer.id,
      } as Partial<CaseWorkflow>);
    }
    workflow.customerId = customer.id;
    workflow.currentStatus = 'COMPLETED';
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = new Date();
    workflow.remarks = 'Migrated by operations';
    await workflowRepo.save(workflow);

    await historyRepo.save(
      historyRepo.create({
        customerId: customer.id,
        supplierId: savedSupplier.id,
        caseWorkflowId: workflow.id,
        status: CASE_STATUS.COMPLETED,
        previousStatus: null,
        changedBy: userId,
        remarks: 'Supplier migrated by operations',
      } as any),
    );

    return {
      supplierId: savedSupplier.id,
      supplierCode: savedSupplier.supplierCode,
      partnerLoanId,
    };
  }

  private async sendMigratedCustomerToLMS(customerId: number, partnerLoanId?: string): Promise<{ success: boolean; message: string }> {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found for LMS sync');

    const applicant = await this.applicantRepository.findOne({ where: { customerId } });
    const coApplicant = await this.coApplicantRepository.findOne({
      where: { customerId },
      order: { createdAt: 'ASC' },
    });
    let coApplicantData: {
      name: string;
      pan: string;
      aadhaar: string;
      mobile: string;
      address: string;
    } | undefined;

    if (coApplicant) {
      const coApplicantKycDetails = await this.kycDetailRepository.find({
        where: { coApplicantId: coApplicant.id } as any,
      });
      const coApplicantPan =
        coApplicant.pan ||
        coApplicantKycDetails.find((kyc) => kyc.kycType === KYC_TYPES.PAN)?.kycNumber ||
        '';
      const coApplicantAadhaarKyc = coApplicantKycDetails.find(
        (kyc) => kyc.kycType === KYC_TYPES.AADHAAR,
      );

      coApplicantData = {
        name: coApplicant.name || '',
        pan: coApplicantPan,
        aadhaar: coApplicantAadhaarKyc?.kycNumber || '',
        mobile: coApplicant.mobile || '',
        address: coApplicantAadhaarKyc?.remarks || '',
      };
    }

    const residenceAddress = await this.customerAddressRepository.findOne({
      where: { customerId, type: ADDRESS_TYPES.RESIDENCE } as any,
    });
    const companyAddress = await this.customerAddressRepository.findOne({
      where: { customerId, type: ADDRESS_TYPES.SHOP } as any,
    });
    const loanAccounts = await this.loanAccountRepository.find({
      where: { customerId, status: 'active', isOnboarded: false },
      relations: ['partner'],
    });

    if (loanAccounts.length === 0) {
      throw new Error('No pending active loan accounts found for LMS sync');
    }

    const addressToString = (address?: CustomerAddress | null, fallback = '') => {
      if (!address) return fallback;
      return `${address.fullAddress}, ${address.city}, ${address.state} - ${address.pincode}`;
    };

    const sanctions = await Promise.all(
      loanAccounts.map(async (loanAccount) => {
        const sanction = await this.sanctionRepository.findOne({
          where: {
            customerId,
            partner: loanAccount.lender,
            status: 'approved',
          },
          order: { createdAt: 'DESC' },
        });

        return {
          lan: loanAccount.lanId,
          lender: loanAccount.partner?.code || loanAccount.lender || '',
          sanction_amount: Number(loanAccount.sanctionedAmount),
          tenure_months: Number(sanction?.tenure || 0),
          interest_rate: Number(sanction?.interestRate || 0),
          penal_rate: Number(sanction?.penalCharges || 0),
          processing_fee: Number(sanction?.processingFees || sanction?.serviceFee || 0),
        };
      }),
    );

    const payload = {
      partner_loan_id: partnerLoanId || String(customer.id),
      applicant: {
        name: applicant?.name || customer.name || '',
        pan: applicant?.pan || customer.pan || '',
        aadhaar: applicant?.aadhaarNumber || '',
        mobile: applicant?.mobile || customer.mobile || '',
        address: addressToString(residenceAddress, applicant?.aadhaarAddress || ''),
      },
      co_applicant: coApplicantData,
      company: {
        name: customer.companyName || '',
        pan: customer.companyPan || '',
        gst: customer.gstNumber || '',
        address: addressToString(companyAddress, addressToString(residenceAddress, applicant?.aadhaarAddress || '')),
      },
      sanctions,
    };

    console.log('LMS Payload for customerId', customerId, payload);

    const baseUrl = process.env.LMS_API_BASE_URL;
    const apiKey = process.env.LMS_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.');
    }

    const response = await axios.post(
      `${baseUrl}loan-booking/v1/supply-chain`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        timeout: 30000,
      },
    );

    await this.loanAccountRepository.update(
      { id: In(loanAccounts.map((loanAccount) => loanAccount.id)) },
      { isOnboarded: true },
    );

    return {
      success: response.data?.success ?? true,
      message: response.data?.message || 'Customer sent to LMS successfully',
    };
  }

  private async sendMigratedSupplierToLMS(supplierId: number, partnerLoanId: string): Promise<{ success: boolean; message: string }> {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found for LMS sync');

    const bankDetail = await this.supplierBankRepository.findOne({ where: { supplierId } });
    if (!bankDetail) throw new Error('Supplier bank details not found for LMS sync');

    const baseUrl = process.env.LMS_API_BASE_URL;
    const apiKey = process.env.LMS_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error('LMS API configuration missing. Set LMS_API_BASE_URL and LMS_API_KEY in environment.');
    }

    const payload = {
      partner_loan_id: partnerLoanId,
      suppliers: [
        {
          supplier_name: supplier.supplierName,
          mobile_number: supplier.contactNumber || '',
          bank_account_number: bankDetail.bankAccountNumber || '',
          ifsc_code: bankDetail.ifscCode || '',
          bank_name: bankDetail.bankName || '',
          account_holder_name: bankDetail.accountHolderName || '',
        },
      ],
    };
  console.log('LMS Payload for supplierId', supplierId, payload);
    const response = await axios.post(
      `${baseUrl}loan-booking/v1/supplier-onboarding`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        timeout: 30000,
      },
    );

    return {
      success: response.data?.success ?? true,
      message: response.data?.message || 'Supplier sent to LMS successfully',
    };
  }

  private buildMigrationResult(entityName: string, totalRows: number, results: MigrationRowResult[]): MigrationUploadResult {
    const localSaved = results.filter((result) => result.localStatus === 'SAVED').length;
    const lmsSent = results.filter((result) => result.lmsStatus === 'SENT').length;
    const failed = results.filter(
      (result) => result.localStatus === 'FAILED' || result.lmsStatus === 'FAILED' || result.lmsStatus === 'SKIPPED',
    ).length;

    return {
      success: totalRows > 0 && failed === 0,
      message:
        totalRows === 0
          ? `No ${entityName.toLowerCase()} rows found in the Excel file`
          : `${entityName} migration completed: ${lmsSent}/${totalRows} rows sent to LMS`,
      summary: {
        totalRows,
        localSaved,
        lmsSent,
        failed,
      },
      results,
    };
  }

  async migrateCustomersFromExcel(file: Express.Multer.File, userId: number): Promise<MigrationUploadResult> {
    const rows = await this.parseXlsxRows(file);
    const results: MigrationRowResult[] = [];
    const customerResultIndexes = new Map<number, number[]>();
    const customerPartnerLoanIds = new Map<number, string>();
     console.log("Parsed rows", rows);
    for (const row of rows) {
      const rowNumber = Number(row.__rowNumber);
      const name = this.getCell(row, ['customer_name', 'name']);
      const reference = this.getCell(row, ['partner_loan_id', 'lender_type', 'lan_id']) || `Row ${rowNumber}`;
      const validationErrors = this.validateCustomerMigrationRow(row);

      if (validationErrors.length > 0) {
        results.push({
          rowNumber,
          reference,
          name,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: validationErrors.join('; '),
        });
        continue;
      }

      try {
        const saved = await AppDataSource.transaction((manager) =>
          this.saveMigratedCustomerRow(manager, row, userId),
        );
        const resultIndex = results.push({
          rowNumber,
          reference: saved.customerCode || reference,
          name,
          localStatus: 'SAVED',
          lmsStatus: 'PENDING',
          localId: saved.customerId,
          message: `Saved locally with system LAN ${saved.lanId}. LMS sync pending.`,
        }) - 1;

        customerPartnerLoanIds.set(saved.customerId, saved.partnerLoanId);
        console.log(`Saved customer ${saved.customerCode} with system LAN ${saved.lanId}`);
        customerResultIndexes.set(saved.customerId, [
          ...(customerResultIndexes.get(saved.customerId) || []),
          resultIndex,
        ]);
      } catch (error: any) {
        results.push({
          rowNumber,
          reference,
          name,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: error.message || 'Failed to save customer locally',
        });
      }
    }

    for (const [customerId, resultIndexes] of customerResultIndexes.entries()) {
      try {
        const lmsResult = await this.sendMigratedCustomerToLMS(
          customerId,
          customerPartnerLoanIds.get(customerId),
        );
        resultIndexes.forEach((index) => {
          results[index].lmsStatus = lmsResult.success ? 'SENT' : 'FAILED';
          results[index].message = lmsResult.message;
        });
      } catch (error: any) {
        resultIndexes.forEach((index) => {
          results[index].lmsStatus = 'FAILED';
          results[index].message = error.response?.data
            ? `LMS API Error: ${JSON.stringify(error.response.data)}`
            : error.message || 'Failed to send customer to LMS';
        });
      }
    }

    console.log("result--->",results);

    return this.buildMigrationResult('Customer', rows.length, results);
  }

  async migrateSuppliersFromExcel(file: Express.Multer.File, userId: number): Promise<MigrationUploadResult> {
    const rows = await this.parseXlsxRows(file);
    const results: MigrationRowResult[] = [];

    for (const row of rows) {
      const rowNumber = Number(row.__rowNumber);
      const name = this.getCell(row, ['supplier_name']);
      const reference = this.getCell(row, ['lan_id', 'lan', 'lanid', 'loan_account_number']) || `Row ${rowNumber}`;
      const validationErrors = this.validateSupplierMigrationRow(row);

      if (validationErrors.length > 0) {
        results.push({
          rowNumber,
          reference,
          name,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: validationErrors.join('; '),
        });
        continue;
      }

      try {
        const saved = await AppDataSource.transaction((manager) =>
          this.saveMigratedSupplierRow(manager, row, userId),
        );

        const result: MigrationRowResult = {
          rowNumber,
          reference: saved.supplierCode || reference,
          name,
          localStatus: 'SAVED',
          lmsStatus: 'PENDING',
          localId: saved.supplierId,
          message: 'Saved locally. LMS sync pending.',
        };

        try {
          const lmsResult = await this.sendMigratedSupplierToLMS(saved.supplierId, saved.partnerLoanId);
          result.lmsStatus = lmsResult.success ? 'SENT' : 'FAILED';
          result.message = lmsResult.message;
        } catch (error: any) {
          result.lmsStatus = 'FAILED';
          result.message = error.response?.data
            ? `LMS API Error: ${JSON.stringify(error.response.data)}`
            : error.message || 'Failed to send supplier to LMS';
        }

        results.push(result);
      } catch (error: any) {
        results.push({
          rowNumber,
          reference,
          name,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: error.message || 'Failed to save supplier locally',
        });
      }
    }

    return this.buildMigrationResult('Supplier', rows.length, results);
  }

  /**
   * Get all active partners as lenders
   */
  async getLenders(): Promise<{ id: number; name: string; code: string; lenderName: string }[]> {
    const partners = await this.partnerRepository.find({
      where: { status: 'ACTIVE' as any },
      order: { name: 'ASC' },
    });
    console.log("partners", partners);
    // Return partner name as lenderName (used to query loan_accounts table)
    return partners.map(p => ({ 
      id: p.id, 
      name: p.name, 
      code: p.code,
      lenderName: p.name // Use partner name for lender field in loan_accounts
    }));
  }

  /**
   * Get LANs by partner ID
   * Uses partnerId to directly join with loan_accounts table
   */
  async getLansByLender(partnerId: number): Promise<{ lanId: string; customerId: number }[]> {
    const loanAccounts = await this.loanAccountRepository.find({
      select: ['lanId', 'customerId'],
      where: { partnerId: partnerId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    
    return loanAccounts.map(la => ({ lanId: la.lanId, customerId: la.customerId }));
  }

  /**
   * Validate repayment records
   */
  private validateRepayments(repayments: RepaymentRecord[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!repayments || repayments.length === 0) {
      errors.push({ field: 'repayments', message: 'Repayments array must not be empty' });
      return errors;
    }

    const utrSet = new Set<string>();

    for (let i = 0; i < repayments.length; i++) {
      const repayment = repayments[i];
      const index = i;

      // Validate lan
      if (!repayment.lan || repayment.lan.trim() === '') {
        errors.push({ field: `repayments[${index}].lan`, message: 'LAN must not be null or empty' });
      }

      // Validate collection_date format (YYYY-MM-DD)
      if (!repayment.collection_date) {
        errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date is required' });
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(repayment.collection_date)) {
          errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date must be in YYYY-MM-DD format' });
        } else {
          const date = new Date(repayment.collection_date);
          if (isNaN(date.getTime())) {
            errors.push({ field: `repayments[${index}].collection_date`, message: 'Collection date must be a valid date' });
          }
        }
      }

      // Validate collection_utr
      if (!repayment.collection_utr || repayment.collection_utr.trim() === '') {
        errors.push({ field: `repayments[${index}].collection_utr`, message: 'Collection UTR must not be null or empty' });
      } else if (utrSet.has(repayment.collection_utr)) {
        errors.push({ field: `repayments[${index}].collection_utr`, message: `Duplicate UTR: ${repayment.collection_utr}` });
      } else {
        utrSet.add(repayment.collection_utr);
      }

      // Validate collection_amount
      if (repayment.collection_amount === undefined || repayment.collection_amount === null) {
        errors.push({ field: `repayments[${index}].collection_amount`, message: 'Collection amount is required' });
      } else if (repayment.collection_amount <= 0) {
        errors.push({ field: `repayments[${index}].collection_amount`, message: 'Collection amount must be greater than 0' });
      }
    }

    return errors;
  }

  /**
   * Check for duplicate UTR in database
   */
  private async checkDuplicateUtr(lan: string, collectionUtr: string): Promise<boolean> {
    const existing = await this.repaymentUploadRepository.findOne({
      where: { lan, collectionUtr },
    });
    return !!existing;
  }

  /**
   * Post repayment data into the internal LMS ledger/allocation engine.
   */
  private async sendToLMSApi(repayments: RepaymentRecord[]): Promise<any> {
    console.log('[Repayment Upload] Posting to internal LMS:', JSON.stringify({ repayments }, null, 2));

    const results = [];
    for (const repayment of repayments) {
      try {
        const posted = await internalLmsService.recordCollection({
          lan: repayment.lan,
          collectionDate: repayment.collection_date,
          collectionUtr: repayment.collection_utr,
          collectionAmount: repayment.collection_amount,
        });

        results.push({
          lan: repayment.lan,
          collection_utr: repayment.collection_utr,
          status: 'success',
          repaymentId: posted.repayment.id,
          allocationCount: posted.allocations.length,
          unappliedAmount: posted.repayment.unappliedAmount,
        });
      } catch (error: any) {
        results.push({
          lan: repayment.lan,
          collection_utr: repayment.collection_utr,
          status: 'failed',
          message: error.message,
        });
      }
    }

    const failed = results.filter((result) => result.status === 'failed');
    if (failed.length > 0) {
      throw new Error(`Internal LMS repayment posting failed: ${failed.map((item) => `${item.lan}/${item.collection_utr}: ${item.message}`).join('; ')}`);
    }

    return {
      message: 'Repayments posted to internal LMS successfully',
      total: results.length,
      success_count: results.length,
      failed_count: 0,
      results,
    };
  }

  /**
   * Upload repayment collections to LMS
   */
  async uploadRepayments(
    repayments: RepaymentRecord[],
    userId: number
  ): Promise<UploadResult> {
    // Step 1: Validate input
    const validationErrors = this.validateRepayments(repayments);
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: 'Validation failed',
        results: validationErrors.map(err => ({
          lan: err.field.includes('[') ? repayments[parseInt(err.field.match(/\d+/)?.[0] || '0')]?.lan || 'unknown' : 'unknown',
          collectionUtr: err.field.includes('[') ? repayments[parseInt(err.field.match(/\d+/)?.[0] || '0')]?.collection_utr || 'unknown' : 'unknown',
          status: 'FAILED',
          errorMessage: err.message,
        })),
      };
    }

    // Step 2: Check for duplicate UTRs in database
    const duplicateChecks = await Promise.all(
      repayments.map(async (r) => {
        const isDuplicate = await this.checkDuplicateUtr(r.lan, r.collection_utr);
        return isDuplicate ? r : null;
      })
    );

    const duplicates = duplicateChecks.filter(r => r !== null);
    if (duplicates.length > 0) {
      return {
        success: false,
        message: 'Duplicate UTR submission detected',
        results: duplicates.map(r => ({
          lan: r.lan,
          collectionUtr: r.collection_utr,
          status: 'FAILED',
          errorMessage: `Duplicate UTR: ${r.collection_utr} for LAN ${r.lan}`,
        })),
      };
    }

    // Step 3: Save records to database (pending status)
    const savedRecords: RepaymentUpload[] = [];
    for (const repayment of repayments) {
      const record = this.repaymentUploadRepository.create({
        lan: repayment.lan,
        collectionDate: new Date(repayment.collection_date),
        collectionUtr: repayment.collection_utr,
        collectionAmount: repayment.collection_amount,
        status: REPAYMENT_UPLOAD_STATUS.PENDING,
        uploadedBy: userId,
        retryCount: 0,
      });
      savedRecords.push(await this.repaymentUploadRepository.save(record));
    }

    // Step 4: Call LMS API
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.sendToLMSApi(repayments);
      lmsSuccess = true;
    } catch (error: any) {
      console.error('[Repayment Upload] LMS API call failed:', error.message);
      lmsResponse = { message: error.message };
    }

    // Step 5: Update records based on LMS response
    const results: UploadResult['results'] = [];
    const timestamp = new Date().toISOString();

    for (const record of savedRecords) {
      if (lmsSuccess) {
        record.status = REPAYMENT_UPLOAD_STATUS.UPLOADED;
        record.uploadedAt = new Date();
        record.lmsResponse = JSON.stringify(lmsResponse);
        await this.repaymentUploadRepository.save(record);

if (false) await AppDataSource.query(
  `
  UPDATE loan_accounts
  SET

    utilizedLimit =
      GREATEST(
        COALESCE(utilizedLimit, 0) - ?,
        0
      )

  WHERE lanId = ?
  `,
  [
    Number(record.collectionAmount || 0),
    record.lan,
  ]
);

// ✅ second query
if (false) await AppDataSource.query(
  `
  UPDATE loan_accounts
  SET
    unutilizedLimit =
      COALESCE(sanctionedAmount, 0) -
      COALESCE(utilizedLimit, 0)

  WHERE lanId = ?
  `,
  [record.lan]
);


        console.log(`[Repayment Upload] Success - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Timestamp: ${timestamp}`);

        results.push({
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'UPLOADED',
        });
      } else {
        record.status = REPAYMENT_UPLOAD_STATUS.FAILED;
        record.errorMessage = lmsResponse.message;
        record.lmsResponse = JSON.stringify(lmsResponse);
        await this.repaymentUploadRepository.save(record);

        console.error(`[Repayment Upload] Failure - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Error: ${lmsResponse.message}, Timestamp: ${timestamp}`);

        results.push({
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'FAILED',
          errorMessage: lmsResponse.message,
        });
      }
    }

    return {
      success: lmsSuccess,
      message: lmsSuccess ? 'Repayments uploaded successfully' : 'Failed to upload repayments',
      results,
    };
  }

  /**
   * Retry failed repayment uploads
   */
  async retryRepaymentUpload(id: number): Promise<UploadResult> {
    const record = await this.repaymentUploadRepository.findOne({ where: { id } });

    if (!record) {
      return { success: false, message: 'Repayment record not found' };
    }

    if (record.status === REPAYMENT_UPLOAD_STATUS.UPLOADED) {
      return { success: false, message: 'Repayment already uploaded successfully' };
    }

    // Prepare repayment record for LMS call
    const repayment: RepaymentRecord = {
      lan: record.lan,
      collection_date: record.collectionDate.toISOString().split('T')[0],
      collection_utr: record.collectionUtr,
      collection_amount: Number(record.collectionAmount),
    };

    // Increment retry count
    record.retryCount += 1;
    await this.repaymentUploadRepository.save(record);

    // Call LMS API
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.sendToLMSApi([repayment]);
      lmsSuccess = true;
    } catch (error: any) {
      console.error(`[Repayment Upload] Retry failed for ID ${id}:`, error.message);
      lmsResponse = { message: error.message };
    }

    // Update record based on LMS response
    const timestamp = new Date().toISOString();

    if (lmsSuccess) {
      record.status = REPAYMENT_UPLOAD_STATUS.UPLOADED;
      record.uploadedAt = new Date();
      record.lmsResponse = JSON.stringify(lmsResponse);
      await this.repaymentUploadRepository.save(record);

      console.log(`[Repayment Upload] Retry Success - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Timestamp: ${timestamp}`);

      return {
        success: true,
        message: 'Repayment uploaded successfully on retry',
        results: [{
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'UPLOADED',
        }],
      };
    } else {
      record.status = REPAYMENT_UPLOAD_STATUS.FAILED;
      record.errorMessage = lmsResponse.message;
      record.lmsResponse = JSON.stringify(lmsResponse);
      await this.repaymentUploadRepository.save(record);

      console.error(`[Repayment Upload] Retry Failure - LAN: ${record.lan}, UTR: ${record.collectionUtr}, Error: ${lmsResponse.message}, Timestamp: ${timestamp}`);

      return {
        success: false,
        message: 'Retry failed',
        results: [{
          lan: record.lan,
          collectionUtr: record.collectionUtr,
          status: 'FAILED',
          errorMessage: lmsResponse.message,
        }],
      };
    }
  }

  /**
   * Get all repayment uploads with filters
   */
  async getRepaymentUploads(filters?: {
    status?: REPAYMENT_UPLOAD_STATUS;
    lan?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: RepaymentUpload[]; total: number }> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.lan) {
      where.lan = filters.lan;
    }
    if (filters?.startDate || filters?.endDate) {
      where.collectionDate = {};
      if (filters?.startDate) {
        where.collectionDate.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.collectionDate.lte = filters.endDate;
      }
    }

    const [data, total] = await this.repaymentUploadRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return { data, total };
  }

  /**
   * Get repayment upload by ID
   */
  async getRepaymentUploadById(id: number): Promise<RepaymentUpload | null> {
    return await this.repaymentUploadRepository.findOne({ where: { id } });
  }

  /**
   * Submit post-sanction completion and trigger operations approval
   */
  async submitPostSanction(
    customerId: number,
    userId: number,
    data?: {
      documentsVerified?: boolean;
      esignVerified?: boolean;
      enachVerified?: boolean;
      remarks?: string;
    }
  ): Promise<OperationsCheck> {
    // Verify customer exists and is in POST_SANCTION_PENDING status
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.status !== CASE_STATUS.POST_SANCTION_PENDING) {
      throw new Error('Customer is not in post-sanction pending status');
    }

    // Create operations check
    const operationsCheck = this.operationsCheckRepository.create({
      customerId,
      opsUserId: userId,
      documentsVerified: data?.documentsVerified ?? false,
      esignVerified: data?.esignVerified ?? false,
      enachVerified: data?.enachVerified ?? false,
      opsRemarks: data?.remarks ?? undefined,
      status: 'pending',
    });

    const savedOpsCheck = await this.operationsCheckRepository.save(operationsCheck);

    // Update customer status to POST_SANCTION_COMPLETED
    customer.status = CASE_STATUS.POST_SANCTION_COMPLETED;
    await this.customerRepository.save(customer);

    // Create operations approval instance
    await this.approvalService.createOperationsApproval(savedOpsCheck.id);

    return savedOpsCheck;
  }

  /**
   * Get pending operations checks
   */
  async getPendingChecks(): Promise<OperationsCheck[]> {
    return await this.operationsCheckRepository.find({
      where: { status: 'pending' },
      relations: ['customer', 'customer.rm', 'opsUser'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get operations check by ID
   */
  async getCheckById(id: number): Promise<OperationsCheck | null> {
    return await this.operationsCheckRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'customer.rm',
        'customer.documents',
        'opsUser',
        'approvalInstances',
        'approvalInstances.approvalFlow',
        'approvalInstances.actions',
        'approvalInstances.actions.approver',
      ],
    });
  }

  /**
   * Update operations check
   */
  async updateCheck(
    id: number,
    data: Partial<OperationsCheck>
  ): Promise<OperationsCheck> {
    const opsCheck = await this.operationsCheckRepository.findOne({ where: { id } });

    if (!opsCheck) {
      throw new Error('Operations check not found');
    }

    Object.assign(opsCheck, data);

    return await this.operationsCheckRepository.save(opsCheck);
  }
}
