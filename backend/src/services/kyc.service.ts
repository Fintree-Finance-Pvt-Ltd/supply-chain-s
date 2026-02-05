import { AppDataSource } from '../config/database';
import { KycDetail } from '../entities';
import { Repository } from 'typeorm';

export class KycService {
    private kycRepository: Repository<KycDetail>;

    constructor() {
        this.kycRepository = AppDataSource.getRepository(KycDetail);
    }

    async createKycEntry(data: {
        customerId: number;
        applicantType: string;
        applicantIndex: number;
        kycType: string;
        kycNumber: string;
    }): Promise<KycDetail> {
        const kycEntry = this.kycRepository.create({
            ...data,
            verified: false,
        });

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
        kycType: string
    ): Promise<KycDetail | null> {
        return await this.kycRepository.findOne({
            where: {
                customerId,
                applicantType,
                applicantIndex,
                kycType,
            },
        });
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
