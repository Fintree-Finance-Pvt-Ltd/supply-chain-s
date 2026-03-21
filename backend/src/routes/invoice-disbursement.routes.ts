import { Router, Request, Response } from 'express';
import { invoiceDiscountingService } from '../services/invoice-discounting.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * POST /v1/invoice-disbursement/send-to-lms
 * Send invoice disbursement data from LOS to LMS for validation and processing
 * 
 * Request body:
 * {
 *   "invoiceIds": [1, 2, 3] // Array of invoice IDs to send
 * }
 * 
 * OR:
 * {
 *   "invoiceId": 1 // Single invoice
 * }
 */
router.post('/send-to-lms', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { invoiceIds, invoiceId } = req.body;

    // Validate input
    if (!invoiceIds && !invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Either invoiceId (single) or invoiceIds (array) is required',
      });
    }

    let result;

    if (invoiceIds && Array.isArray(invoiceIds)) {
      // Send multiple invoices to LMS
      result = await invoiceDiscountingService.sendToLMS(invoiceIds);
    } else {
      // Send single invoice to LMS
      const id = invoiceId || (invoiceIds ? invoiceIds[0] : null);
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Invalid invoice ID provided',
        });
      }
      result = await invoiceDiscountingService.sendSingleToLMS(Number(id));
    }

    if (!result.success) {
      // Check for LOS validation errors
      if (result.losValidationErrors && result.losValidationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'LOS validation failed',
          losValidationErrors: result.losValidationErrors,
        });
      }
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send to LMS',
      });
    }

    // Return LMS response
    return res.status(200).json({
      success: true,
      lmsResponse: result.lmsResponse,
    });
  } catch (error: any) {
    console.error('Error sending to LMS:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /v1/invoice-disbursement/validate
 * Validate invoice disbursement data WITHOUT sending to LMS
 * Useful for pre-validation before actual submission
 */
router.post('/validate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { invoiceIds, invoiceId } = req.body;

    if (!invoiceIds && !invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Either invoiceId (single) or invoiceIds (array) is required',
      });
    }

    let result;

    if (invoiceIds && Array.isArray(invoiceIds)) {
      // Transform multiple invoices
      result = await invoiceDiscountingService.transformMultipleInvoicesToLMSPayload(invoiceIds);
    } else {
      // Transform single invoice
      const id = invoiceId || (invoiceIds ? invoiceIds[0] : null);
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Invalid invoice ID provided',
        });
      }
      const transformResult = await invoiceDiscountingService.transformInvoiceToLMSPayload(Number(id));
      if (transformResult.success && transformResult.data) {
        result = { success: true, data: [transformResult.data] };
      } else {
        result = { success: false, errors: [{ invoiceId: Number(id), error: transformResult.error || 'Transform failed' }] };
      }
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error validating invoice disbursement:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /v1/invoice-disbursement/:invoiceId
 * Get transformed invoice disbursement data for a single invoice
 */
router.get('/:invoiceId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invoice ID',
      });
    }

    const result = await invoiceDiscountingService.transformInvoiceToLMSPayload(invoiceId);

    if (!result.success) {
      if (result.validationErrors && result.validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          validationErrors: result.validationErrors,
        });
      }
      return res.status(404).json({
        success: false,
        error: result.error || 'Invoice not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: [result.data],
    });
  } catch (error: any) {
    console.error('Error fetching invoice disbursement data:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
