import { AppDataSource } from '../config/database';
import { LanSequence } from '../entities/LanSequence';
import { Partner, PARTNER_STATUS } from '../entities/Partner';

/**
 * LAN Generator Service
 * Provides transaction-safe LAN (Loan Account Number) generation
 * Uses SELECT FOR UPDATE to prevent race conditions
 * Now uses dynamic Partner table instead of hardcoded values
 */
export class LanGeneratorService {
  private sequenceRepository = AppDataSource.getRepository(LanSequence);
  private partnerRepository = AppDataSource.getRepository(Partner);

  /**
   * Get partner by code (case-insensitive)
   * @param code - Partner code (FFPL, MFL, KITE, etc.)
   */
  async getPartnerByCode(code: string): Promise<Partner | null> {
    return await this.partnerRepository.findOne({
      where: { code: code.toUpperCase() },
    });
  }

  /**
   * Get all active partners
   */
  async getActivePartners(): Promise<Partner[]> {
    return await this.partnerRepository.find({
      where: { status: PARTNER_STATUS.ACTIVE },
    });
  }

  /**
   * Validate if partner is active
   * @param code - Partner code
   */
  async validatePartner(code: string): Promise<Partner> {
    const partner = await this.getPartnerByCode(code);
    if (!partner) {
      throw new Error(`Partner not found: ${code}`);
    }
    if (partner.status !== PARTNER_STATUS.ACTIVE) {
      throw new Error(`Partner is not active: ${code}`);
    }
    return partner;
  }

  /**
   * Generate next LAN in a transaction-safe manner
   * Uses row-level locking to prevent duplicate LANs
   * 
   * @param partnerCode - The partner code (FFPL, MFL, KITE)
   * @returns Generated LAN (e.g., FFPL10000101)
   */
  async getNextLanId(partnerCode: string): Promise<string> {
    // Validate partner exists and is active
    const partner = await this.validatePartner(partnerCode);
    const lender = partner.code;

    // Use transaction to ensure atomicity
    const lanId = await AppDataSource.transaction(async (_manager) => {
      // Get the sequence repository within this transaction
      const seqRepo = AppDataSource.getRepository(LanSequence);

      // SELECT FOR UPDATE - lock the row to prevent concurrent modifications
      const sequence = await seqRepo
        .createQueryBuilder('seq')
        .setLock('pessimistic_write')
        .where('seq.partnerId = :partnerId', { partnerId: partner.id })
        .getOne();

      if (!sequence) {
        // Initialize sequence if not exists - use partner's lanPrefix
        const newSeq = seqRepo.create({
          partnerId: partner.id,
          currentValue: 10000100,
          prefix: partner.lanPrefix,
        });
        await seqRepo.save(newSeq);
        const nextNum = 10000101;
        return partner.lanPrefix + nextNum.toString().padStart(8, '0');
      }

      // Increment the sequence
      sequence.currentValue += 1;
      await seqRepo.save(sequence);

      // Generate LAN with 8-digit padded number
      const lan = sequence.prefix + sequence.currentValue.toString().padStart(8, '0');
      console.log('[LanGenerator] Generated LAN: ' + lan + ' for partner: ' + partner.name + ' (' + lender + ')');
      
      return lan;
    });

    return lanId;
  }

  /**
   * Get current sequence value without incrementing
   * Useful for checking next available LAN
   */
  async getCurrentLanId(partnerCode: string): Promise<string | null> {
    const partner = await this.getPartnerByCode(partnerCode);
    if (!partner) {
      return null;
    }

    const sequence = await this.sequenceRepository.findOne({
      where: { partnerId: partner.id },
    });

    if (!sequence) {
      return null;
    }

    const nextVal = sequence.currentValue + 1;
    return sequence.prefix + nextVal.toString().padStart(8, '0');
  }

  /**
   * Reset sequence (admin only - use with caution)
   */
  async resetSequence(partnerCode: string, startValue: number = 10000101): Promise<void> {
    const partner = await this.getPartnerByCode(partnerCode);
    if (!partner) {
      throw new Error(`Partner not found: ${partnerCode}`);
    }

    await AppDataSource.transaction(async (_manager) => {
      const seqRepo = AppDataSource.getRepository(LanSequence);
      
      const sequence = await seqRepo.findOne({
        where: { partnerId: partner.id },
      });

      if (sequence) {
        sequence.currentValue = startValue - 1;
        await seqRepo.save(sequence);
      }
    });
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use getNextLanId with partner code instead
   */
  async getNextLanIdLegacy(lender: string): Promise<string> {
    // Validate lender against Partner table
    const partner = await this.validatePartner(lender);
    return this.getNextLanId(partner.code);
  }
}
