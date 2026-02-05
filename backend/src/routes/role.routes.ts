import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = Router();
const roleController = new RoleController();

// All routes require authentication
router.use(authMiddleware);

// Admin only routes
router.post('/', adminMiddleware, roleController.createRole);
router.get('/', adminMiddleware, roleController.getRoles);
router.get('/:id', adminMiddleware, roleController.getRoleById);
router.put('/:id', adminMiddleware, roleController.updateRole);
router.delete('/:id', adminMiddleware, roleController.deleteRole);
router.patch('/:id/toggle-status', adminMiddleware, roleController.toggleRoleStatus);
router.post('/assign-permission', adminMiddleware, roleController.assignPermission);
router.post('/remove-permission', adminMiddleware, roleController.removePermission);

export default router;
