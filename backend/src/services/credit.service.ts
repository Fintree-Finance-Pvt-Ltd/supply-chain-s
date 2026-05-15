import { AppDataSource } from '../config/database';
import { CreditSanction, Customer, SanctionLimitHistory, Partner } from '../entities';
import {
  CreditNotepad,
  CREDIT_NOTEPAD_SECTIONS,
  CreditNotepadSection,
} from '../entities/CreditNotepad';
import { ApprovalService } from './approval.service';
import { CustomerService } from './customer.service';
import { CASE_STATUS, APPROVAL_FLOW_TYPES, ROLES } from '../config/constants';
import { Repository } from 'typeorm';

const EDIT_ROLES_BY_NOTEPAD_SECTION: Record<CreditNotepadSection, string[]> = {
  [CREDIT_NOTEPAD_SECTIONS.CREDIT_MAKER]: [
    ROLES.CREDIT_TEAM_L1,
    ROLES.CREDIT_TEAM_L2,
    ROLES.CEO,
  ],
  [CREDIT_NOTEPAD_SECTIONS.CEO_CHECKER]: [ROLES.CEO],
};

const VALID_NOTEPAD_SECTIONS = Object.values(CREDIT_NOTEPAD_SECTIONS);

type SerializedCreditNotepad = {
  id: number | null;
  customerId: number;
  section: CreditNotepadSection;
  sanctionKey: string;
  content: string;
  updatedAt: Date | null;
  updatedByName: string | null;
};

export class CreditService {
  private creditSanctionRepository: Repository<CreditSanction>;
  private creditNotepadRepository: Repository<CreditNotepad>;
  private sanctionHistoryRepository: Repository<SanctionLimitHistory>;
  private partnerRepository: Repository<Partner>;
  private approvalService: ApprovalService;
  private customerService: CustomerService;

  constructor() {
    this.creditSanctionRepository = AppDataSource.getRepository(CreditSanction);
    this.creditNotepadRepository = AppDataSource.getRepository(CreditNotepad);
    this.sanctionHistoryRepository = AppDataSource.getRepository(SanctionLimitHistory);
    this.partnerRepository = AppDataSource.getRepository(Partner);
    this.approvalService = new ApprovalService();
    this.customerService = new CustomerService();
  }

  async createSanction(data: {
    customerId: number;
    sanctionAmount: number;
    tenure: number;
    interestRate: number;
    conditions?: string;
    creditRemarks?: string;
    creditOfficerId: number;
  }): Promise<CreditSanction> {
    // Check if customer exists
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Create credit sanction
    const sanction = this.creditSanctionRepository.create({
      ...data,
      status: 'pending',
    });

    const savedSanction = await this.creditSanctionRepository.save(sanction);

    // Update customer status
    await this.customerService.updateStatus(
      data.customerId,
      CASE_STATUS.CREDIT_APPROVED,
      data.creditOfficerId,
      'Credit sanction created'
    );

    // Create approval instance
    await this.approvalService.createCreditSanctionApproval(
      savedSanction.id,
      APPROVAL_FLOW_TYPES.CREDIT_SANCTION
    );

    return savedSanction;
  }

  async getPendingSanctions(): Promise<CreditSanction[]> {
    return await this.creditSanctionRepository.find({
      where: { status: 'pending' },
      relations: ['customer', 'customer.rm', 'creditOfficer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSanctionById(id: number): Promise<CreditSanction | null> {
    return await this.creditSanctionRepository.findOne({
      where: { id },
      relations: [
        'customer',
        'customer.rm',
        'customer.documents',
        'creditOfficer',
        'approvalInstances',
        'approvalInstances.approvalFlow',
        'approvalInstances.actions',
        'approvalInstances.actions.approver',
      ],
    });
  }

  async updateSanction(
    id: number,
    data: Partial<CreditSanction>
  ): Promise<CreditSanction> {
    const sanction = await this.creditSanctionRepository.findOne({ where: { id } });

    if (!sanction) {
      throw new Error('Credit sanction not found');
    }

    Object.assign(sanction, data);
    return await this.creditSanctionRepository.save(sanction);
  }

  /**
   * Get all sanction limits for a customer based on customerId
   * Returns all available partner sanctions from sanction_limit_history
   * Partner information is now dynamically loaded from the partners table
   */
  async getSanctionLimitsByCustomerId(customerId: number): Promise<SanctionLimitHistory[]> {
    return await this.sanctionHistoryRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all credit sanctions for a customer by customerId
   * Returns partner-specific sanctions from credit_sanctions table
   */
  async getSanctionsByCustomerId(customerId: number): Promise<CreditSanction[]> {
    return await this.creditSanctionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all credit sanctions for a customer by customerId (simple version for non-CREDIT_L1 roles)
   * Returns all sanctions without filtering by partner active status
   * Includes partner name from partners table
   */
  async getSanctionsByCustomerIdSimple(customerId: number): Promise<(CreditSanction & { partnerName?: string })[]> {
    // First get all sanctions
    const sanctions = await this.creditSanctionRepository.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });

    // Get all unique partner codes from sanctions
    const partnerCodes = [...new Set(sanctions.map(s => s.partner).filter(Boolean))];
    
    // Fetch partner names from partners table
    const partners = await this.partnerRepository.find({
      where: partnerCodes.map(code => ({ code })) as any,
    });

    // Create a map of partner code to name
    const partnerMap = new Map(partners.map(p => [p.code, p.name]));

    // Add partnerName to each sanction
    return sanctions.map(s => ({
      ...s,
      partnerName: s.partner ? partnerMap.get(s.partner) : undefined,
    }));
  }

  async getCustomerNotepads(customerId: number) {
    await this.ensureCustomerExists(customerId);

    const notes = await this.creditNotepadRepository.find({
      where: { customerId },
      relations: ['updatedByUser'],
      order: { sanctionKey: 'ASC', section: 'ASC' },
    });

    return notes.reduce(
      (acc, note) => {
        const sanctionKey = note.sanctionKey || 'general';
        if (!acc[sanctionKey]) {
          acc[sanctionKey] = this.createEmptyNotepadSectionMap(
            customerId,
            sanctionKey,
          );
        }

        acc[sanctionKey][note.section] = this.serializeNotepad(note);
        return acc;
      },
      {} as Record<
        string,
        Record<CreditNotepadSection, SerializedCreditNotepad>
      >,
    );
  }

  async upsertCustomerNotepad(
    customerId: number,
    section: string,
    content: unknown,
    sanctionKey: unknown,
    userId: number,
    userRoles: string[],
  ) {
    const normalizedSection = this.validateNotepadSection(section);
    const normalizedSanctionKey = this.normalizeSanctionKey(sanctionKey);
    this.ensureCanEditNotepad(normalizedSection, userRoles);
    await this.ensureCustomerExists(customerId);

    const normalizedContent = this.sanitizeNotepadContent(
      typeof content === 'string' ? content : '',
    );
    let note = await this.creditNotepadRepository.findOne({
      where: {
        customerId,
        section: normalizedSection,
        sanctionKey: normalizedSanctionKey,
      },
    });

    if (!note) {
      note = this.creditNotepadRepository.create({
        customerId,
        section: normalizedSection,
        sanctionKey: normalizedSanctionKey,
        content: normalizedContent,
        createdByUserId: userId,
        updatedByUserId: userId,
      });
    } else {
      note.content = normalizedContent;
      note.updatedByUserId = userId;
    }

    const savedNote = await this.creditNotepadRepository.save(note);
    const savedWithUser = await this.creditNotepadRepository.findOne({
      where: { id: savedNote.id },
      relations: ['updatedByUser'],
    });

    return this.serializeNotepad(savedWithUser || savedNote);
  }

  private async ensureCustomerExists(customerId: number) {
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw new Error('Invalid customer ID');
    }

    const exists = await AppDataSource.getRepository(Customer).exist({
      where: { id: customerId },
    });

    if (!exists) {
      throw new Error('Customer not found');
    }
  }

  private createEmptyNotepadSectionMap(
    customerId: number,
    sanctionKey: string,
  ) {
    return VALID_NOTEPAD_SECTIONS.reduce(
      (acc, section) => {
        acc[section] = {
          id: null,
          customerId,
          section,
          sanctionKey,
          content: '',
          updatedAt: null,
          updatedByName: null,
        };
        return acc;
      },
      {} as Record<CreditNotepadSection, SerializedCreditNotepad>,
    );
  }

  private validateNotepadSection(section: string): CreditNotepadSection {
    const normalizedSection = section as CreditNotepadSection;
    if (!VALID_NOTEPAD_SECTIONS.includes(normalizedSection)) {
      throw new Error('Invalid notepad section');
    }

    return normalizedSection;
  }

  private normalizeSanctionKey(value: unknown) {
    const rawValue = typeof value === 'string' ? value.trim() : '';
    return (rawValue || 'general').slice(0, 50);
  }

  private ensureCanEditNotepad(
    section: CreditNotepadSection,
    userRoles: string[],
  ) {
    const normalizedRoles = userRoles.map((role) => role.toLowerCase());
    const allowedRoles = EDIT_ROLES_BY_NOTEPAD_SECTION[section];
    const hasAccess = allowedRoles.some((role) =>
      normalizedRoles.includes(role),
    );

    if (!hasAccess) {
      throw new Error('You do not have permission to edit this notepad section');
    }
  }

  private sanitizeNotepadContent(content: string) {
    return content
      .replace(/<!--StartFragment-->|<!--EndFragment-->/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/&lt;!--StartFragment--&gt;|&lt;!--EndFragment--&gt;/gi, '')
      .replace(/&lt;!--[\s\S]*?--&gt;/gi, '')
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/&lt;style[\s\S]*?&lt;\/style&gt;/gi, '')
      .replace(/<xml[\s\S]*?>[\s\S]*?<\/xml>/gi, '')
      .replace(/&lt;xml[\s\S]*?&lt;\/xml&gt;/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '')
      .replace(/<\/?o:[^>]*>/gi, '')
      .replace(/<\/?w:[^>]*>/gi, '')
      .replace(/<\/?m:[^>]*>/gi, '')
      .replace(/\/\*\s*Font Definitions\s*\*\/[\s\S]*?\/\*\s*Style Definitions\s*\*\//gi, '')
      .replace(/@font-face\s*\{[\s\S]*?\}/gi, '')
      .replace(/@page\s+[^{]+\{[\s\S]*?\}/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*("|')?\s*javascript:[^"'\s>]*/gi, '');
  }

  private serializeNotepad(note: CreditNotepad): SerializedCreditNotepad {
    return {
      id: note.id,
      customerId: note.customerId,
      section: note.section,
      sanctionKey: note.sanctionKey || 'general',
      content: note.content || '',
      updatedAt: note.updatedAt,
      updatedByName: note.updatedByUser?.name || null,
    };
  }
}



