import { Request, Response } from 'express';
import { Not } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Partner, PARTNER_STATUS } from '../entities/Partner';
import { LanSequence } from '../entities/LanSequence';

const partnerRepository = () => AppDataSource.getRepository(Partner);
const lanSequenceRepository = () => AppDataSource.getRepository(LanSequence);

const normalizeText = (value: unknown): string => String(value || '').trim();
const normalizeCode = (value: unknown): string => normalizeText(value).toUpperCase();
const isValidPartnerStatus = (status: string): status is PARTNER_STATUS =>
  Object.values(PARTNER_STATUS).includes(status as PARTNER_STATUS);

/**
 * Partner Controller
 * Handles CRUD operations for partners
 * ADMIN manages partner records; authenticated workflow users read active partners.
 */
export class PartnerController {

  /**
   * Create a new partner
   * POST /partners
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, code, lanPrefix, status } = req.body;
      const normalizedName = normalizeText(name);
      const normalizedCode = normalizeCode(code);
      const normalizedLanPrefix = normalizeCode(lanPrefix);
      const normalizedStatus = status ? normalizeCode(status) : PARTNER_STATUS.ACTIVE;

      // Validate required fields
      if (!normalizedName || !normalizedCode || !normalizedLanPrefix) {
        res.status(400).json({ 
          message: 'Missing required fields: name, code, lanPrefix' 
        });
        return;
      }

      if (!isValidPartnerStatus(normalizedStatus)) {
        res.status(400).json({
          message: `Invalid status. Must be one of: ${Object.values(PARTNER_STATUS).join(', ')}`,
        });
        return;
      }

      // Check if partner with same code already exists
      const existingPartner = await partnerRepository().findOne({
        where: { code: normalizedCode }
      });

      if (existingPartner) {
        res.status(409).json({ 
          message: `Partner with code ${normalizedCode} already exists` 
        });
        return;
      }

      const existingPrefix = await partnerRepository().findOne({
        where: { lanPrefix: normalizedLanPrefix },
      });

      if (existingPrefix) {
        res.status(409).json({
          message: `Partner with LAN prefix ${normalizedLanPrefix} already exists`,
        });
        return;
      }

      const partner = await AppDataSource.transaction(async (manager) => {
        const partnerRepo = manager.getRepository(Partner);
        const sequenceRepo = manager.getRepository(LanSequence);

        // Create new partner
        const newPartner = partnerRepo.create({
          name: normalizedName,
          code: normalizedCode,
          lanPrefix: normalizedLanPrefix,
          status: normalizedStatus,
        });

        const savedPartner = await partnerRepo.save(newPartner);

        // Initialize LAN sequence for the new partner
        const lanSequence = sequenceRepo.create({
          partnerId: savedPartner.id,
          currentValue: 10000100,
          prefix: savedPartner.lanPrefix,
        });
        await sequenceRepo.save(lanSequence);

        return savedPartner;
      });

      res.status(201).json({
        message: 'Partner created successfully',
        partner,
      });
    } catch (error: any) {
      console.error('[PartnerController] Create error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to create partner' 
      });
    }
  }

  /**
   * Get all partners
   * GET /partners
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const partners = await partnerRepository().find({
        order: { createdAt: 'DESC' },
      });

      res.json({ partners });
    } catch (error: any) {
      console.error('[PartnerController] GetAll error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to fetch partners' 
      });
    }
  }

  /**
   * Get partner by ID
   * GET /partners/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const partner = await partnerRepository().findOne({
        where: { id: parseInt(id) },
      });

      if (!partner) {
        res.status(404).json({ message: 'Partner not found' });
        return;
      }

      res.json({ partner });
    } catch (error: any) {
      console.error('[PartnerController] GetById error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to fetch partner' 
      });
    }
  }

  /**
   * Update partner
   * PUT /partners/:id
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, lanPrefix, status } = req.body;
      const partnerId = parseInt(id, 10);

      if (!partnerId || Number.isNaN(partnerId)) {
        res.status(400).json({ message: 'Partner ID parameter is required and must be a valid number' });
        return;
      }

      const partner = await partnerRepository().findOne({
        where: { id: partnerId },
      });

      if (!partner) {
        res.status(404).json({ message: 'Partner not found' });
        return;
      }

      // Update fields if provided
      if (name !== undefined) {
        const normalizedName = normalizeText(name);
        if (!normalizedName) {
          res.status(400).json({ message: 'Partner name cannot be empty' });
          return;
        }
        partner.name = normalizedName;
      }

      let lanPrefixChanged = false;
      if (lanPrefix !== undefined) {
        const normalizedLanPrefix = normalizeCode(lanPrefix);
        if (!normalizedLanPrefix) {
          res.status(400).json({ message: 'LAN prefix cannot be empty' });
          return;
        }

        const duplicatePrefix = await partnerRepository().findOne({
          where: { lanPrefix: normalizedLanPrefix, id: Not(partner.id) },
        });

        if (duplicatePrefix) {
          res.status(409).json({
            message: `Partner with LAN prefix ${normalizedLanPrefix} already exists`,
          });
          return;
        }

        lanPrefixChanged = partner.lanPrefix !== normalizedLanPrefix;
        partner.lanPrefix = normalizedLanPrefix;
      }

      if (status) {
        const normalizedStatus = normalizeCode(status);
        if (!isValidPartnerStatus(normalizedStatus)) {
          res.status(400).json({ 
            message: `Invalid status. Must be one of: ${Object.values(PARTNER_STATUS).join(', ')}` 
          });
          return;
        }
        partner.status = normalizedStatus;
      }

      await partnerRepository().save(partner);

      if (lanPrefixChanged) {
        const existingSequence = await lanSequenceRepository().findOne({
          where: { partnerId: partner.id },
        });

        if (existingSequence) {
          existingSequence.prefix = partner.lanPrefix;
          await lanSequenceRepository().save(existingSequence);
        } else {
          const lanSequence = lanSequenceRepository().create({
            partnerId: partner.id,
            currentValue: 10000100,
            prefix: partner.lanPrefix,
          });
          await lanSequenceRepository().save(lanSequence);
        }
      }

      res.json({
        message: 'Partner updated successfully',
        partner,
      });
    } catch (error: any) {
      console.error('[PartnerController] Update error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to update partner' 
      });
    }
  }

  /**
   * Deactivate partner (soft delete)
   * DELETE /partners/:id
   */
  async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const partnerId = parseInt(id, 10);

      if (!partnerId || Number.isNaN(partnerId)) {
        res.status(400).json({ message: 'Partner ID parameter is required and must be a valid number' });
        return;
      }

      const partner = await partnerRepository().findOne({
        where: { id: partnerId },
      });

      if (!partner) {
        res.status(404).json({ message: 'Partner not found' });
        return;
      }

      // Soft delete - set status to INACTIVE
      partner.status = PARTNER_STATUS.INACTIVE;
      await partnerRepository().save(partner);

      res.json({
        message: 'Partner deactivated successfully',
        partner,
      });
    } catch (error: any) {
      console.error('[PartnerController] Deactivate error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to deactivate partner' 
      });
    }
  }

  /**
   * Get active partners only
   * GET /partners/active
   */
  async getActive(req: Request, res: Response): Promise<void> {
    try {
      const partners = await partnerRepository().find({
        where: { status: PARTNER_STATUS.ACTIVE },
        order: { name: 'ASC' },
      });

      res.json({ partners });
    } catch (error: any) {
      console.error('[PartnerController] GetActive error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to fetch active partners' 
      });
    }
  }
}

export const partnerController = new PartnerController();
