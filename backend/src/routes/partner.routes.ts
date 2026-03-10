import { Router } from 'express';
import { partnerController } from '../controllers/partner.controller';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = Router();

/**
 * Partner Management Routes
 * All routes require ADMIN role
 */

// Public routes (no auth for now - can be secured later)
router.post('/', partnerController.create.bind(partnerController));
router.get('/', adminMiddleware, partnerController.getAll.bind(partnerController));
router.get('/active', partnerController.getActive.bind(partnerController));
router.get('/:id', adminMiddleware, partnerController.getById.bind(partnerController));
router.put('/:id', adminMiddleware, partnerController.update.bind(partnerController));
router.delete('/:id', adminMiddleware, partnerController.deactivate.bind(partnerController));

export default router;
