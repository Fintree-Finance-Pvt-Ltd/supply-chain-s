import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CaseWorkflow, Customer } from '../entities';
import { verifyToken, generateToken, JWTPayload } from '../utils/jwt';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * GET /api/debug/customer/:id
 * Public endpoint to get customer without auth (FOR TESTING ONLY)
 */
router.get('/customer/:id', async (req: Request, res: Response) => {
    try {
        const customerRepo = AppDataSource.getRepository(Customer);
        const customer = await customerRepo.findOne({
            where: { id: Number(req.params.id) },
            relations: ['documents', 'addresses', 'coApplicants', 'contactPersons']
        });
        
        if (!customer) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        
        res.json({ success: true, data: customer });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/debug/verify-token
 * Debug endpoint to verify a token and return its payload
 */
router.post('/verify-token', (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            res.status(400).json({ success: false, message: 'Token is required' });
            return;
        }
        
        const decoded = verifyToken(token) as JWTPayload;
        
        res.json({
            success: true,
            data: {
                payload: decoded,
                message: 'Token is valid'
            }
        });
    } catch (error: any) {
        res.status(401).json({
            success: false,
            message: error.message || 'Invalid token',
            errorType: error.name
        });
    }
});

/**
 * POST /api/debug/generate-test-token
 * Generate a test token for debugging
 */
router.post('/generate-test-token', authMiddleware, (req: Request, res: Response) => {
    try {
        const testPayload: JWTPayload = {
            userId: req.userId!,
            email: req.user?.email || 'test@test.com',
            role: req.userRole || 'ADMIN'
        };
        
        const token = generateToken(testPayload);
        
        res.json({
            success: true,
            data: {
                token,
                payload: testPayload,
                message: 'Test token generated successfully'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

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
