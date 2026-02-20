import { Router, Request, Response } from 'express';
import { processAadhaarWebhook } from '../services/aadhaarWebhook.service';

const router = Router();

/**
 * Digitap Aadhaar Webhook
 * IMPORTANT: Always return 200
 */
router.post('/aadhaar', async (req: Request, res: Response) => {
    try {
        console.log(
            `📥 Aadhaar Webhook received: txn=${req.body?.transactionId}`
        );

        await processAadhaarWebhook(req.body);
    } catch (err) {
        console.error('Webhook processing error:', err);
        // DO NOT throw
    }

    // ALWAYS return 200
    res.status(200).json({ received: true });
});

export default router;
