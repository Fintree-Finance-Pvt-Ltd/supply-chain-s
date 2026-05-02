import { Request, Response } from 'express';
import { ContactPersonService } from '../services/contactPerson.service';

export class ContactPersonController {
  private contactPersonService: ContactPersonService;

  constructor() {
    this.contactPersonService = new ContactPersonService();
  }

  getContactPersonsByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.id || req.params.customerId);

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const contactPersons = await this.contactPersonService.getContactPersonsByCustomer(customerId);

      res.json({
        success: true,
        data: contactPersons,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch contact persons',
      });
    }
  };
}
