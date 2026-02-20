import { IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { KycVerificationStatus, KycStatus, KycOwnerType } from '../entities/KycVerificationStatus';
import { BureauService } from '../integrations/bureau/bureau.service';

export class KycBureauRunner {
    private kycRepo = AppDataSource.getRepository(KycVerificationStatus);
    private bureauService = new BureauService();

    async runBureauForOwner(
        customerId: number,
        ownerType: KycOwnerType.APPLICANT | KycOwnerType.CO_APPLICANT,
        applicantId?: number,
        coApplicantId?: number
    ) {
        const kyc = await this.kycRepo.findOne({
            where: {
                customerId,
                ownerType,
                applicantId: applicantId ?? IsNull(),
                coApplicantId: coApplicantId ?? IsNull(),
            } as any,
            relations: ['applicant', 'coApplicant'],
        });

        if (!kyc) {
            throw new Error('KYC row not found');
        }

        if (
            kyc.panStatus !== KycStatus.VERIFIED ||
            kyc.aadhaarStatus !== KycStatus.VERIFIED
        ) {
            throw new Error('PAN and Aadhaar must be verified before Bureau');
        }

        if (kyc.bureauStatus === KycStatus.VERIFIED) {
            return { success: false, message: 'Bureau already completed' };
        }

        /* -------------------------------
           Build Bureau Input
        -------------------------------- */

        const aadhaarResp = kyc.aadhaarWebhookResponse?.data || {};
        const addr = aadhaarResp.address || {};

        const bureauInput = {
            firstName: kyc.firstName || aadhaarResp.name?.split(' ')[0] || '',
            lastName:
                kyc.lastName ||
                aadhaarResp.name?.split(' ').slice(1).join(' ') ||
                '',
            gender: aadhaarResp.gender || '',
            dob: kyc.aadhaarDob,
            pan_number: kyc.panApiResponse?.pan || '',
            mobile_number:
                ownerType === KycOwnerType.APPLICANT
                    ? kyc.applicant?.mobile
                    : kyc.coApplicant?.mobile,
            current_address: kyc.aadhaarAddress || '',
            current_village_city: addr.vtc || addr.loc || addr.dist || '',
            current_state: addr.state || '',
            current_pincode: addr.pc || '',
            loan_amount: 1,
            loan_tenure: 5,
        };

        /* -------------------------------
           Run Bureau
        -------------------------------- */

        kyc.bureauStatus = KycStatus.INITIATED;
        kyc.bureauApiRequest = bureauInput;
        await this.kycRepo.save(kyc);

        const bureauResp = await this.bureauService.runBureau(bureauInput);

        kyc.bureauApiResponse = bureauResp;
        kyc.bureauStatus = bureauResp.success
            ? KycStatus.VERIFIED
            : KycStatus.FAILED;

        await this.kycRepo.save(kyc);

        return bureauResp;
    }
}
