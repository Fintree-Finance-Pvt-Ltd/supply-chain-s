import { Request, Response } from 'express';
import { KycService } from '../services/kyc.service';

export class KycController {
    private kycService: KycService;

    constructor() {
        this.kycService = new KycService();
    }

    createKyc = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            const { customerId, coApplicantId, applicantType, applicantIndex, kycType, kycNumber } = req.body;

            if (!customerId || !kycType || !kycNumber) {
                res.status(400).json({
                    success: false,
                    message: 'customerId, kycType, and kycNumber are required',
                });
                return;
            }

            const kycEntry = await this.kycService.createKycEntry({
                customerId: Number(customerId),
                coApplicantId: coApplicantId ? Number(coApplicantId) : undefined,
                applicantType: applicantType || 'applicant',
                applicantIndex: applicantIndex !== undefined ? Number(applicantIndex) : 0,
                kycType,
                kycNumber,
            });

            res.status(201).json({
                success: true,
                data: kycEntry,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to create KYC entry',
            });
        }
    };

    updateKyc = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const kycEntry = await this.kycService.updateKycEntry(Number(id), req.body);

            res.json({
                success: true,
                data: kycEntry,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to update KYC entry',
            });
        }
    };

    verifyKyc = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            const { id } = req.params;
            const kycEntry = await this.kycService.verifyKyc(Number(id), req.userId);

            res.json({
                success: true,
                data: kycEntry,
                message: 'KYC verified successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to verify KYC',
            });
        }
    };

    getCustomerKyc = async (req: Request, res: Response): Promise<void> => {
        try {
            const { customerId } = req.params;
            const kycEntries = await this.kycService.getKycByCustomer(Number(customerId));

            res.json({
                success: true,
                data: kycEntries,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch KYC entries',
            });
        }
    };

    getCustomerKycSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const customerId = Number(req.params.id || req.params.customerId);

            if (!Number.isInteger(customerId) || customerId <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid customer ID',
                });
                return;
            }

            const kycSummary = await this.kycService.getKycSummaryByCustomer(customerId);

            res.json({
                success: true,
                data: kycSummary,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch KYC summary',
            });
        }
    };

    deleteKyc = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            await this.kycService.deleteKycEntry(Number(id));

            res.json({
                success: true,
                message: 'KYC entry deleted successfully',
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to delete KYC entry',
            });
        }
    };

    processCoApplicant = async (req: Request, res: Response): Promise<void> => {
        try {
            const coApp = await this.kycService.processCoApplicant(req.body);
            res.json({
                success: true,
                data: coApp,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to process co-applicant',
            });
        }
    };

    processContactPerson = async (req: Request, res: Response): Promise<void> => {
        try {
            const contact = await this.kycService.processContactPerson(req.body);
            res.json({
                success: true,
                data: contact,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to process contact person',
            });
        }
    };

    processAddress = async (req: Request, res: Response): Promise<void> => {
        try {
            const address = await this.kycService.processAddress(req.body);
            res.json({
                success: true,
                data: address,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to process address',
            });
        }
    };

    deleteContactPerson = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            await this.kycService.deleteContactPerson(Number(id));
            res.json({ success: true, message: 'Contact person deleted' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };

    deleteAddress = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            await this.kycService.deleteAddress(Number(id));
            res.json({ success: true, message: 'Address deleted' });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    };
}
