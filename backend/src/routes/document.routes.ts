import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { upload } from '../utils/upload';

const router = Router();
const documentController = new DocumentController();

router.use(authMiddleware);

router.post(
  '/upload',
  upload.single('file'),
  documentController.uploadDocument
);

router.get('/customer/:customerId', documentController.getDocumentsByCustomer);
router.get('/download/:id', documentController.downloadDocument);
router.post('/:id/verify', documentController.verifyDocument);
router.patch('/:id/metadata', documentController.updateMetadata);
router.delete('/:id', documentController.deleteDocument);

export default router;



