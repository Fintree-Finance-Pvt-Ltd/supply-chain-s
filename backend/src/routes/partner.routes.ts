import { Router } from 'express';
import { partnerController } from '../controllers/partner.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = Router();

/**
 * Partner Management Routes
 * Admin can manage partner records. Authenticated workflow users can read
 * the active partner list used by sanction and approval screens.
 */

router.use(authMiddleware);

router.get('/active', partnerController.getActive.bind(partnerController));
router.post('/', adminMiddleware, partnerController.create.bind(partnerController));
router.get('/', adminMiddleware, partnerController.getAll.bind(partnerController));
router.get('/:id', adminMiddleware, partnerController.getById.bind(partnerController));
router.put('/:id', adminMiddleware, partnerController.update.bind(partnerController));
router.delete('/:id', adminMiddleware, partnerController.deactivate.bind(partnerController));

export default router;
