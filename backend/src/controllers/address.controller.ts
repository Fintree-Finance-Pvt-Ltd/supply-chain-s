import { Request, Response } from 'express';
import { AddressService } from '../services/address.service';

export class AddressController {
  private addressService: AddressService;

  constructor() {
    this.addressService = new AddressService();
  }

  getAddressesByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = Number(req.params.id || req.params.customerId);

      if (!Number.isInteger(customerId) || customerId <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID',
        });
        return;
      }

      const addresses = await this.addressService.getAddressesByCustomer(customerId);

      res.json({
        success: true,
        data: addresses,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch addresses',
      });
    }
  };
}
