import cron from 'node-cron';
import { AppDataSource } from '../config/database';
import { KycVerificationStatus, KycStatus } from '../entities/KycVerificationStatus';
import { Document } from '../entities/Document';
import { generateBureauPdf } from '../utils/bureauPdf.util';

export function startBureauPdfCron() {
  // cron.schedule('*/2 * * * *', async () => {
  //   const kycRepo = AppDataSource.getRepository(KycVerificationStatus);
  //   const docRepo = AppDataSource.getRepository(Document);

  //   const pending = await kycRepo.find({
  //     where: {
  //       bureauStatus: KycStatus.VERIFIED,
  //       is_pdf_generated: false,
  //     },
  //     take: 10,
  //     order: { updatedAt: 'ASC' },
  //   });

  //   console.log(`Bureau PDF Cron: Found ${pending.length} pending items`);

  //   for (const kyc of pending) {
  //     try {
  //       const fileName = `BUREAU_${kyc.id}_${Date.now()}.pdf`;

  //       const { filePath, fileSize } = await generateBureauPdf(
  //         kyc.bureauApiResponse,
  //         fileName,
  //       );

  //       const prefix = kyc.applicantId ? 'applicant_' : (kyc.coApplicantId ? 'coapplicant_' : 'company_');

  //       await docRepo.save({
  //         customerId: kyc.customerId,
  //         applicantId: kyc.applicantId,
  //         coApplicantId: kyc.coApplicantId,
  //         documentType: `${prefix}bureau_report`,
  //         fileName,
  //         filePath,
  //         mimeType: 'application/pdf',
  //         fileSize,
  //         uploadedBy: 2, // or system user
  //         verified: false,
  //         status: 'pending',
  //       });

  //       kyc.is_pdf_generated = true;
  //       await kycRepo.save(kyc);
  //     } catch (err) {
  //       console.error('Bureau PDF cron error:', err);
  //     }
  //   }
  // });
}