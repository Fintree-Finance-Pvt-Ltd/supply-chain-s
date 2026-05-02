import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomerAddress } from '../entities';

export class AddressService {
  private addressRepository: Repository<CustomerAddress>;

  constructor() {
    this.addressRepository = AppDataSource.getRepository(CustomerAddress);
  }

  async getAddressesByCustomer(customerId: number): Promise<CustomerAddress[]> {
    return await this.addressRepository.find({
      where: { customerId },
      select: {
        id: true,
        customerId: true,
        type: true,
        ownership: true,
        fullAddress: true,
        pincode: true,
        state: true,
        city: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'ASC' },
    });
  }
}
