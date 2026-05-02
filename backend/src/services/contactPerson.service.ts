import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ContactPerson } from '../entities';

export class ContactPersonService {
  private contactPersonRepository: Repository<ContactPerson>;

  constructor() {
    this.contactPersonRepository = AppDataSource.getRepository(ContactPerson);
  }

  async getContactPersonsByCustomer(customerId: number): Promise<ContactPerson[]> {
    return await this.contactPersonRepository.find({
      where: { customerId },
      select: {
        id: true,
        customerId: true,
        name: true,
        mobile: true,
        email: true,
        designation: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'ASC' },
    });
  }
}
