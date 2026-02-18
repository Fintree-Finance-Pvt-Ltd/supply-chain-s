import { Request, Response } from 'express';
import { OnboardingIntegrationService } from '../services/onboarding-integration.service';

export class OnboardingController {
    private onboardingService: OnboardingIntegrationService;

    constructor() {
        this.onboardingService = new OnboardingIntegrationService();
    }

    // ---------------------------------------------------
    // 📱 Mobile OTP
    // ---------------------------------------------------
    sendMobileOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, mobileNumber, ownerType, applicantId, coApplicantId } = req.body;

    if (!mobileNumber || !ownerType) {
      res.status(400).json({ success: false, message: "mobileNumber and ownerType are required" });
      return;
    }

    const result = await this.onboardingService.sendMobileOtp(
      customerId ? Number(customerId) : undefined,
      mobileNumber,
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, message: "Mobile OTP sent successfully",
  coApplicantId: result?.coApplicantId });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to send mobile OTP" });
  }
};

verifyMobileOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, otp, mobileNumber, ownerType, applicantId, coApplicantId, companyType, companyName } = req.body;

    if (!otp || !mobileNumber || !ownerType) {
      res.status(400).json({ success: false, message: "otp, mobileNumber and ownerType are required" });
      return;
    }

    const currentUserId = (req as any).user?.id || 1;

    const result = await this.onboardingService.verifyMobileOtp(
      customerId ? Number(customerId) : undefined,
      otp,
      mobileNumber,
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined,
      customerId ? undefined : { companyType, companyName, rmId: currentUserId } // only for creation
    );

    res.json({
      success: true,
      message: "Mobile verified successfully",
      customerId: result.customerId,
    });

  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Mobile verification failed" });
  }
};


    // ---------------------------------------------------
    // 📧 Email OTP
    // ---------------------------------------------------
    sendEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, email, ownerType, coApplicantId } = req.body;

    if (!customerId || !email || !ownerType) {
      res.status(400).json({
        success: false,
        message: "customerId, email and ownerType are required"
      });
      return;
    }

    const result = await this.onboardingService.sendEmailOtp(
      Number(customerId),
      ownerType,
      email,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, message: "Email OTP sent successfully", coApplicantId: result?.coApplicantId });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to send email OTP"
    });
  }
};


    verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, otp, ownerType, coApplicantId } = req.body;

    if (!customerId || !otp || !ownerType) {
      res.status(400).json({
        success: false,
        message: 'customerId, otp and ownerType are required'
      });
      return;
    }

    await this.onboardingService.verifyEmailOtp(
      Number(customerId),
      otp,
      ownerType,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, message: 'Email verified successfully' });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Email verification failed'
    });
  }
};


    // ---------------------------------------------------
    // 🔍 PAN Verification
    // ---------------------------------------------------
    verifyPan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, pan, name, ownerType, applicantId, coApplicantId } = req.body;

    if (!customerId || !pan || !name || !ownerType) {
      res.status(400).json({
        success: false,
        message: 'customerId, pan, name and ownerType are required'
      });
      return;
    }

    const result = await this.onboardingService.verifyPan(
      Number(customerId),
      pan,
      name,
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'PAN verification failed'
    });
  }
};


    // ---------------------------------------------------
    // 🔍 GST Verification
    // ---------------------------------------------------
    verifyGst = async (req: Request, res: Response): Promise<void> => {
  try {

    const { customerId, gstNumber, ownerType, applicantId, coApplicantId } = req.body;

    if (!customerId || !gstNumber || !ownerType) {
      res.status(400).json({
        success: false,
        message: 'customerId, gstNumber and ownerType are required'
      });
      return;
    }

    const result = await this.onboardingService.verifyGst(
      Number(customerId),
      gstNumber,
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'GST verification failed'
    });
  }
};


    // ---------------------------------------------------
    // 🔍 Aadhaar Verification
    // ---------------------------------------------------
verifyAadhaar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, ownerType, applicantId, coApplicantId } = req.body;

    if (!customerId || !ownerType) {
      res.status(400).json({
        success: false,
        message: 'customerId and ownerType are required'
      });
      return;
    }

    // Basic ownerType safety
    if (!['APPLICANT', 'CO_APPLICANT', 'COMPANY'].includes(ownerType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ownerType'
      });
      return;
    }

    const result = await this.onboardingService.verifyAadhaar(
      Number(customerId),
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Aadhaar verification failed'
    });
  }
};



    // ---------------------------------------------------
    // 🏦 Bureau Check
    // ---------------------------------------------------
    checkBureau = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, ownerType, applicantId, coApplicantId } = req.body;

    if (!customerId || !ownerType) {
      res.status(400).json({
        success: false,
        message: 'customerId and ownerType are required'
      });
      return;
    }

    const result = await this.onboardingService.checkBureau(
      Number(customerId),
      ownerType,
      applicantId ? Number(applicantId) : undefined,
      coApplicantId ? Number(coApplicantId) : undefined
    );

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Bureau check failed'
    });
  }
};


    // ---------------------------------------------------
    // 🔍 OCR Processing
    // ---------------------------------------------------
    processOcr = async (req: Request, res: Response): Promise<void> => {
        try {
            const { type } = req.body;
            const result = await this.onboardingService.processOcr(req.file, type);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message || 'OCR processing failed' });
        }
    };

    getVerificationStatuses = async (req: Request, res: Response): Promise<void> => {
        try {
            const { customerId } = req.params;
            if (!customerId) {
                res.status(400).json({ success: false, message: 'customerId is required' });
                return;
            }

            const result = await this.onboardingService.getVerificationStatuses(Number(customerId));
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message || 'Failed to fetch verification statuses' });
        }
    };
}
