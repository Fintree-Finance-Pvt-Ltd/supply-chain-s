import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Partner, PARTNER_STATUS } from '../entities/Partner';
import { LanSequence } from '../entities/LanSequence';

const partnerRepository = () => AppDataSource.getRepository(Partner);
const lanSequenceRepository = () => AppDataSource.getRepository(LanSequence);

/**
 * Partner Controller
 * Handles CRUD operations for partners
 * Only ADMIN role should access these APIs
 */
export class PartnerController {

  /**
   * Create a new partner
   * POST /partners
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, code, lanPrefix, status } = req.body;

      // Validate required fields
      if (!name || !code || !lanPrefix) {
        res.status(400).json({ 
          message: 'Missing required fields: name, code, lanPrefix' 
        });
        return;
      }

      // Check if partner with same code already exists
      const existingPartner = await partnerRepository().findOne({
        where: { code: code.toUpperCase() }
      });

      if (existingPartner) {
        res.status(409).json({ 
          message: `Partner with code ${code} already exists` 
        });
        return;
      }

      // Create new partner
      const partner = partnerRepository().create({
        name,
        code: code.toUpperCase(),
        lanPrefix: lanPrefix.toUpperCase(),
        status: status || PARTNER_STATUS.ACTIVE,
      });

      await partnerRepository().save(partner);

      // Initialize LAN sequence for the new partner
      const lanSequence = lanSequenceRepository().create({
        partnerId: partner.id,
        currentValue: 10000100,
        prefix: partner.lanPrefix,
      });
      await lanSequenceRepository().save(lanSequence);

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

      const partner = await partnerRepository().findOne({
        where: { id: parseInt(id) },
      });

      if (!partner) {
        res.status(404).json({ message: 'Partner not found' });
        return;
      }

      // Update fields if provided
      if (name) partner.name = name;
      if (lanPrefix) partner.lanPrefix = lanPrefix.toUpperCase();
      if (status) {
        if (!Object.values(PARTNER_STATUS).includes(status)) {
          res.status(400).json({ 
            message: `Invalid status. Must be one of: ${Object.values(PARTNER_STATUS).join(', ')}` 
          });
          return;
        }
        partner.status = status;
      }

      await partnerRepository().save(partner);

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

      const partner = await partnerRepository().findOne({
        where: { id: parseInt(id) },
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
   * GET /partners/active/list
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
