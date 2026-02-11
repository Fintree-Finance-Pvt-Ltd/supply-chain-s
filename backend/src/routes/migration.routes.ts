import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CaseWorkflow } from '../entities';

const router = Router();

/**
 * POST /api/debug/fix-ops-workflows
 * Fix existing workflows with incorrect OPERATIONS_L1 role name
 */
router.post('/fix-ops-workflows', async (req: Request, res: Response) => {
    try {
        const workflowRepository = AppDataSource.getRepository(CaseWorkflow);

        // Find all workflows with the old incorrect role name
        const workflowsToFix = await workflowRepository.find({
            where: {
                currentApproverRoleName: 'OPERATIONS_L1',
            },
        });

        // Update them to the correct role name
        for (const workflow of workflowsToFix) {
            workflow.currentApproverRoleName = 'OPERATIONS_TEAM_L1';
            await workflowRepository.save(workflow);
        }

        res.json({
            success: true,
            message: `Fixed ${workflowsToFix.length} workflow(s)`,
            data: {
                fixed: workflowsToFix.map(w => ({
                    id: w.id,
                    customerId: w.customerId,
                    oldRole: 'OPERATIONS_L1',
                    newRole: 'OPERATIONS_TEAM_L1',
                })),
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
