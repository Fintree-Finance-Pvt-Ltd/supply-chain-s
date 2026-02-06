import { AppDataSource } from '../config/database';
import { CoApplicant } from '../entities';
import { Repository } from 'typeorm';

export class CoApplicantService {
    private coApplicantRepository: Repository<CoApplicant>;

    constructor() {
        this.coApplicantRepository = AppDataSource.getRepository(CoApplicant);
    }

    async createCoApplicant(data: {
        customerId: number;
        name: string;
        mobile: string;
        email?: string;
        gender?: string;
    }): Promise<CoApplicant> {
        const coApp = this.coApplicantRepository.create(data);
        return await this.coApplicantRepository.save(coApp);
    }

    async updateCoApplicant(id: number, data: Partial<CoApplicant>): Promise<CoApplicant> {
        const coApp = await this.coApplicantRepository.findOne({ where: { id } });

        if (!coApp) {
            throw new Error('Co-applicant not found');
        }

        Object.assign(coApp, data);
        return await this.coApplicantRepository.save(coApp);
    }

    async getCoApplicantsByCustomer(customerId: number): Promise<CoApplicant[]> {
        return await this.coApplicantRepository.find({
            where: { customerId },
            relations: ['kycDetails', 'documents'],
        });
    }

    async deleteCoApplicant(id: number): Promise<void> {
        const coApp = await this.coApplicantRepository.findOne({ where: { id } });

        if (!coApp) {
            throw new Error('Co-applicant not found');
        }

        await this.coApplicantRepository.remove(coApp);
    }

    async findOrCreate(customerId: number, name: string, mobile: string, email?: string, gender?: string): Promise<CoApplicant> {
        let coApp = await this.coApplicantRepository.findOne({
            where: { customerId, mobile }
        });

        if (coApp) {
            coApp.name = name;
            coApp.email = email ?? null;
            coApp.gender = gender ?? coApp.gender;
            return await this.coApplicantRepository.save(coApp);
        }

        return await this.createCoApplicant({ customerId, name, mobile, email, gender });
    }
}
