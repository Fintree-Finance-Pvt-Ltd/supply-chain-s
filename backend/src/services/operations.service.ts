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
  ContactPerson,
  LanSequence,
  PARTNER_STATUS,
  Invoice,
  LoanDisbursement,
} from '../entities';
import { EntityManager, In, Repository } from 'typeorm';
import { ApprovalService } from './approval.service';
import { ADDRESS_TYPES, CASE_STATUS, COMPANY_TYPES, KYC_TYPES } from '../config/constants';
import { loanManagementService } from './loan-management.service';
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

type WorkbookCellValue = string | number | Date | null | undefined;

type WorkbookSheet = {
  name: string;
  rows: WorkbookCellValue[][];
};

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

interface LoanSearchLoanAccount {
  id: number;
  lanId: string;
  partnerLanId: string | null;
  lender: string | null;
  partnerName: string | null;
  status: string | null;
  sanctionedAmount: number | null;
  disbursedAmount: number | null;
}

interface LoanSearchCustomer {
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  customerCode: string | null;
  status: string | null;
  loanAccounts: LoanSearchLoanAccount[];
}

export class OperationsService {
  private operationsCheckRepository: Repository<OperationsCheck>;
  private customerRepository: Repository<Customer>;
  private repaymentUploadRepository: Repository<RepaymentUpload>;
  private loanAccountRepository: Repository<LoanAccount>;
  private partnerRepository: Repository<Partner>;
  private supplierRepository: Repository<Supplier>;
  private supplierBankRepository: Repository<SupplierBankDetail>;
  private invoiceRepository: Repository<Invoice>;
  private workflowRepository: Repository<CaseWorkflow>;
  private historyRepository: Repository<CaseStatusHistory>;
  private sanctionRepository: Repository<CreditSanction>;
  private applicantRepository: Repository<Applicant>;
  private coApplicantRepository: Repository<CoApplicant>;
  private kycDetailRepository: Repository<KycDetail>;
  private customerAddressRepository: Repository<CustomerAddress>;
  private approvalService: ApprovalService;
  private crc32Table: number[] | null = null;
  private readonly migrationRepeatCount = 5;
  private readonly coApplicantMigrationFields = ['name', 'mobile', 'email', 'pan', 'aadhaar', 'address', 'gender'];
  private readonly addressMigrationFields = ['type', 'full_address', 'city', 'state', 'pincode', 'ownership'];
  private readonly contactPersonMigrationFields = ['name', 'mobile', 'email', 'designation', 'gender'];

  constructor() {
    this.operationsCheckRepository = AppDataSource.getRepository(OperationsCheck);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.repaymentUploadRepository = AppDataSource.getRepository(RepaymentUpload);
    this.loanAccountRepository = AppDataSource.getRepository(LoanAccount);
    this.partnerRepository = AppDataSource.getRepository(Partner);
    this.supplierRepository = AppDataSource.getRepository(Supplier);
    this.supplierBankRepository = AppDataSource.getRepository(SupplierBankDetail);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
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

  private isBlankMigrationValue(value: unknown): boolean {
    const raw = String(value ?? '').trim();
    if (!raw) return true;

    const normalized = this.normalizeHeader(raw);
    return ['na', 'n_a', 'not_available', 'not_applicable', 'nil', 'none', 'blank'].includes(normalized);
  }

  private getCell(row: ExcelRow, aliases: string[]): string {
    for (const alias of aliases) {
      const key = this.normalizeHeader(alias);
      const value = row[key];
      if (value !== undefined && value !== null && !this.isBlankMigrationValue(value)) {
        return String(value).trim();
      }
    }
    return '';
  }

  private buildIndexedHeaders(prefix: string, fields: string[], count = this.migrationRepeatCount): string[] {
    const headers: string[] = [];
    for (let index = 1; index <= count; index += 1) {
      fields.forEach((field) => headers.push(`${prefix}_${index}_${field}`));
    }
    return headers;
  }

  private getIndexedCell(
    row: ExcelRow,
    prefixes: string[],
    index: number,
    field: string,
    fallbackAliases: string[] = [],
  ): string {
    const aliases: string[] = [];
    prefixes.forEach((prefix) => {
      aliases.push(`${prefix}_${index}_${field}`);
      aliases.push(`${prefix}${index}_${field}`);
      aliases.push(`${prefix}_${field}_${index}`);
    });
    if (index === 1) aliases.push(...fallbackAliases);
    return this.getCell(row, aliases);
  }

  private getMigratedCustomerName(row: ExcelRow): string {
    const customerName = this.getCell(row, ['customer_name', 'name']);
    if (customerName) return customerName;

    const partnerLoanId = this.getCell(row, ['partner_loan_id']);
    if (partnerLoanId) return `Migrated Customer ${partnerLoanId}`;

    return `Migrated Customer Row ${row.__rowNumber}`;
  }

  private hasIndexedGroupData(
    row: ExcelRow,
    prefixes: string[],
    index: number,
    fields: string[],
    fallbackAliasesByField: Record<string, string[]> = {},
  ): boolean {
    return fields.some((field) =>
      Boolean(this.getIndexedCell(row, prefixes, index, field, fallbackAliasesByField[field] || [])),
    );
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

  private toDateOnly(value: string | Date): Date {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDateOnly(value: string | Date): string {
    const date = this.toDateOnly(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateValue(value: string, fieldName: string, required = true): Date | null {
    const raw = String(value || '').trim();
    if (!raw) {
      if (required) throw new Error(`${fieldName} is required`);
      return null;
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      const excelEpoch = new Date(1899, 11, 30);
      return this.addDays(excelEpoch, Math.floor(numeric));
    }

    const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
      if (!isNaN(date.getTime())) return this.toDateOnly(date);
    }

    const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const date = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
      if (!isNaN(date.getTime())) return this.toDateOnly(date);
    }

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return this.toDateOnly(parsed);

    throw new Error(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }

  private getDateCell(row: ExcelRow, aliases: string[], fieldName: string, required = true): Date | null {
    return this.parseDateValue(this.getCell(row, aliases), fieldName, required);
  }

  private createXlsxWorkbook(sheets: WorkbookSheet[]): Buffer {
    const safeSheets = sheets.map((sheet, index) => ({
      name: this.sanitizeWorksheetName(sheet.name || `Sheet ${index + 1}`),
      rows: sheet.rows || [],
    }));

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets.map((sheet, index) => `<sheet name="${this.escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}
  </sheets>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets.map((_sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets.map((_sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

    const files = [
      { path: '[Content_Types].xml', content: contentTypesXml },
      { path: '_rels/.rels', content: rootRelsXml },
      { path: 'xl/workbook.xml', content: workbookXml },
      { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
      { path: 'xl/styles.xml', content: stylesXml },
      ...safeSheets.map((sheet, index) => ({
        path: `xl/worksheets/sheet${index + 1}.xml`,
        content: this.buildWorksheetXml(sheet.rows),
      })),
    ];

    return this.createZip(files);
  }

  private buildWorksheetXml(rows: WorkbookCellValue[][]): string {
    const sheetRows = rows.map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((cell, cellIndex) => this.buildCellXml(cell, rowNumber, cellIndex + 1)).join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
  }

  private buildCellXml(value: WorkbookCellValue, rowNumber: number, columnNumber: number): string {
    const cellRef = `${this.getExcelColumnName(columnNumber)}${rowNumber}`;
    if (value === null || value === undefined || value === '') {
      return `<c r="${cellRef}"/>`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${cellRef}"><v>${value}</v></c>`;
    }

    const text = value instanceof Date ? this.formatDateOnly(value) : String(value);
    return `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${this.escapeXml(text)}</t></is></c>`;
  }

  private getExcelColumnName(columnNumber: number): string {
    let name = '';
    let current = columnNumber;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      current = Math.floor((current - 1) / 26);
    }
    return name;
  }

  private sanitizeWorksheetName(name: string): string {
    const sanitized = name.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
    return sanitized || 'Sheet';
  }

  private createZip(files: Array<{ path: string; content: string | Buffer }>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    const dosDateTime = this.getZipDateTime(new Date());

    files.forEach((file) => {
      const nameBuffer = Buffer.from(file.path, 'utf8');
      const dataBuffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
      const crc = this.crc32(dataBuffer);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(dosDateTime.time, 10);
      localHeader.writeUInt16LE(dosDateTime.date, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(dataBuffer.length, 18);
      localHeader.writeUInt32LE(dataBuffer.length, 22);
      localHeader.writeUInt16LE(nameBuffer.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, nameBuffer, dataBuffer);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(dosDateTime.time, 12);
      centralHeader.writeUInt16LE(dosDateTime.date, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(dataBuffer.length, 20);
      centralHeader.writeUInt32LE(dataBuffer.length, 24);
      centralHeader.writeUInt16LE(nameBuffer.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);
      centralParts.push(centralHeader, nameBuffer);

      offset += localHeader.length + nameBuffer.length + dataBuffer.length;
    });

    const centralDirectory = Buffer.concat(centralParts);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(files.length, 8);
    endRecord.writeUInt16LE(files.length, 10);
    endRecord.writeUInt32LE(centralDirectory.length, 12);
    endRecord.writeUInt32LE(offset, 16);
    endRecord.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, endRecord]);
  }

  private getZipDateTime(date: Date): { date: number; time: number } {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    };
  }

  private crc32(buffer: Buffer): number {
    const table = this.getCrc32Table();
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getCrc32Table(): number[] {
    if (this.crc32Table) return this.crc32Table;

    this.crc32Table = Array.from({ length: 256 }, (_value, index) => {
      let crc = index;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      return crc >>> 0;
    });

    return this.crc32Table;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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

  private normalizeAddressType(value: string): string {
    const normalized = this.normalizeHeader(value);
    const typeMap: Record<string, string> = {
      residence: ADDRESS_TYPES.RESIDENCE,
      residential: ADDRESS_TYPES.RESIDENCE,
      home: ADDRESS_TYPES.RESIDENCE,
      applicant: ADDRESS_TYPES.RESIDENCE,
      shop: ADDRESS_TYPES.SHOP,
      office: ADDRESS_TYPES.SHOP,
      business: ADDRESS_TYPES.SHOP,
      company: ADDRESS_TYPES.SHOP,
      godown: ADDRESS_TYPES.GODOWN,
      warehouse: ADDRESS_TYPES.GODOWN,
    };

    return typeMap[normalized] || ADDRESS_TYPES.RESIDENCE;
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
      throw new Error(`Lender type "${lenderType}" was not found in the partners`);
    }

    if (partner.status !== PARTNER_STATUS.ACTIVE) {
      throw new Error(`Lender type "${lenderType}" maps to inactive partner ${partner.code}`);
    }

    return partner;
  }

  private async getNextMigrationLanId(manager: EntityManager, partner: Partner): Promise<string> {
    const sequenceRepo = manager.getRepository(LanSequence);
    const loanAccountRepo = manager.getRepository(LoanAccount);
    const prefix = partner.lanPrefix || partner.code;
    let sequence = await sequenceRepo
      .createQueryBuilder('seq')
      .setLock('pessimistic_write')
      .where('seq.partnerId = :partnerId', { partnerId: partner.id })
      .getOne();

    if (!sequence) {
      sequence = sequenceRepo.create({
        partnerId: partner.id,
        currentValue: 10000100,
        prefix,
      } as Partial<LanSequence>);
    }

    const sequencePrefix = sequence.prefix || prefix;
    const latestLoanAccount = await loanAccountRepo
      .createQueryBuilder('loanAccount')
      .select('loanAccount.lanId', 'lanId')
      .where('loanAccount.lanId LIKE :prefix', { prefix: `${sequencePrefix}%` })
      .orderBy('loanAccount.lanId', 'DESC')
      .getRawOne<{ lanId?: string }>();

    const latestExistingValue = Number(
      String(latestLoanAccount?.lanId || '').slice(sequencePrefix.length),
    );
    let nextValue = Math.max(
      Number(sequence.currentValue || 0),
      Number.isFinite(latestExistingValue) ? latestExistingValue : 0,
      10000100,
    );

    for (let attempt = 0; attempt < 10000; attempt += 1) {
      nextValue += 1;
      const lanId = `${sequencePrefix}${nextValue.toString().padStart(8, '0')}`;
      const existing = await loanAccountRepo.findOne({ where: { lanId } });
      if (!existing) {
        sequence.currentValue = nextValue;
        sequence.prefix = sequencePrefix;
        await sequenceRepo.save(sequence);
        return lanId;
      }
    }

    throw new Error(`Unable to generate a unique LAN for partner ${partner.code}`);
  }

  private async resolveCustomerMigrationLanId(
    manager: EntityManager,
    partner: Partner,
    providedLanId: string,
  ): Promise<string> {
    const lanId = String(providedLanId || '').trim().toUpperCase();
    if (!lanId) {
      return this.getNextMigrationLanId(manager, partner);
    }

    const prefix = String(partner.lanPrefix || partner.code || '').trim().toUpperCase();
    if (prefix && !lanId.startsWith(prefix)) {
      throw new Error(`lan_id ${lanId} must start with partner prefix ${prefix}`);
    }

    const existing = await manager.getRepository(LoanAccount).findOne({ where: { lanId } });
    if (existing) {
      throw new Error(`lan_id ${lanId} already exists`);
    }

    const numericSuffix = prefix ? Number(lanId.slice(prefix.length)) : NaN;
    if (Number.isInteger(numericSuffix) && numericSuffix > 0) {
      const sequenceRepo = manager.getRepository(LanSequence);
      let sequence = await sequenceRepo
        .createQueryBuilder('seq')
        .setLock('pessimistic_write')
        .where('seq.partnerId = :partnerId', { partnerId: partner.id })
        .getOne();

      if (!sequence) {
        sequence = sequenceRepo.create({
          partnerId: partner.id,
          currentValue: numericSuffix,
          prefix,
        } as Partial<LanSequence>);
      } else if (numericSuffix > sequence.currentValue) {
        sequence.currentValue = numericSuffix;
      }

      await sequenceRepo.save(sequence);
    }

    return lanId;
  }

  private buildGeneratedCustomerCode(customerId: number): string {
    return `CUST${String(customerId).padStart(6, '0')}`;
  }

  private buildGeneratedSupplierCode(supplierId: number): string {
    return `SUP${String(supplierId).padStart(6, '0')}`;
  }

  private getCustomerMigrationHeaders(): string[] {
    return [
      'partner_loan_id',
      'partner_lan_id',
      'lender_type',
      'customer_name',
      'mobile',
      'email',
      'pan',
      'aadhaar_number',
      'company_type',
      'company_name',
      'company_mobile',
      'company_email',
      'company_pan',
      'gst_number',
      'industry_type',
      'annual_turnover',
      'sanction_amount',
      'tenure_months',
      'interest_rate',
      'penal_rate',
      'processing_fee',
      'service_fee',
      'bank_account_number',
      'bank_ifsc_code',
      'bank_name',
      'bank_branch',
      'bank_type',
      'applicant_address',
      'applicant_city',
      'applicant_state',
      'applicant_pincode',
      'applicant_address_ownership',
      'company_address',
      'company_city',
      'company_state',
      'company_pincode',
      'company_address_ownership',
      ...this.buildIndexedHeaders('co_applicant', this.coApplicantMigrationFields),
      ...this.buildIndexedHeaders('address', this.addressMigrationFields),
      ...this.buildIndexedHeaders('contact_person', this.contactPersonMigrationFields),
    ];
  }

  private getInvoiceMigrationHeaders(): string[] {
    return [
      'partner_lan_id',
      'invoice_number',
      'invoice_date',
      'invoice_amount',
      'disbursement_amount',
      'disbursement_utr',
      'disbursement_date',
      'invoice_due_date',
      'partner_supplier_id',
      'supplier_name',
      'supplier_gst_number',
      'supplier_pan_number',
      'supplier_email',
      'supplier_mobile',
      'supplier_address',
      'supplier_bank_account_number',
      'supplier_ifsc_code',
      'supplier_bank_name',
      'supplier_account_holder_name',
      'roi_percentage',
      'penal_charges',
      'service_fee',
      'description',
      'customer_approval_remarks',
      'ops_remarks',
    ];
  }

  private getSupplierMigrationHeaders(): string[] {
    return [
      'partner_lan_id',
      'partner_supplier_id',
      'supplier_name',
      'email',
      'contact_number',
      'address',
      'gst_number',
      'pan_number',
      'bank_account_number',
      'ifsc_code',
      'bank_name',
      'account_holder_name',
      'micr_code',
      'cheque_number',
    ];
  }

  async generateCustomerMigrationTemplateWorkbook(): Promise<Buffer> {
    const customerHeaders = this.getCustomerMigrationHeaders();
    const sampleCustomerRow: Record<string, WorkbookCellValue> = {
      partner_loan_id: 'OLD-LOAN-1001',
      partner_lan_id: 'OLD-LAN-1001',
      lender_type: 'MFL',
      customer_name: 'Rahul Traders',
      mobile: '9876543210',
      email: 'rahul@example.com',
      pan: 'ABCDE1234F',
      aadhaar_number: '123412341234',
      company_type: 'Proprietorship',
      company_name: 'Rahul Traders',
      company_mobile: '9876543210',
      company_email: 'accounts@rahultraders.com',
      company_pan: 'ABCDE1234F',
      gst_number: '27ABCDE1234F1Z5',
      industry_type: 'FMCG',
      annual_turnover: 25000000,
      sanction_amount: 1000000,
      tenure_months: 12,
      interest_rate: 18,
      penal_rate: 24,
      processing_fee: 2,
      service_fee: 0,
      bank_account_number: '123456789012',
      bank_ifsc_code: 'HDFC0001234',
      bank_name: 'HDFC Bank',
      bank_branch: 'Mumbai',
      bank_type: 'Current',
      applicant_address: '12 Market Road',
      applicant_city: 'Mumbai',
      applicant_state: 'Maharashtra',
      applicant_pincode: '400001',
      applicant_address_ownership: 'Owned',
      company_address: '12 Market Road',
      company_city: 'Mumbai',
      company_state: 'Maharashtra',
      company_pincode: '400001',
      company_address_ownership: 'Owned',
      co_applicant_1_name: 'Priya Sharma',
      co_applicant_1_mobile: '9876543211',
      co_applicant_1_email: 'priya@example.com',
      co_applicant_1_pan: 'BCDEF1234G',
      co_applicant_1_aadhaar: '234523452345',
      co_applicant_1_address: '12 Market Road, Mumbai',
      co_applicant_1_gender: 'Female',
      co_applicant_2_name: 'Amit Sharma',
      co_applicant_2_mobile: '9876543212',
      co_applicant_2_email: 'amit@example.com',
      co_applicant_2_pan: 'CDEFG1234H',
      co_applicant_2_aadhaar: '345634563456',
      co_applicant_2_address: '12 Market Road, Mumbai',
      co_applicant_2_gender: 'Male',
      address_1_type: 'Residence',
      address_1_full_address: '12 Market Road',
      address_1_city: 'Mumbai',
      address_1_state: 'Maharashtra',
      address_1_pincode: '400001',
      address_1_ownership: 'Owned',
      address_2_type: 'Shop',
      address_2_full_address: '12 Market Road',
      address_2_city: 'Mumbai',
      address_2_state: 'Maharashtra',
      address_2_pincode: '400001',
      address_2_ownership: 'Owned',
      contact_person_1_name: 'Neha Accounts',
      contact_person_1_mobile: '9876543213',
      contact_person_1_email: 'neha.accounts@example.com',
      contact_person_1_designation: 'Accounts Manager',
      contact_person_1_gender: 'Female',
    };

    return this.createXlsxWorkbook([
      {
        name: 'Customer Upload',
        rows: [
          customerHeaders,
          customerHeaders.map((header) => sampleCustomerRow[header] ?? ''),
        ],
      },
      {
        name: 'Field Guide',
        rows: [
          ['field', 'required', 'notes'],
          ['lender_type', 'yes', 'Matched from live system partners by partner code, LAN prefix, or partner name. Workbook tabs are ignored'],
          ['partner_lan_id', 'no', 'Old partner LAN from source system; invoices can use this when system LAN is not available'],
          ['customer_name', 'no', 'Applicant/proprietor name when available; defaults to Migrated Customer + partner_loan_id'],
          ['mobile', 'no', 'Primary mobile number when available; blank/NA is accepted for old migrated data'],
          ['sanction_amount', 'yes', 'Approved partner sanction limit'],
          ['co_applicant_1_* to co_applicant_5_*', 'no', 'Optional old-data co-applicant details; blank/NA values are ignored'],
          ['address_1_* to address_5_*', 'no', 'Optional customer addresses. Type: Residence, Shop, or Godown. Ownership defaults to Owned when blank'],
          ['contact_person_1_* to contact_person_5_*', 'no', 'Optional contact persons. Name and mobile are required when a contact group is used'],
          ['company_type', 'no', 'Allowed: Proprietorship, Partnership, Pvt Ltd / Ltd, LLP'],
          ['annual_turnover/bank_ifsc_code', 'no', 'Use numeric turnover and 11-character IFSC when available; blank/NA is accepted'],
          ['interest_rate/penal_rate/processing_fee/service_fee', 'no', 'Stored as approved partner sanction terms'],
        ],
      },
    ]);
  }

  async generateSupplierMigrationTemplateWorkbook(): Promise<Buffer> {
    return this.createXlsxWorkbook([
      {
        name: 'Supplier Upload',
        rows: [
          this.getSupplierMigrationHeaders(),
          [
            'OLD-LAN-1001',
            'OLD-SUP-1001',
            'Metro Suppliers',
            'supplier@example.com',
            '9876543220',
            '77 Industrial Area, Mumbai',
            '27ABCDE9999F1Z5',
            'ABCDE9999F',
            '555555555555',
            'ICIC0001234',
            'ICICI Bank',
            'Metro Suppliers',
            '123456789',
            'CHQ-1001',
          ],
        ],
      },
      {
        name: 'Field Guide',
        rows: [
          ['field', 'required', 'notes'],
          ['partner_lan_id', 'yes', 'Old partner LAN from the source system; system LAN is resolved from loan accounts'],
          ['partner_supplier_id', 'yes', 'Old supplier ID from the source system; stored for invoice mapping'],
          ['supplier_name', 'yes', 'Supplier onboarding name; the system generates supplier_code after upload'],
          ['email/contact_number/address', 'no', 'Supplier contact profile details'],
          ['gst_number/pan_number', 'no', 'Supplier GST and PAN when available'],
          ['bank_account_number', 'yes', 'Supplier bank account number'],
          ['ifsc_code', 'yes', '11-character IFSC code'],
          ['bank_name', 'yes', 'Supplier bank name'],
          ['account_holder_name', 'yes', 'Name on supplier bank account'],
          ['micr_code/cheque_number', 'no', 'Optional cheque details'],
        ],
      },
    ]);
  }

  async generateInvoiceMigrationTemplateWorkbook(): Promise<Buffer> {
    return this.createXlsxWorkbook([
      {
        name: 'Invoice Upload',
        rows: [
          this.getInvoiceMigrationHeaders(),
          [
            'OLD-LAN-1001',
            'OLD-INV-1001',
            '2026-06-01',
            100000,
            90000,
            'UTR-OLD-INV-1001',
            '2026-06-05',
            '2026-09-03',
            'OLD-SUP-1001',
            'Metro Suppliers',
            '27ABCDE9999F1Z5',
            'ABCDE9999F',
            'supplier@example.com',
            '9876543220',
            '77 Industrial Area, Mumbai',
            '555555555555',
            'ICIC0001234',
            'ICICI Bank',
            'Metro Suppliers',
            18,
            24,
            0,
            'Migrated old invoice',
            'Migrated customer approval from old system',
            'Migrated and final verified by Ops L2',
          ],
        ],
      },
      {
        name: 'Field Guide',
        rows: [
          ['field', 'required', 'notes'],
          ['partner_lan_id', 'yes', 'Old partner LAN from the source system; system LAN is resolved from loan accounts'],
          ['invoice_number', 'yes', 'Must be unique in the current system'],
          ['invoice_date', 'yes', 'Use YYYY-MM-DD'],
          ['invoice_amount', 'yes', 'Original invoice value'],
          ['disbursement_amount', 'yes', 'Must be greater than zero and not above invoice_amount'],
          ['disbursement_utr', 'yes', 'Must be unique in internal LMS disbursements'],
          ['disbursement_date', 'yes', 'Use YYYY-MM-DD'],
          ['invoice_due_date', 'no', 'Defaults to disbursement_date + 90 days'],
          ['partner_supplier_id', 'yes', 'Old supplier ID from the source system; existing migrated supplier is reused by this ID'],
          ['roi_percentage/penal_charges/service_fee', 'no', 'Defaults from approved customer partner sanction when blank'],
        ],
      },
    ]);
  }

  private validateCustomerMigrationRow(row: ExcelRow): string[] {
    const errors: string[] = [];
    const requiredFields: Array<[string[], string]> = [
      [['lender_type', 'lender_name', 'partner_name', 'lender'], 'lender_type'],
      [['sanction_amount', 'sanctioned_amount'], 'sanction_amount'],
    ];

    requiredFields.forEach(([aliases, label]) => {
      if (!this.getCell(row, aliases)) errors.push(`${label} is required`);
    });

    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      if (!this.hasIndexedGroupData(row, ['address'], index, this.addressMigrationFields)) continue;

      (['type', 'full_address', 'city', 'state', 'pincode'] as const).forEach((field) => {
        if (!this.getIndexedCell(row, ['address'], index, field)) {
          errors.push(`address_${index}_${field} is required`);
        }
      });
    }

    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      if (!this.hasIndexedGroupData(row, ['contact_person', 'contactperson', 'contact'], index, this.contactPersonMigrationFields)) continue;

      (['name', 'mobile'] as const).forEach((field) => {
        if (!this.getIndexedCell(row, ['contact_person', 'contactperson', 'contact'], index, field)) {
          errors.push(`contact_person_${index}_${field} is required`);
        }
      });
    }

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
    if (!this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id'])) {
      errors.push('partner_lan_id is required');
    }
    if (!this.getCell(row, ['partner_supplier_id', 'supplier_partner_id', 'partner_id', 'partner_loan_id'])) {
      errors.push('partner_supplier_id is required');
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

  private validateInvoiceMigrationRow(row: ExcelRow): string[] {
    const errors: string[] = [];
    const requiredFields: Array<[string[], string]> = [
      [['partner_lan_id', 'partner_lan', 'old_lan_id'], 'partner_lan_id'],
      [['partner_supplier_id', 'supplier_partner_id', 'supplier_partner_loan_id', 'partner_id'], 'partner_supplier_id'],
      [['invoice_number'], 'invoice_number'],
      [['invoice_date'], 'invoice_date'],
      [['invoice_amount'], 'invoice_amount'],
      [['disbursement_amount'], 'disbursement_amount'],
      [['disbursement_utr'], 'disbursement_utr'],
      [['disbursement_date'], 'disbursement_date'],
    ];

    requiredFields.forEach(([aliases, label]) => {
      if (!this.getCell(row, aliases)) errors.push(`${label} is required`);
    });

    const invoiceAmount = this.toNumber(this.getCell(row, ['invoice_amount']));
    const disbursementAmount = this.toNumber(this.getCell(row, ['disbursement_amount']));
    if (invoiceAmount === null || invoiceAmount <= 0) {
      errors.push('invoice_amount must be a positive number');
    }
    if (disbursementAmount === null || disbursementAmount <= 0) {
      errors.push('disbursement_amount must be a positive number');
    }
    if (invoiceAmount !== null && disbursementAmount !== null && disbursementAmount > invoiceAmount) {
      errors.push('disbursement_amount cannot exceed invoice_amount');
    }

    [
      ['roi_percentage', 'roi'],
      ['penal_charges', 'penal_rate'],
      ['service_fee'],
    ].forEach((aliases) => {
      const value = this.getCell(row, aliases);
      if (value && this.toNumber(value) === null) {
        errors.push(`${aliases[0]} must be a valid number`);
      }
    });

    try {
      if (this.getCell(row, ['invoice_date'])) this.getDateCell(row, ['invoice_date'], 'invoice_date');
      if (this.getCell(row, ['disbursement_date'])) this.getDateCell(row, ['disbursement_date'], 'disbursement_date');
      if (this.getCell(row, ['invoice_due_date', 'due_date'])) {
        this.getDateCell(row, ['invoice_due_date', 'due_date'], 'invoice_due_date', false);
      }
    } catch (error: any) {
      errors.push(error.message);
    }

    const ifsc = this.getCell(row, ['supplier_ifsc_code', 'supplier_bank_ifsc_code']);
    if (ifsc && ifsc.length !== 11) {
      errors.push('supplier_ifsc_code must be 11 characters');
    }

    return errors;
  }

  private applyIfPresent<T extends object>(target: T, key: keyof T, value: any): void {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      target[key] = value;
    }
  }

  private normalizeMigrationIdentityValue(value: string): string {
    const raw = String(value || '').trim();
    if (!raw || raw === '0' || this.isBlankMigrationValue(raw)) return '';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private normalizeMigrationNameValue(value: string): string {
    const raw = String(value || '').trim();
    if (!raw || raw === '0' || this.isBlankMigrationValue(raw)) return '';

    return raw
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(/[^A-Z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getIdentityCell(row: ExcelRow, aliases: string[]): string {
    return this.normalizeMigrationIdentityValue(this.getCell(row, aliases));
  }

  private getMigrationCoApplicantPans(row: ExcelRow): string[] {
    const pans: string[] = [];

    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      pans.push(
        this.normalizeMigrationIdentityValue(
          this.getIndexedCell(row, ['co_applicant', 'coapplicant'], index, 'pan', [
            'co_applicant_pan',
            'coapplicant_pan',
          ]),
        ),
      );
    }

    return Array.from(new Set(pans.filter(Boolean)));
  }

  private ensureSingleMigrationCustomerMatch(matches: Customer[], matchBy: string): Customer | null {
    const uniqueMatches = Array.from(
      matches.reduce<Map<number, Customer>>((acc, customer) => {
        if (customer?.id) acc.set(customer.id, customer);
        return acc;
      }, new Map()).values(),
    );

    if (uniqueMatches.length > 1) {
      throw new Error(`Multiple customers matched by ${matchBy}; review this row manually`);
    }

    return uniqueMatches[0] || null;
  }

  private async findMigratedCustomerByPanValues(
    manager: EntityManager,
    panValues: string[],
  ): Promise<Customer | null> {
    const uniquePanValues = Array.from(new Set(panValues.filter(Boolean)));
    if (uniquePanValues.length === 0) return null;

    const customerRepo = manager.getRepository(Customer);
    const applicantRepo = manager.getRepository(Applicant);
    const coApplicantRepo = manager.getRepository(CoApplicant);
    const matches: Customer[] = [];

    const customerMatches = await customerRepo
      .createQueryBuilder('customer')
      .where("UPPER(REPLACE(customer.companyPan, ' ', '')) IN (:...panValues)", { panValues: uniquePanValues })
      .orWhere("UPPER(REPLACE(customer.pan, ' ', '')) IN (:...panValues)", { panValues: uniquePanValues })
      .getMany();
    matches.push(...customerMatches);

    const applicantMatches = await applicantRepo
      .createQueryBuilder('applicant')
      .leftJoinAndSelect('applicant.customer', 'customer')
      .where("UPPER(REPLACE(applicant.pan, ' ', '')) IN (:...panValues)", { panValues: uniquePanValues })
      .getMany();
    matches.push(
      ...applicantMatches
        .map((applicant) => applicant.customer)
        .filter((customer): customer is Customer => Boolean(customer)),
    );

    const coApplicantMatches = await coApplicantRepo
      .createQueryBuilder('coApplicant')
      .leftJoinAndSelect('coApplicant.customer', 'customer')
      .where("UPPER(REPLACE(coApplicant.pan, ' ', '')) IN (:...panValues)", { panValues: uniquePanValues })
      .getMany();
    matches.push(
      ...coApplicantMatches
        .map((coApplicant) => coApplicant.customer)
        .filter((customer): customer is Customer => Boolean(customer)),
    );

    return this.ensureSingleMigrationCustomerMatch(matches, 'PAN');
  }

  private async findMigratedCustomerByName(
    manager: EntityManager,
    companyName: string,
    customerName: string,
  ): Promise<Customer | null> {
    const customerRepo = manager.getRepository(Customer);
    const customers = await customerRepo.find();
    const normalizedCompanyName = this.normalizeMigrationNameValue(companyName);
    const normalizedCustomerName = this.normalizeMigrationNameValue(customerName);

    if (normalizedCompanyName) {
      const companyMatches = customers.filter(
        (customer) => this.normalizeMigrationNameValue(customer.companyName || '') === normalizedCompanyName,
      );
      const companyMatch = this.ensureSingleMigrationCustomerMatch(companyMatches, 'company_name');
      if (companyMatch) return companyMatch;
    }

    if (normalizedCustomerName) {
      const customerMatches = customers.filter((customer) =>
        [customer.customerName, customer.name]
          .map((value) => this.normalizeMigrationNameValue(value || ''))
          .includes(normalizedCustomerName),
      );
      return this.ensureSingleMigrationCustomerMatch(customerMatches, 'customer_name');
    }

    return null;
  }

  private async findExistingMigratedCustomer(
    manager: EntityManager,
    row: ExcelRow,
    gstNumber: string,
    companyPan: string,
    pan: string,
    companyName: string,
    customerName: string,
  ): Promise<Customer | null> {
    const customerRepo = manager.getRepository(Customer);

    if (gstNumber) {
      const gstMatches = await customerRepo
        .createQueryBuilder('customer')
        .where("UPPER(REPLACE(customer.gstNumber, ' ', '')) = :gstNumber", { gstNumber })
        .getMany();
      const gstMatch = this.ensureSingleMigrationCustomerMatch(gstMatches, 'gst_number');
      if (gstMatch) return gstMatch;
    }

    const panMatch = await this.findMigratedCustomerByPanValues(manager, [
      companyPan,
      pan,
      ...this.getMigrationCoApplicantPans(row),
    ]);
    if (panMatch) return panMatch;

    return this.findMigratedCustomerByName(manager, companyName, customerName);
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
    index: number,
  ): Promise<CoApplicant | null> {
    const fallbackAliases: Record<string, string[]> = {
      name: ['co_applicant_name', 'coapplicant_name'],
      mobile: ['co_applicant_mobile', 'coapplicant_mobile'],
      email: ['co_applicant_email', 'coapplicant_email'],
      pan: ['co_applicant_pan', 'coapplicant_pan'],
      aadhaar: ['co_applicant_aadhaar', 'coapplicant_aadhaar'],
      address: ['co_applicant_address', 'coapplicant_address'],
      gender: ['co_applicant_gender', 'coapplicant_gender'],
    };
    const hasData = this.hasIndexedGroupData(
      row,
      ['co_applicant', 'coapplicant'],
      index,
      this.coApplicantMigrationFields,
      fallbackAliases,
    );
    if (!hasData && index > 1) return null;

    const repository = manager.getRepository(CoApplicant);
    const prefixes = ['co_applicant', 'coapplicant'];
    const name = this.getIndexedCell(row, prefixes, index, 'name', fallbackAliases.name);
    const mobile = this.getIndexedCell(row, prefixes, index, 'mobile', fallbackAliases.mobile);
    const email = this.getIndexedCell(row, prefixes, index, 'email', fallbackAliases.email);
    const pan = this.getIndexedCell(row, prefixes, index, 'pan', fallbackAliases.pan);
    const aadhaar = this.getIndexedCell(row, prefixes, index, 'aadhaar', fallbackAliases.aadhaar);
    const address = this.getIndexedCell(row, prefixes, index, 'address', fallbackAliases.address);
    const gender = this.normalizeGender(this.getIndexedCell(row, prefixes, index, 'gender', fallbackAliases.gender));

    if (!name && !mobile && !pan && !aadhaar) return null;

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
      applicantIndex: index,
      coApplicantId: savedCoApplicant.id,
    });
    await this.upsertKycDetail(manager, customerId, KYC_TYPES.AADHAAR, aadhaar, userId, {
      applicantType: 'co-applicant',
      applicantIndex: index,
      coApplicantId: savedCoApplicant.id,
      remarks: address,
    });

    return savedCoApplicant;
  }

  private async upsertCustomerAddressFromRow(
    manager: EntityManager,
    customerId: number,
    row: ExcelRow,
    index: number,
  ): Promise<string | null> {
    if (!this.hasIndexedGroupData(row, ['address'], index, this.addressMigrationFields)) return null;

    const addressType = this.normalizeAddressType(this.getIndexedCell(row, ['address'], index, 'type'));

    await this.upsertCustomerAddress(
      manager,
      customerId,
      addressType,
      this.getIndexedCell(row, ['address'], index, 'full_address'),
      this.getIndexedCell(row, ['address'], index, 'city'),
      this.getIndexedCell(row, ['address'], index, 'state'),
      this.getIndexedCell(row, ['address'], index, 'pincode'),
      this.getIndexedCell(row, ['address'], index, 'ownership'),
    );

    return addressType;
  }

  private async upsertContactPersonFromRow(
    manager: EntityManager,
    customerId: number,
    row: ExcelRow,
    index: number,
  ): Promise<ContactPerson | null> {
    const prefixes = ['contact_person', 'contactperson', 'contact'];
    if (!this.hasIndexedGroupData(row, prefixes, index, this.contactPersonMigrationFields)) return null;

    const repository = manager.getRepository(ContactPerson);
    const name = this.getIndexedCell(row, prefixes, index, 'name');
    const mobile = this.getIndexedCell(row, prefixes, index, 'mobile');
    const email = this.getIndexedCell(row, prefixes, index, 'email');
    const designation = this.getIndexedCell(row, prefixes, index, 'designation');
    const gender = this.normalizeGender(this.getIndexedCell(row, prefixes, index, 'gender'));

    let contactPerson = mobile
      ? await repository.findOne({ where: { customerId, mobile } as any })
      : null;
    if (!contactPerson && name) {
      contactPerson = await repository.findOne({ where: { customerId, name } as any });
    }

    if (!contactPerson) {
      contactPerson = repository.create({ customerId } as Partial<ContactPerson>);
    }

    contactPerson.name = name;
    contactPerson.mobile = mobile;
    contactPerson.email = email || contactPerson.email || null;
    contactPerson.designation = designation || contactPerson.designation || null;
    if (gender) contactPerson.gender = gender;

    return repository.save(contactPerson);
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

    const partnerLoanId = this.getCell(row, ['partner_loan_id']);
    const partnerLanId = this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id']) || partnerLoanId;
    const customerName = this.getMigratedCustomerName(row);
    const mobile = this.getCell(row, ['mobile', 'customer_mobile']);
    const email = this.getCell(row, ['email', 'customer_email']);
    const pan = this.getIdentityCell(row, ['pan', 'applicant_pan']);
    const aadhaar = this.getIdentityCell(row, ['aadhaar_number', 'applicant_aadhaar']);
    const companyType = this.normalizeCompanyType(this.getCell(row, ['company_type']));
    const companyName = this.getCell(row, ['company_name']);
    const companyMobile = this.getCell(row, ['company_mobile']);
    const companyEmail = this.getCell(row, ['company_email']);
    const companyPan = this.getIdentityCell(row, ['company_pan']);
    const gstNumber = this.getIdentityCell(row, ['gst_number', 'gst']);
    const lenderType = this.getCell(row, ['lender_type', 'lender_name', 'partner_name', 'lender']);
    const providedLanId = this.getCell(row, ['lan_id', 'lan', 'loan_account_number']);
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

    let customer = await this.findExistingMigratedCustomer(
      manager,
      row,
      gstNumber,
      companyPan,
      pan,
      companyName,
      customerName,
    );

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
    this.applyIfPresent(
      applicant,
      'aadhaarAddress',
      this.getCell(row, ['applicant_address', 'address_line']) ||
        this.getIndexedCell(row, ['address'], 1, 'full_address'),
    );
    await applicantRepo.save(applicant);

    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.PAN, pan, userId);
    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.AADHAAR, aadhaar, userId);
    await this.upsertKycDetail(manager, savedCustomer.id, KYC_TYPES.GST, gstNumber, userId);
    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      await this.upsertCoApplicantFromRow(manager, savedCustomer.id, row, userId, index);
    }

    const savedAddressTypes = new Set<string>();
    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      const addressType = await this.upsertCustomerAddressFromRow(manager, savedCustomer.id, row, index);
      if (addressType) savedAddressTypes.add(addressType);
    }

    for (let index = 1; index <= this.migrationRepeatCount; index += 1) {
      await this.upsertContactPersonFromRow(manager, savedCustomer.id, row, index);
    }

    if (!savedAddressTypes.has(ADDRESS_TYPES.RESIDENCE)) {
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
    }

    if (!savedAddressTypes.has(ADDRESS_TYPES.SHOP)) {
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
    }

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

    let loanAccount = await loanAccountRepo.findOne({
      where: { customerId: savedCustomer.id, lender: lenderCode } as any,
    });
    const isNewLoanAccount = !loanAccount;
    if (!loanAccount) {
      loanAccount = loanAccountRepo.create({
        customerId: savedCustomer.id,
        lanId: await this.resolveCustomerMigrationLanId(manager, partner, providedLanId),
        disbursedAmount: 0,
      } as Partial<LoanAccount>);
    }

    loanAccount.customerId = savedCustomer.id;
    loanAccount.partnerId = partner.id;
    loanAccount.lender = lenderCode;
    loanAccount.partnerLanId = partnerLanId || loanAccount.partnerLanId || null;
    loanAccount.sanctionedAmount = sanctionAmount;
    loanAccount.status = 'active';
    if (isNewLoanAccount) loanAccount.isOnboarded = false;
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

    const partnerLanId = this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id']);
    const partnerSupplierId = this.getCell(row, [
      'partner_supplier_id',
      'supplier_partner_id',
      'partner_id',
      'partner_loan_id',
    ]);
    const supplierName = this.getCell(row, ['supplier_name']);

    const loanAccount = await loanAccountRepo.findOne({ where: { partnerLanId } });
    if (!loanAccount) {
      throw new Error(`Partner LAN ${partnerLanId} was not found in loan accounts`);
    }

    const customer = await customerRepo.findOne({ where: { id: loanAccount.customerId } });
    if (!customer) {
      throw new Error(`Customer for partner LAN ${partnerLanId} was not found`);
    }

    let supplier = partnerSupplierId
      ? await supplierRepo.findOne({ where: { customerId: customer.id, partnerLoanId: partnerSupplierId } as any })
      : null;
    if (!supplier) {
      const supplierGst = this.getCell(row, ['gst_number', 'supplier_gst']);
      if (supplierGst) {
        supplier = await supplierRepo.findOne({ where: { customerId: customer.id, gstNumber: supplierGst } as any });
      }
    }

    const isNewSupplier = !supplier;
    if (!supplier) {
      supplier = supplierRepo.create({
        supplierCode: `SUP-TEMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        customerId: customer.id,
        partnerLoanId: partnerSupplierId,
      } as Partial<Supplier>);
    }

    supplier.customerId = customer.id;
    supplier.partnerLoanId = partnerSupplierId;
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
    if (isNewSupplier) {
      savedSupplier.supplierCode = this.buildGeneratedSupplierCode(savedSupplier.id);
      await supplierRepo.save(savedSupplier);
    }

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
      partnerLoanId: partnerSupplierId,
    };
  }

  private async getApprovedSanctionForLoan(
    manager: EntityManager,
    customerId: number,
    loanAccount: LoanAccount,
  ): Promise<CreditSanction | null> {
    const partnerCode = String(loanAccount.partner?.code || loanAccount.lender || '').trim().toUpperCase();
    if (!partnerCode) return null;

    return manager.getRepository(CreditSanction).findOne({
      where: {
        customerId,
        partner: partnerCode,
        status: 'approved',
      } as any,
      order: { createdAt: 'DESC' },
    });
  }

  private async upsertSupplierBankFromInvoiceRow(
    manager: EntityManager,
    supplierId: number,
    row: ExcelRow,
  ): Promise<void> {
    const bankAccountNumber = this.getCell(row, ['supplier_bank_account_number', 'bank_account_number']);
    const ifscCode = this.getCell(row, ['supplier_ifsc_code', 'supplier_bank_ifsc_code', 'ifsc_code']).toUpperCase();
    const bankName = this.getCell(row, ['supplier_bank_name', 'bank_name']);
    const accountHolderName = this.getCell(row, ['supplier_account_holder_name', 'account_holder_name']);
    const hasAnyBankField = [bankAccountNumber, ifscCode, bankName, accountHolderName].some(Boolean);

    if (!hasAnyBankField) return;
    if (!bankAccountNumber || !ifscCode || !bankName || !accountHolderName) {
      throw new Error('All supplier bank fields are required when any supplier bank field is provided');
    }

    const supplierBankRepo = manager.getRepository(SupplierBankDetail);
    let bankDetail = await supplierBankRepo.findOne({ where: { supplierId } });
    if (!bankDetail) {
      bankDetail = supplierBankRepo.create({ supplierId } as Partial<SupplierBankDetail>);
    }

    bankDetail.bankAccountNumber = bankAccountNumber;
    bankDetail.ifscCode = ifscCode;
    bankDetail.bankName = bankName;
    bankDetail.accountHolderName = accountHolderName;
    bankDetail.micrCode = this.getCell(row, ['supplier_micr_code', 'micr_code']) || bankDetail.micrCode || '';
    bankDetail.chequeNumber = this.getCell(row, ['supplier_cheque_number', 'cheque_number']) || bankDetail.chequeNumber || '';
    await supplierBankRepo.save(bankDetail);
  }

  private async resolveOrCreateMigratedInvoiceSupplier(
    manager: EntityManager,
    row: ExcelRow,
    customerId: number,
    userId: number,
  ): Promise<Supplier> {
    const supplierRepo = manager.getRepository(Supplier);
    const workflowRepo = manager.getRepository(CaseWorkflow);
    const historyRepo = manager.getRepository(CaseStatusHistory);

    const supplierCode = this.getCell(row, ['supplier_code']);
    const supplierPartnerId = this.getCell(row, [
      'supplier_partner_id',
      'partner_supplier_id',
      'supplier_partner_loan_id',
      'partner_id',
    ]);
    const supplierName = this.getCell(row, ['supplier_name']);
    const supplierGst = this.getCell(row, ['supplier_gst_number', 'supplier_gst']);
    const supplierPan = this.getCell(row, ['supplier_pan_number', 'supplier_pan']);

    let supplier: Supplier | null = null;
    if (supplierPartnerId) {
      supplier = await supplierRepo.findOne({ where: { customerId, partnerLoanId: supplierPartnerId } as any });
    }

    if (!supplier && supplierCode) {
      supplier = await supplierRepo.findOne({ where: { supplierCode } });
      if (supplier && supplier.customerId !== customerId) {
        throw new Error(`Supplier code ${supplierCode} belongs to another customer`);
      }
    }

    if (!supplier && supplierGst) {
      supplier = await supplierRepo.findOne({ where: { customerId, gstNumber: supplierGst } as any });
    }

    if (!supplier && supplierName) {
      supplier = await supplierRepo.findOne({ where: { customerId, supplierName } as any });
    }

    const isNewSupplier = !supplier;
    if (!supplier) {
      if (!supplierName) {
        throw new Error('supplier_name is required when supplier is not already onboarded');
      }

      supplier = supplierRepo.create({
        customerId,
        supplierCode: supplierCode || `SUP-MIG-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        partnerLoanId: supplierPartnerId || null,
        supplierName,
        email: '',
        contactNumber: '',
        status: 'COMPLETED',
        isActive: true,
        createdByUserId: userId,
      } as Partial<Supplier>);
    }

    supplier.customerId = customerId;
    supplier.partnerLoanId = supplierPartnerId || supplier.partnerLoanId || null;
    supplier.supplierName = supplierName || supplier.supplierName;
    supplier.email = this.getCell(row, ['supplier_email', 'email']) || supplier.email || '';
    supplier.contactNumber = this.getCell(row, ['supplier_mobile', 'supplier_contact_number', 'contact_number']) || supplier.contactNumber || '';
    supplier.address = this.getCell(row, ['supplier_address', 'address']) || supplier.address || '';
    supplier.gstNumber = supplierGst || supplier.gstNumber || null as any;
    supplier.panNumber = supplierPan || supplier.panNumber || null as any;
    supplier.status = 'COMPLETED';
    supplier.isActive = true;
    supplier.createdByUserId = supplier.createdByUserId || userId;

    const savedSupplier = await supplierRepo.save(supplier);
    if (isNewSupplier && !supplierCode) {
      savedSupplier.supplierCode = this.buildGeneratedSupplierCode(savedSupplier.id);
      await supplierRepo.save(savedSupplier);
    }

    await this.upsertSupplierBankFromInvoiceRow(manager, savedSupplier.id, row);

    let workflow = await workflowRepo.findOne({
      where: { supplierId: savedSupplier.id, workflowType: 'SUPPLIER_ONBOARDING' as any },
    });
    if (!workflow) {
      workflow = workflowRepo.create({
        workflowType: 'SUPPLIER_ONBOARDING',
        customerId,
        supplierId: savedSupplier.id,
      } as Partial<CaseWorkflow>);
    }

    workflow.customerId = customerId;
    workflow.currentStatus = CASE_STATUS.COMPLETED;
    workflow.currentApproverRoleName = 'None';
    workflow.isCompleted = true;
    workflow.completedDate = workflow.completedDate || new Date();
    workflow.remarks = workflow.remarks || 'Supplier migrated through invoice upload';
    await workflowRepo.save(workflow);

    if (isNewSupplier) {
      await historyRepo.save(
        historyRepo.create({
          customerId,
          supplierId: savedSupplier.id,
          caseWorkflowId: workflow.id,
          status: CASE_STATUS.COMPLETED,
          previousStatus: null,
          changedBy: userId,
          remarks: 'Supplier migrated through invoice upload',
        } as any),
      );
    }

    return savedSupplier;
  }

  private async resolveMigratedInvoiceLoanAccount(
    manager: EntityManager,
    row: ExcelRow,
  ): Promise<{ loanAccount: LoanAccount; customer: Customer; lanId: string }> {
    const loanAccountRepo = manager.getRepository(LoanAccount);
    const customerRepo = manager.getRepository(Customer);
    const partnerLanId = this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id']).toUpperCase();

    if (!partnerLanId) {
      throw new Error('partner_lan_id is required');
    }

    const loanAccount = await loanAccountRepo.findOne({
      where: { partnerLanId },
      relations: ['partner'],
    });
    if (!loanAccount) {
      throw new Error(`Partner LAN ${partnerLanId} was not found`);
    }

    const customer = await customerRepo.findOne({ where: { id: loanAccount.customerId } });
    if (!customer) {
      throw new Error(`Customer for LAN ${loanAccount.lanId} was not found`);
    }
    if (customer.status !== CASE_STATUS.COMPLETED) {
      throw new Error(`Customer for LAN ${loanAccount.lanId} is not completed/onboarded`);
    }

    return { loanAccount, customer, lanId: loanAccount.lanId };
  }

  private async saveMigratedInvoiceRow(
    manager: EntityManager,
    row: ExcelRow,
    userId: number,
  ): Promise<{ invoiceId: number; invoiceNumber: string; lanId: string; customerName: string }> {
    const invoiceRepo = manager.getRepository(Invoice);
    const workflowRepo = manager.getRepository(CaseWorkflow);
    const historyRepo = manager.getRepository(CaseStatusHistory);

    const { loanAccount, customer, lanId } = await this.resolveMigratedInvoiceLoanAccount(manager, row);
    const invoiceNumber = this.getCell(row, ['invoice_number']);
    const invoiceDate = this.getDateCell(row, ['invoice_date'], 'invoice_date')!;
    const invoiceAmount = this.toNumber(this.getCell(row, ['invoice_amount'])) || 0;
    const disbursementAmount = this.toNumber(this.getCell(row, ['disbursement_amount'])) || 0;
    const disbursementUtr = this.getCell(row, ['disbursement_utr']).trim();
    const disbursementDate = this.getDateCell(row, ['disbursement_date'], 'disbursement_date')!;
    const invoiceDueDate =
      this.getDateCell(row, ['invoice_due_date', 'due_date'], 'invoice_due_date', false) ||
      this.addDays(disbursementDate, 90);

    const existingInvoice = await invoiceRepo.findOne({ where: { invoiceNumber } });
    if (existingInvoice) {
      throw new Error(`Invoice number ${invoiceNumber} already exists`);
    }

    const existingDisbursement = await manager.getRepository(LoanDisbursement).findOne({
      where: { disbursementUtr },
    });
    if (existingDisbursement) {
      throw new Error(`Disbursement UTR ${disbursementUtr} already exists in internal LMS`);
    }

    const supplier = await this.resolveOrCreateMigratedInvoiceSupplier(manager, row, customer.id, userId);
    const sanction = await this.getApprovedSanctionForLoan(manager, customer.id, loanAccount);
    const roiPercentage =
      this.toNumber(this.getCell(row, ['roi_percentage', 'roi'])) ??
      Number(sanction?.interestRate || 0);
    const penalCharges =
      this.toNumber(this.getCell(row, ['penal_charges', 'penal_rate'])) ??
      Number(sanction?.penalCharges || 0);
    const serviceFee =
      this.toNumber(this.getCell(row, ['service_fee'])) ??
      Number(sanction?.serviceFee || 0);
    const sanctionAmount = Number(loanAccount.sanctionedAmount || sanction?.sanctionAmount || 0);

    const invoice = invoiceRepo.create({
      customerId: customer.id,
      loanAccountId: loanAccount.id,
      supplierId: supplier.id,
      invoiceNumber,
      invoiceDate,
      invoiceAmount,
      disbursementAmount,
      utilizedLimit: disbursementAmount,
      unutilizedLimit: Math.max(sanctionAmount - disbursementAmount, 0),
      dueDate: invoiceDueDate,
      description: this.getCell(row, ['description', 'remarks']) || 'Migrated by operations',
      status: 'PENDING_FINAL_OPS_L2_APPROVAL',
      disbursementUtr,
      disbursementDate,
      invoiceDueDate,
      roiPercentage,
      penalCharges,
      serviceFee,
      sanctionAmount,
      customerApprovalStatus: 'approved',
      customerRemarks: this.getCell(row, ['customer_approval_remarks']) || 'Migrated approved invoice',
      customerApprovedAt: new Date(),
      approvedByCustomerId: customer.id,
      approvedVia: 'email',
      createdByUserId: userId,
      isActive: true,
    } as Partial<Invoice>);

    const savedInvoice = await invoiceRepo.save(invoice);
    const workflow = await workflowRepo.save(
      workflowRepo.create({
        workflowType: 'INVOICE_DISCOUNTING',
        customerId: customer.id,
        supplierId: supplier.id,
        invoiceId: savedInvoice.id,
        currentStatus: 'PENDING_FINAL_OPS_L2_APPROVAL',
        currentApproverRoleName: 'OPS_L2',
        remarks: this.getCell(row, ['ops_remarks']) || 'Migrated by operations',
      } as Partial<CaseWorkflow>),
    );

    await historyRepo.save(
      historyRepo.create({
        customerId: customer.id,
        supplierId: supplier.id,
        invoiceId: savedInvoice.id,
        caseWorkflowId: workflow.id,
        status: CASE_STATUS.INVOICE_PENDING_FINAL_OPS_L2_APPROVAL,
        previousStatus: null,
        changedBy: userId,
        remarks: 'Migrated invoice staged for final Ops L2 booking',
      } as any),
    );

    return {
      invoiceId: savedInvoice.id,
      invoiceNumber: savedInvoice.invoiceNumber,
      lanId,
      customerName: customer.customerName || customer.name || customer.companyName || '',
    };
  }

  private async markMigratedInvoiceFinalVerified(
    invoiceId: number,
    userId: number,
    remarks: string,
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const workflowRepo = manager.getRepository(CaseWorkflow);
      const historyRepo = manager.getRepository(CaseStatusHistory);
      const loanAccountRepo = manager.getRepository(LoanAccount);

      const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
      if (!invoice) throw new Error('Invoice not found after internal LMS booking');

      invoice.status = 'ACTIVE';
      invoice.disbursedAmount = Number(invoice.disbursementAmount || 0);
      invoice.disbursedDate = invoice.disbursementDate;
      await invoiceRepo.save(invoice);

      if (invoice.loanAccountId) {
        const loanAccount = await loanAccountRepo.findOne({ where: { id: invoice.loanAccountId } });
        if (loanAccount) {
          const disbursementAmount = Number(invoice.disbursementAmount || 0);
          const existingDisbursed = Number(loanAccount.disbursedAmount || 0);
          const existingUtilized = Number(loanAccount.utilizedLimit || 0);
          loanAccount.disbursedAmount = existingDisbursed + disbursementAmount;
          loanAccount.utilizedLimit = existingUtilized + disbursementAmount;
          loanAccount.unutilizedLimit = Math.max(Number(loanAccount.sanctionedAmount || 0) - Number(loanAccount.utilizedLimit || 0), 0);
          await loanAccountRepo.save(loanAccount);
        }
      }

      const workflow = await workflowRepo.findOne({
        where: { invoiceId, workflowType: 'INVOICE_DISCOUNTING' as any },
      });
      if (workflow) {
        workflow.currentStatus = 'ACTIVE';
        workflow.currentApproverRoleName = 'None';
        workflow.isCompleted = true;
        workflow.completedDate = new Date();
        workflow.remarks = remarks;
        await workflowRepo.save(workflow);

        await historyRepo.save(
          historyRepo.create({
            customerId: invoice.customerId,
            supplierId: invoice.supplierId,
            invoiceId: invoice.id,
            caseWorkflowId: workflow.id,
            status: CASE_STATUS.INVOICE_ACTIVE,
            previousStatus: CASE_STATUS.INVOICE_PENDING_FINAL_OPS_L2_APPROVAL,
            changedBy: userId,
            remarks,
          } as any),
        );
      }
    });
  }

  private async completeMigratedCustomerLocally(customerId: number): Promise<{ success: boolean; message: string }> {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found for local migration completion');

    const loanAccounts = await this.loanAccountRepository.find({
      where: { customerId, status: 'active', isOnboarded: false },
    });

    if (loanAccounts.length === 0) {
      const alreadyOnboardedLoanAccount = await this.loanAccountRepository.findOne({
        where: { customerId, status: 'active', isOnboarded: true } as any,
      });
      if (alreadyOnboardedLoanAccount) {
        return {
          success: true,
          message: 'Customer already available in local loan management',
        };
      }
      throw new Error('No active loan accounts found for local migration completion');
    }

    await this.loanAccountRepository.update(
      { id: In(loanAccounts.map((loanAccount) => loanAccount.id)) },
      { isOnboarded: true },
    );

    return {
      success: true,
      message: 'Customer saved in local loan management successfully',
    };
  }

  private async completeMigratedSupplierLocally(supplierId: number): Promise<{ success: boolean; message: string }> {
    const supplier = await this.supplierRepository.findOne({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found for local migration completion');

    return {
      success: true,
      message: 'Supplier saved locally successfully',
    };
  }

  private buildMigrationResult(entityName: string, totalRows: number, results: MigrationRowResult[]): MigrationUploadResult {
    const localSaved = results.filter((result) => result.localStatus === 'SAVED').length;
    const locallyProcessed = results.filter((result) => result.localStatus === 'SAVED' && result.lmsStatus === 'SENT').length;
    const failed = results.filter(
      (result) => result.localStatus === 'FAILED' || result.lmsStatus === 'FAILED',
    ).length;

    return {
      success: totalRows > 0 && failed === 0,
      message:
        totalRows === 0
          ? `No ${entityName.toLowerCase()} rows found in the Excel file`
          : `${entityName} migration completed: ${locallyProcessed}/${totalRows} rows processed locally`,
      summary: {
        totalRows,
        localSaved,
        lmsSent: locallyProcessed,
        failed,
      },
      results,
    };
  }

  async migrateCustomersFromExcel(file: Express.Multer.File, userId: number): Promise<MigrationUploadResult> {
    const rows = await this.parseXlsxRows(file);
    const results: MigrationRowResult[] = [];
    const customerResultIndexes = new Map<number, number[]>();
     console.log("Parsed rows", rows);
    for (const row of rows) {
      const rowNumber = Number(row.__rowNumber);
      const name = this.getMigratedCustomerName(row);
      const reference = this.getCell(row, ['partner_loan_id', 'lender_type']) || `Row ${rowNumber}`;
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
          message: `Saved locally with system LAN ${saved.lanId}. Local completion pending.`,
        }) - 1;

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
        const lmsResult = await this.completeMigratedCustomerLocally(customerId);
        resultIndexes.forEach((index) => {
          results[index].lmsStatus = lmsResult.success ? 'SENT' : 'FAILED';
          results[index].message = lmsResult.message;
        });
      } catch (error: any) {
        resultIndexes.forEach((index) => {
          results[index].lmsStatus = 'FAILED';
          results[index].message = error.response?.data
            ? `Local processing error: ${JSON.stringify(error.response.data)}`
            : error.message || 'Failed to complete customer locally';
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
      const reference = this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id']) || `Row ${rowNumber}`;
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
          message: 'Saved locally. Local completion pending.',
        };

        try {
          const lmsResult = await this.completeMigratedSupplierLocally(saved.supplierId);
          result.lmsStatus = lmsResult.success ? 'SENT' : 'FAILED';
          result.message = lmsResult.message;
        } catch (error: any) {
          result.lmsStatus = 'FAILED';
          result.message = error.response?.data
            ? `Local processing error: ${JSON.stringify(error.response.data)}`
            : error.message || 'Failed to complete supplier locally';
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

  async migrateInvoicesFromExcel(file: Express.Multer.File, userId: number): Promise<MigrationUploadResult> {
    const rows = await this.parseXlsxRows(file);
    const results: MigrationRowResult[] = [];

    for (const row of rows) {
      const rowNumber = Number(row.__rowNumber);
      const reference = this.getCell(row, ['invoice_number']) || `Row ${rowNumber}`;
      const customerReference =
        this.getCell(row, ['partner_lan_id', 'partner_lan', 'old_lan_id']) ||
        `Row ${rowNumber}`;
      const validationErrors = this.validateInvoiceMigrationRow(row);

      if (validationErrors.length > 0) {
        results.push({
          rowNumber,
          reference,
          name: customerReference,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: validationErrors.join('; '),
        });
        continue;
      }

      try {
        const saved = await AppDataSource.transaction((manager) =>
          this.saveMigratedInvoiceRow(manager, row, userId),
        );

        const result: MigrationRowResult = {
          rowNumber,
          reference: saved.invoiceNumber,
          name: saved.customerName || saved.lanId,
          localStatus: 'SAVED',
          lmsStatus: 'PENDING',
          localId: saved.invoiceId,
          message: `Saved locally for LAN ${saved.lanId}. Loan management booking pending.`,
        };

        try {
          const booking = await loanManagementService.bookInvoiceDisbursement(saved.invoiceId, userId);
          await this.markMigratedInvoiceFinalVerified(
            saved.invoiceId,
            userId,
            this.getCell(row, ['ops_remarks']) || 'Migrated invoice final verified by Ops L2',
          );

          result.lmsStatus = 'SENT';
          result.message = booking.alreadyBooked
            ? 'Invoice was already booked in local loan management and marked ACTIVE'
            : `Invoice booked in local loan management and marked ACTIVE. Demand ${booking.demand.id}`;
        } catch (error: any) {
          result.lmsStatus = 'FAILED';
          result.message = error.message || 'Loan management booking failed';
        }

        results.push(result);
      } catch (error: any) {
        results.push({
          rowNumber,
          reference,
          name: customerReference,
          localStatus: 'FAILED',
          lmsStatus: 'SKIPPED',
          message: error.message || 'Failed to save invoice locally',
        });
      }
    }

    return this.buildMigrationResult('Invoice', rows.length, results);
  }

  async searchLoanCustomers(search: string, limit = 8): Promise<LoanSearchCustomer[]> {
    const searchTerm = String(search || '').trim();
    if (!searchTerm) return [];

    const take = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const likeSearch = `%${searchTerm}%`;

    const matchingCustomers = await this.customerRepository
      .createQueryBuilder('customer')
      .innerJoin('customer.loanAccounts', 'loanAccount')
      .select('customer.id', 'customerId')
      .addSelect(
        "COALESCE(NULLIF(customer.companyName, ''), NULLIF(customer.customerName, ''), customer.name)",
        'displayName',
      )
      .where(
        `(
          customer.companyName LIKE :search OR
          customer.customerName LIKE :search OR
          customer.name LIKE :search OR
          customer.customerCode LIKE :search OR
          loanAccount.lanId LIKE :search OR
          loanAccount.partnerLanId LIKE :search
        )`,
        { search: likeSearch },
      )
      .groupBy('customer.id')
      .addGroupBy('customer.companyName')
      .addGroupBy('customer.customerName')
      .addGroupBy('customer.name')
      .orderBy('displayName', 'ASC')
      .limit(take)
      .getRawMany();

    const customerIds = matchingCustomers
      .map((row: any) => Number(row.customerId))
      .filter((id: number) => Number.isInteger(id) && id > 0);

    if (customerIds.length === 0) return [];

    const rows = await this.customerRepository
      .createQueryBuilder('customer')
      .innerJoin('customer.loanAccounts', 'loanAccount')
      .leftJoin('loanAccount.partner', 'partner')
      .select('customer.id', 'customerId')
      .addSelect('customer.companyName', 'companyName')
      .addSelect('customer.customerName', 'customerName')
      .addSelect('customer.customerCode', 'customerCode')
      .addSelect('customer.status', 'customerStatus')
      .addSelect('loanAccount.id', 'loanAccountId')
      .addSelect('loanAccount.lanId', 'lanId')
      .addSelect('loanAccount.partnerLanId', 'partnerLanId')
      .addSelect('loanAccount.lender', 'lender')
      .addSelect('loanAccount.status', 'loanStatus')
      .addSelect('loanAccount.sanctionedAmount', 'sanctionedAmount')
      .addSelect('loanAccount.disbursedAmount', 'disbursedAmount')
      .addSelect('partner.name', 'partnerName')
      .where('customer.id IN (:...customerIds)', { customerIds })
      .orderBy('customer.companyName', 'ASC')
      .addOrderBy('customer.customerName', 'ASC')
      .addOrderBy('loanAccount.createdAt', 'DESC')
      .getRawMany();

    const order = new Map(customerIds.map((id, index) => [id, index]));
    const grouped = new Map<number, LoanSearchCustomer>();

    rows.forEach((row: any) => {
      const customerId = Number(row.customerId);
      if (!Number.isInteger(customerId) || customerId <= 0) return;

      if (!grouped.has(customerId)) {
        grouped.set(customerId, {
          customerId,
          companyName: row.companyName || null,
          customerName: row.customerName || null,
          customerCode: row.customerCode || null,
          status: row.customerStatus || null,
          loanAccounts: [],
        });
      }

      const loanAccountId = Number(row.loanAccountId);
      if (Number.isInteger(loanAccountId) && row.lanId) {
        grouped.get(customerId)!.loanAccounts.push({
          id: loanAccountId,
          lanId: String(row.lanId),
          partnerLanId: row.partnerLanId || null,
          lender: row.lender || null,
          partnerName: row.partnerName || null,
          status: row.loanStatus || null,
          sanctionedAmount: row.sanctionedAmount === null || row.sanctionedAmount === undefined
            ? null
            : Number(row.sanctionedAmount),
          disbursedAmount: row.disbursedAmount === null || row.disbursedAmount === undefined
            ? null
            : Number(row.disbursedAmount),
        });
      }
    });

    return Array.from(grouped.values())
      .filter((customer) => customer.loanAccounts.length > 0)
      .sort((a, b) => (order.get(a.customerId) ?? 0) - (order.get(b.customerId) ?? 0));
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
   * Post repayment data into the loan management ledger/allocation engine.
   */
  private async postRepaymentsToLoanManagement(repayments: RepaymentRecord[]): Promise<any> {
    console.log('[Repayment Upload] Posting to loan management:', JSON.stringify({ repayments }, null, 2));

    const results = [];
    for (const repayment of repayments) {
      try {
        const posted = await loanManagementService.recordCollection({
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
      throw new Error(`Loan Management repayment posting failed: ${failed.map((item) => `${item.lan}/${item.collection_utr}: ${item.message}`).join('; ')}`);
    }

    return {
      message: 'Repayments posted to loan management successfully',
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

    // Step 4: Post into local loan management
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.postRepaymentsToLoanManagement(repayments);
      lmsSuccess = true;
    } catch (error: any) {
      console.error('[Repayment Upload] Loan management posting failed:', error.message);
      lmsResponse = { message: error.message };
    }

    // Step 5: Update records based on local loan management response
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

    // Post into local loan management
    let lmsResponse: any;
    let lmsSuccess = false;
    try {
      lmsResponse = await this.postRepaymentsToLoanManagement([repayment]);
      lmsSuccess = true;
    } catch (error: any) {
      console.error(`[Repayment Upload] Retry failed for ID ${id}:`, error.message);
      lmsResponse = { message: error.message };
    }

    // Update record based on local loan management response
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
