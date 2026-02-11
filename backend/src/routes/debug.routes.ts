import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CaseWorkflow, Customer } from '../entities';

const router = Router();

/**
 * GET /api/debug/workflows/ops
 * Debug endpoint to check operations workflows
 */
router.get('/workflows/ops', async (req: Request, res: Response) => {
    try {
        const workflowRepository = AppDataSource.getRepository(CaseWorkflow);

        // Get all workflows with ops_l1_review status
        const opsWorkflows = await workflowRepository.find({
            where: {
                currentStatus: 'ops_l1_review' as any,
            },
            relations: ['customer'],
        });

        // Get workflows by approver role
        const byApproverRole = await workflowRepository.find({
            where: {
                currentApproverRoleName: 'OPERATIONS_TEAM_L1',
            },
            relations: ['customer'],
        });

        // Get all workflows for debugging
        const allWorkflows = await workflowRepository.find({
            relations: ['customer'],
            take: 10,
            order: { id: 'DESC' },
        });

        res.json({
            success: true,
            data: {
                opsL1ReviewStatus: opsWorkflows.map(w => ({
                    id: w.id,
                    customerId: w.customerId,
                    currentStatus: w.currentStatus,
                    currentApproverRoleName: w.currentApproverRoleName,
                    customerName: w.customer?.name || w.customer?.companyName,
                })),
                byApproverRole: byApproverRole.map(w => ({
                    id: w.id,
                    customerId: w.customerId,
                    currentStatus: w.currentStatus,
                    currentApproverRoleName: w.currentApproverRoleName,
                    customerName: w.customer?.name || w.customer?.companyName,
                })),
                recentWorkflows: allWorkflows.map(w => ({
                    id: w.id,
                    customerId: w.customerId,
                    currentStatus: w.currentStatus,
                    currentApproverRoleName: w.currentApproverRoleName,
                    customerName: w.customer?.name || w.customer?.companyName,
                })),
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack,
        });
    }
});

/**
 * GET /api/debug/customers/ops
 * Debug endpoint to check customers in ops status
 */
router.get('/customers/ops', async (req: Request, res: Response) => {
    try {
        const customerRepository = AppDataSource.getRepository(Customer);

        const opsCustomers = await customerRepository.find({
            where: {
                status: 'ops_l1_review' as any,
            },
        });

        res.json({
            success: true,
            data: opsCustomers.map(c => ({
                id: c.id,
                name: c.name,
                companyName: c.companyName,
                status: c.status,
                email: c.email,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
