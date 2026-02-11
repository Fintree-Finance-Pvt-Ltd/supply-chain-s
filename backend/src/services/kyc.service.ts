import { AppDataSource } from '../config/database';
import { KycDetail, CoApplicant, ContactPerson, CustomerAddress } from '../entities';
import { Repository } from 'typeorm';

export class KycService {
    private kycRepository: Repository<KycDetail>;
    private coApplicantRepository: Repository<CoApplicant>;
    private contactPersonRepository: Repository<ContactPerson>;
    private addressRepository: Repository<CustomerAddress>;

    constructor() {
        this.kycRepository = AppDataSource.getRepository(KycDetail);
        this.coApplicantRepository = AppDataSource.getRepository(CoApplicant);
        this.contactPersonRepository = AppDataSource.getRepository(ContactPerson);
        this.addressRepository = AppDataSource.getRepository(CustomerAddress);
    }

    // ... existing kyc methods ...
    async createKycEntry(data: {
        customerId: number;
        coApplicantId?: number;
        applicantType: string;
        applicantIndex: number;
        kycType: string;
        kycNumber: string;
    }): Promise<KycDetail> {
        // Try to find existing entry
        const where: any = {
            customerId: data.customerId,
            applicantType: data.applicantType,
            applicantIndex: data.applicantIndex,
            kycType: data.kycType
        };

        if (data.coApplicantId) {
            where.coApplicantId = data.coApplicantId;
        }

        let kycEntry = await this.kycRepository.findOne({ where });

        if (kycEntry) {
            kycEntry.kycNumber = data.kycNumber;
            // Optionally update verified status if needed, but usually we'd keep it or reset it
            // kycEntry.verified = false; 
        } else {
            kycEntry = this.kycRepository.create({
                ...data,
                verified: false,
            });
        }

        return await this.kycRepository.save(kycEntry);
    }

    async updateKycEntry(id: number, data: Partial<KycDetail>): Promise<KycDetail> {
        const kycEntry = await this.kycRepository.findOne({ where: { id } });

        if (!kycEntry) {
            throw new Error('KYC entry not found');
        }

        Object.assign(kycEntry, data);
        return await this.kycRepository.save(kycEntry);
    }

    async processCoApplicant(data: {
        id?: number;
        customerId: number;
        name: string;
        mobile: string;
        email?: string;
        gender?: string;
    }): Promise<CoApplicant> {
        let coApp: CoApplicant | null = null;
        if (data.id) {
            coApp = await this.coApplicantRepository.findOne({ where: { id: data.id } });
        }

        if (coApp) {
            Object.assign(coApp, data);
        } else {
            coApp = this.coApplicantRepository.create(data);
        }

        return await this.coApplicantRepository.save(coApp);
    }

    async processContactPerson(data: {
        id?: number;
        customerId: number;
        name: string;
        mobile: string;
        email?: string;
        designation?: string;
        gender?: string;
    }): Promise<ContactPerson> {
        let contact: ContactPerson | null = null;
        if (data.id) {
            contact = await this.contactPersonRepository.findOne({ where: { id: data.id } });
        }

        if (contact) {
            Object.assign(contact, data);
        } else {
            contact = this.contactPersonRepository.create(data);
        }

        return await this.contactPersonRepository.save(contact);
    }

    async processAddress(data: {
        id?: number;
        customerId: number;
        type: string;
        fullAddress: string;
        pincode: string;
        state: string;
        city: string;
    }): Promise<CustomerAddress> {
        let address: CustomerAddress | null = null;
        if (data.id) {
            address = await this.addressRepository.findOne({ where: { id: data.id } });
        }

        if (address) {
            Object.assign(address, data);
        } else {
            address = this.addressRepository.create(data);
        }

        return await this.addressRepository.save(address);
    }

    async deleteContactPerson(id: number): Promise<void> {
        await this.contactPersonRepository.delete(id);
    }

    async deleteAddress(id: number): Promise<void> {
        await this.addressRepository.delete(id);
    }

    // ... existing kyc methods ...
    async verifyKyc(id: number, verifiedBy: number): Promise<KycDetail> {
        const kycEntry = await this.kycRepository.findOne({ where: { id } });

        if (!kycEntry) {
            throw new Error('KYC entry not found');
        }

        kycEntry.verified = true;
        kycEntry.verifiedAt = new Date();
        kycEntry.verifiedBy = verifiedBy;

        return await this.kycRepository.save(kycEntry);
    }

    async getKycByCustomer(customerId: number): Promise<KycDetail[]> {
        return await this.kycRepository.find({
            where: { customerId },
            order: { applicantIndex: 'ASC', createdAt: 'ASC' },
        });
    }

    async getKycByType(
        customerId: number,
        applicantType: string,
        applicantIndex: number,
        kycType: string,
        coApplicantId?: number
    ): Promise<KycDetail | null> {
        const where: any = {
            customerId,
            applicantType,
            applicantIndex,
            kycType,
        };

        if (coApplicantId) {
            where.coApplicantId = coApplicantId;
        }

        return await this.kycRepository.findOne({ where });
    }

    async deleteKycEntry(id: number): Promise<void> {
        const kycEntry = await this.kycRepository.findOne({ where: { id } });

        if (!kycEntry) {
            throw new Error('KYC entry not found');
        }

        await this.kycRepository.remove(kycEntry);
    }

    async getKycById(id: number): Promise<KycDetail | null> {
        return await this.kycRepository.findOne({ where: { id } });
    }
}
