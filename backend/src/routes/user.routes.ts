import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authMiddleware);

// Admin only routes
router.post('/', adminMiddleware, userController.createUser);
router.get('/', adminMiddleware, userController.getUsers);
router.get('/:id', adminMiddleware, userController.getUserById);
router.put('/:id', adminMiddleware, userController.updateUser);
router.delete('/:id', adminMiddleware, userController.deleteUser);
router.patch('/:id/toggle-status', adminMiddleware, userController.toggleUserStatus);
router.post('/assign-role', adminMiddleware, userController.assignRole);
router.post('/remove-role', adminMiddleware, userController.removeRole);

export default router;



