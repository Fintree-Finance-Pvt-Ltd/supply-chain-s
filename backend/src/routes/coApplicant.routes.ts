import { Router } from 'express';
import { CoApplicantController } from '../controllers/coApplicant.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const coApplicantController = new CoApplicantController();

// All routes require authentication
router.use(authMiddleware);

router.post('/', coApplicantController.createCoApplicant);
router.post('/find-or-create', coApplicantController.findOrCreate);
router.get('/customer/:customerId', coApplicantController.getCoApplicantsByCustomer);
router.put('/:id', coApplicantController.updateCoApplicant);
router.delete('/:id', coApplicantController.deleteCoApplicant);

export default router;
