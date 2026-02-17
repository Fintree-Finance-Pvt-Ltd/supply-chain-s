import { Router } from 'express';
import { OnboardingController } from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import multer from 'multer';

const router = Router();
const onboardingController = new OnboardingController();
const upload = multer(); // For OCR if needed

router.use(authMiddleware);

// Mobile OTP
router.post('/mobile/send-otp', onboardingController.sendMobileOtp);
router.post('/mobile/verify-otp', onboardingController.verifyMobileOtp);

// Email OTP
router.post('/email/send-otp', onboardingController.sendEmailOtp);
router.post('/email/verify-otp', onboardingController.verifyEmailOtp);

// KYC
router.post('/kyc/pan', onboardingController.verifyPan);
router.post('/kyc/gst', onboardingController.verifyGst);
router.post('/kyc/aadhaar', onboardingController.verifyAadhaar);
router.get('/kyc/status/:customerId', onboardingController.getVerificationStatuses);

// Bureau
router.post('/bureau/check', onboardingController.checkBureau);

// OCR
router.post('/ocr/process', upload.single('file'), onboardingController.processOcr);

export default router;
