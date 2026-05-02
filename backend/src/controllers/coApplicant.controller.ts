import { Request, Response } from 'express';
import { CoApplicantService } from '../services/coApplicant.service';

export class CoApplicantController {
    private coApplicantService: CoApplicantService;

    constructor() {
        this.coApplicantService = new CoApplicantService();
    }

    createCoApplicant = async (req: Request, res: Response): Promise<void> => {
        try {
            const coApp = await this.coApplicantService.createCoApplicant(req.body);
            res.status(201).json({
                success: true,
                data: coApp,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to create co-applicant',
            });
        }
    };

    updateCoApplicant = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const coApp = await this.coApplicantService.updateCoApplicant(Number(id), req.body);
            res.json({
                success: true,
                data: coApp,
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message || 'Failed to update co-applicant',
            });
        }
    };

    getCoApplicantsByCustomer = async (req: Request, res: Response): Promise<void> => {
        try {
            const customerId = Number(req.params.customerId || req.params.id);

            if (!Number.isInteger(customerId) || customerId <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid customer ID',
                });
                return;
            }

            const coApplicants = await this.coApplicantService.getCoApplicantsByCustomer(customerId);
            res.json({
                success: true,
                data: coApplicants,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch co-applicants',
            });
        }
    };

    // deleteCoApplicant = async (req: Request, res: Response): Promise<void> => {
    //     try {
    //         const { id } = req.params;
    //         await this.coApplicantService.deleteCoApplicant(Number(id));
    //         res.json({
    //             success: true,
    //             message: 'Co-applicant deleted successfully',
    //         });
    //     } catch (error: any) {
    //         res.status(400).json({
    //             success: false,
    //             message: error.message || 'Failed to delete co-applicant',
    //         });
    //     }
    // };

    deleteCoApplicant = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);

        // ✅ validation
        if (!id || isNaN(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid co-applicant ID',
            });
            return;
        }

        await this.coApplicantService.deleteCoApplicant(id);

        res.json({
            success: true,
            message: 'Co-applicant deleted successfully',
        });

    } catch (error: any) {
        console.error('Delete Co-Applicant Error:', error);

        res.status(400).json({
            success: false,
            message: error.message || 'Failed to delete co-applicant',
        });
    }
};

    findOrCreate = async (req: Request, res: Response): Promise<void> => {
        try {
            const { customerId, name, mobile, email, gender } = req.body;
            const coApp = await this.coApplicantService.findOrCreate(
                Number(customerId),
                name,
                mobile,
                email,
                gender
            );
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
}
