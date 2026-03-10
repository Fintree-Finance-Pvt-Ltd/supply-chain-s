import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { generateToken, JWTPayload } from '../utils/jwt';

const router = Router();
const authController = new AuthController();

router.post('/login', authController.login);

// Debug endpoint - generate test token (REMOVE IN PRODUCTION)
router.get('/test-token', (req: Request, res: Response) => {
  const testPayload: JWTPayload = {
    userId: 1,
    email: 'test@fintree.com',
    role: 'CEO'
  };
  const token = generateToken(testPayload);
  res.json({
    success: true,
    data: {
      token,
      payload: testPayload,
      message: 'Test token generated - use this in Authorization header'
    }
  });
});

router.post('/logout', authMiddleware, authController.logout);

export default router;


