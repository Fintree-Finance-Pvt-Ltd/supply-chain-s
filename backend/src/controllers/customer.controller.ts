import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  createCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const customer = await this.customerService.createCustomer({
        ...req.body,
        rmId: req.body.rmId ? parseInt(req.body.rmId) : parseInt(req.userId),
      });

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create customer',
      });
    }
  };

  getCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, rmId } = req.query;

      const customers = await this.customerService.getCustomers({
        status: status as string,
        rmId: rmId ? parseInt(rmId as string) : undefined,
      });

      res.json({
        success: true,
        data: customers,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customers',
      });
    }
  };

  getCustomerById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const customer = await this.customerService.getCustomerById(id);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer',
      });
    }
  };

  updateCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const customer = await this.customerService.updateCustomer(id, req.body);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update customer',
      });
    }
  };

  submitCase = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const customer = await this.customerService.updateStatus(
        id,
        'submitted',
        parseInt(req.userId),
        'Case submitted to credit team'
      );

      res.json({
        success: true,
        data: customer,
        message: 'Case submitted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit case',
      });
    }
  };
}

