import { AppDataSource } from "../config/database";
import {
  Customer,
  KycDetail,
  OtpSession,
  KycVerificationStatus,
  CoApplicant,
} from "../entities";
import {
  OtpSessionStatus,
  IdentifierType as OtpIdentifierType,
} from "../entities/OtpSession";
import { KycOwnerType, KycStatus } from "../entities/KycVerificationStatus";
import { OtpService } from "../integrations/otp/otp.service";
import { AlotSmsProvider } from "../integrations/notifications/sms/alot.provider";
import { NodemailerProvider } from "../integrations/notifications/email/nodemailer.provider";
import { PanService } from "../integrations/pan/pan.service";
import { GstService } from "../integrations/gst/zoop/gst.service";
import { AadhaarService } from "../integrations/aadhaar/digitap/aadhaar.service";
import { BureauService } from "../integrations/bureau/bureau.service";
import { OcrService } from "../integrations/ocr/ocr.service";
import { IsNull, MoreThan } from "typeorm";
import { CASE_STATUS } from "../config/constants";
import { Applicant } from "../entities/Applicant";
import { randomUUID } from "crypto";

export class OnboardingIntegrationService {
  private customerRepository = AppDataSource.getRepository(Customer);
  private kycRepository = AppDataSource.getRepository(KycDetail);
  private otpSessionRepository = AppDataSource.getRepository(OtpSession);
  private kycStatusRepository = AppDataSource.getRepository(
    KycVerificationStatus,
  );

  private otpService = new OtpService();
  private panService = new PanService();
  private gstService = new GstService();
  private aadhaarService = new AadhaarService();
  private bureauService = new BureauService();
  private ocrService = new OcrService();

  private smsProvider: AlotSmsProvider;
  private emailProvider: NodemailerProvider;

  constructor() {
    this.smsProvider = new AlotSmsProvider({
      apiUrl: process.env.ALOT_API_URL!,
      user: process.env.ALOT_USER!,
      password: process.env.ALOT_PASSWORD!,
      senderId: process.env.ALOT_SENDER_ID!,
      route: process.env.ALOT_SMS_ROUTE!,
      templateId: process.env.MOBILE_OTP_TEMPLATE_ID!,
      peid: process.env.DLT_PEID!,
    });

    this.emailProvider = new NodemailerProvider({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT),
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
      fromName: process.env.SMTP_FROM_NAME!,
      fromEmail: process.env.SMTP_FROM_EMAIL!,
    });
  }

  // ---------------------------------------------------
  // 📱 Mobile OTP
  // ---------------------------------------------------
  async sendMobileOtp(
    customerId: number | undefined,
    mobileNumber: string,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<{}> {
    // ✅ prevent spam: if valid OTP already sent for same owner, block
    const recentSession = await this.otpSessionRepository.findOne({
      where: {
        customerId: customerId ?? IsNull(),
        identifier: mobileNumber,
        identifierType: OtpIdentifierType.MOBILE,
        status: OtpSessionStatus.VERIFIED,
        consentAccepted: false,
        expiresAt: MoreThan(new Date()),
        ownerType,
        applicantId:
          ownerType === KycOwnerType.APPLICANT
            ? (applicantId ?? IsNull())
            : IsNull(),
        coApplicantId:
          ownerType === KycOwnerType.CO_APPLICANT
            ? (coApplicantId ?? IsNull())
            : IsNull(),
      } as any,
      order: { createdAt: "DESC" as any },
    });

    if (recentSession) {
      throw new Error("OTP already sent. Please wait before requesting again.");
    }

    const session = this.otpService.createOtp();

    const otpSession = this.otpSessionRepository.create({
      customerId: customerId ?? null,
      identifier: mobileNumber,
      identifierType: OtpIdentifierType.MOBILE,
      otp: session.otp,
      expiresAt: session.expiresAt,
      status: OtpSessionStatus.SENT,

      ownerType,
      applicantId:
        ownerType === KycOwnerType.APPLICANT ? (applicantId ?? null) : null,
      coApplicantId:
        ownerType === KycOwnerType.CO_APPLICANT
          ? (coApplicantId ?? null)
          : null,
    } as any);

    await this.otpSessionRepository.save(otpSession);

    const message = `OTP for mobile number verification is ${session.otp}. Do not share this OTP with anyone. Thanks & Regards Fintree Finance Private Limited.`;

    await this.smsProvider.sendSms(mobileNumber, message);

    return {};
  }

  // async verifyMobileOtp(
  //   customerId: number | undefined,
  //   otp: string,
  //   mobileNumber: string,
  //   ownerType: KycOwnerType,
  //   applicantId?: number,
  //   coApplicantId?: number,
  //   companyInfo?: { companyType: string; companyName: string; rmId: number }
  // ): Promise<{ success: boolean; customerId: number }> {

  //   return await AppDataSource.transaction(async (manager) => {

  //     const otpRepo = manager.getRepository(OtpSession);
  //     const customerRepo = manager.getRepository(Customer);
  //     const applicantRepo = manager.getRepository(Applicant);
  //     const coApplicantRepo = manager.getRepository(CoApplicant);
  //     const kycStatusRepo = manager.getRepository(KycVerificationStatus);

  //     // ✅ lock latest OTP for this owner
  //     const session = await otpRepo.findOne({
  //       where: {
  //         identifier: mobileNumber,
  //         identifierType: OtpIdentifierType.MOBILE,
  //         status: OtpSessionStatus.SENT,
  //         expiresAt: MoreThan(new Date()),
  //         ownerType,
  //         applicantId: ownerType === KycOwnerType.APPLICANT ? applicantId ?? IsNull() : IsNull(),
  //         coApplicantId: ownerType === KycOwnerType.CO_APPLICANT ? coApplicantId ?? IsNull() : IsNull(),
  //       } as any,
  //       order: { createdAt: 'DESC' as any },
  //     });

  //     if (!session) throw new Error('No valid OTP session found');

  //     // verify otp with attempts update
  //     try {
  //       this.otpService.verifyOtp(
  //         {
  //           otp: session.otp,
  //           expiresAt: session.expiresAt,
  //           attempts: session.attempts,
  //           lastSentAt: session.createdAt
  //         },
  //         otp
  //       );

  //       session.status = OtpSessionStatus.VERIFIED;

  //     } catch (error: any) {

  //       session.attempts += 1;

  //       if (session.attempts >= 3)
  //         session.status = OtpSessionStatus.FAILED;

  //       await otpRepo.save(session);
  //       throw error;
  //     }

  //     await otpRepo.save(session);

  //     // ---------------------------------------------------
  //     // ✅ Create or fetch customer (only for COMPANY OTP)
  //     // ---------------------------------------------------
  //     let finalCustomer: Customer;

  //     if (!customerId) {
  //       if (ownerType !== KycOwnerType.COMPANY) {
  //         throw new Error("customerId is required for applicant/co-applicant verification");
  //       }
  //       if (!companyInfo) throw new Error("Company info required for customer creation");

  //       const existing = await customerRepo.findOne({ where: { companyMobile: mobileNumber } });

  //       if (existing) {
  //         finalCustomer = existing;
  //       } else {
  //         finalCustomer = customerRepo.create({
  //           companyType: companyInfo.companyType as any,
  //           companyName: companyInfo.companyName,
  //           companyMobile: mobileNumber,
  //           rmId: companyInfo.rmId,
  //           status: CASE_STATUS.DRAFT,
  //         });

  //         finalCustomer = await customerRepo.save(finalCustomer);
  //       }
  //     } else {
  //       const existingCustomer = await customerRepo.findOne({ where: { id: customerId } });
  //       if (!existingCustomer) throw new Error("Customer not found");
  //       finalCustomer = existingCustomer;
  //     }

  //     // ---------------------------------------------------
  //     // ✅ ensure Applicant exists (1 per customer)
  //     // ---------------------------------------------------
  //     let applicant = await applicantRepo.findOne({ where: { customerId: finalCustomer.id } });

  // if (!applicant) {
  //   applicant = await applicantRepo.save(
  //     applicantRepo.create({
  //       customerId: finalCustomer.id,
  //       mobile: mobileNumber,
  //       name: ''
  //     })
  //   );
  // }

  //     // ---------------------------------------------------
  //     // ✅ If owner is CO_APPLICANT: validate & update coApplicant mobile
  //     // ---------------------------------------------------
  //     if (ownerType === KycOwnerType.CO_APPLICANT) {
  //       if (!coApplicantId) throw new Error("coApplicantId required");

  //       const coApp = await coApplicantRepo.findOne({ where: { id: coApplicantId, customerId: finalCustomer.id } });
  //       if (!coApp) throw new Error("Co-applicant not found");

  //       await coApplicantRepo.update({ id: coApplicantId }, { mobile: mobileNumber });
  //     }

  //     // ---------------------------------------------------
  //     // ✅ If owner is APPLICANT: update applicant mobile
  //     // ---------------------------------------------------
  //     if (ownerType === KycOwnerType.APPLICANT) {
  //       await applicantRepo.update({ id: applicant.id }, { mobile: mobileNumber });
  //     }

  //     // ---------------------------------------------------
  //     // ✅ Update correct KYC row (single source of truth)
  //     // ---------------------------------------------------
  //     const kycRow = await this.getOrCreateKycStatus(
  //       finalCustomer.id,
  //       ownerType,
  //       ownerType === KycOwnerType.APPLICANT ? applicant.id : undefined,
  //       ownerType === KycOwnerType.CO_APPLICANT ? coApplicantId : undefined
  //     );

  //     kycRow.mobileStatus = KycStatus.VERIFIED;
  //     await kycStatusRepo.save(kycRow);

  //     // ---------------------------------------------------
  //     // ✅ Ensure COMPANY + APPLICANT rows exist (optional but useful)
  //     // ---------------------------------------------------
  //     await this.getOrCreateKycStatus(finalCustomer.id, KycOwnerType.COMPANY);
  //     await this.getOrCreateKycStatus(finalCustomer.id, KycOwnerType.APPLICANT, applicant.id);

  //     return { success: true, customerId: finalCustomer.id };
  //   });
  // }

  // ---------------------------------------------------
  // 📧 Email OTP
  // ---------------------------------------------------

  async verifyMobileOtp(
    customerId: number | undefined,
    otp: string,
    mobileNumber: string,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
    companyInfo?: { companyType: string; companyName: string; rmId: number },
    skipOtpValidation?: boolean,
    consentAccepted?: boolean,
    consentText?: string,
  ): Promise<{ success: boolean; customerId: number; coApplicantId?: number }> {
    const otpRepo = AppDataSource.getRepository(OtpSession);
    const customerRepo = AppDataSource.getRepository(Customer);
    const applicantRepo = AppDataSource.getRepository(Applicant);
    const coApplicantRepo = AppDataSource.getRepository(CoApplicant);
    const kycStatusRepo = AppDataSource.getRepository(KycVerificationStatus);

    let session: OtpSession | null = null;

    if (!skipOtpValidation) {
      session = await otpRepo.findOne({
        where: {
          identifier: mobileNumber,
          identifierType: OtpIdentifierType.MOBILE,
          status: OtpSessionStatus.SENT,
          expiresAt: MoreThan(new Date()),
          ownerType,
          applicantId:
            ownerType === KycOwnerType.APPLICANT
              ? (applicantId ?? IsNull())
              : IsNull(),
          coApplicantId:
            ownerType === KycOwnerType.CO_APPLICANT
              ? (coApplicantId ?? IsNull())
              : IsNull(),
        } as any,
        order: { createdAt: "DESC" as any },
      });

      if (!session) throw new Error("No valid OTP session found");
    }

    // const otpSession = session!;

    // if (!skipOtpValidation) {
    //   try {
    //     this.otpService.verifyOtp(
    //       {
    //         otp: otpSession.otp,
    //         expiresAt: otpSession.expiresAt,
    //         attempts: otpSession.attempts,
    //         lastSentAt: otpSession.createdAt
    //       },
    //       otp
    //     );

    //     await otpRepo.update(
    //       { id: otpSession.id },
    //       { status: OtpSessionStatus.VERIFIED }
    //     );

    //   } catch (error: any) {

    //     await otpRepo.update(
    //       { id: otpSession.id },
    //       {
    //         attempts: otpSession.attempts + 1,
    //         status: otpSession.attempts + 1 >= 3
    //           ? OtpSessionStatus.FAILED
    //           : OtpSessionStatus.SENT
    //       }
    //     );

    //     throw error;
    //   }
    // } else {
    //   await otpRepo.update(
    //     { id: otpSession.id },
    //     { status: OtpSessionStatus.VERIFIED }
    //   );
    // }

    if (!skipOtpValidation) {
      const otpSession = session!;

      try {
        this.otpService.verifyOtp(
          {
            otp: otpSession.otp,
            expiresAt: otpSession.expiresAt,
            attempts: otpSession.attempts,
            lastSentAt: otpSession.createdAt,
            
          },
          otp,
        );
        // await otpRepo.update(
        //   { id: otpSession.id },
        //   { status: OtpSessionStatus.VERIFIED },
        // );

        await otpRepo.update(
          { id: otpSession.id },
          {status: OtpSessionStatus.VERIFIED,
            consentAccepted: consentAccepted || false,
            consentText: consentText || "",
            },
        );
      } catch (error: any) {
        await otpRepo.update(
          { id: otpSession.id },
          {
            attempts: otpSession.attempts + 1,
            status:
              otpSession.attempts + 1 >= 3
                ? OtpSessionStatus.FAILED
                : OtpSessionStatus.SENT,
          },
        );

        throw error;
      }
    }

    // ---------------------------------------------------
    // ✅ Create or fetch customer
    // ---------------------------------------------------
    let finalCustomer: Customer;

    if (!customerId) {
      if (ownerType !== KycOwnerType.COMPANY) {
        throw new Error(
          "customerId is required for applicant/co-applicant verification",
        );
      }

      if (!companyInfo) {
        throw new Error("Company info required for customer creation");
      }

      const existing = await customerRepo.findOne({
        where: { companyMobile: mobileNumber },
      });

      if (existing) {
        finalCustomer = existing;
      } else {
        finalCustomer = await customerRepo.save(
          customerRepo.create({
            companyType: companyInfo.companyType as any,
            companyName: companyInfo.companyName,
            companyMobile: mobileNumber,
            rmId: companyInfo.rmId,
            status: CASE_STATUS.DRAFT,
          }),
        );
      }
    } else {
      const existingCustomer = await customerRepo.findOne({
        where: { id: customerId },
      });

      if (!existingCustomer) throw new Error("Customer not found");
      finalCustomer = existingCustomer;
    }

    // ---------------------------------------------------
    // ✅ Ensure Applicant exists
    // ---------------------------------------------------
    let applicant = await applicantRepo.findOne({
      where: { customerId: finalCustomer.id },
    });

    if (!applicant) {
      applicant = await applicantRepo.save(
        applicantRepo.create({
          customerId: finalCustomer.id,
          name: "",
        }),
      );
    }

    // ---------------------------------------------------
    // ✅ Update mobiles if needed
    // ---------------------------------------------------
    if (ownerType === KycOwnerType.APPLICANT) {
      await applicantRepo.update(
        { id: applicant.id },
        { mobile: mobileNumber },
      );
    }

    if (ownerType === KycOwnerType.CO_APPLICANT) {
      let coApp: CoApplicant | null = null;

      if (coApplicantId) {
        coApp = await coApplicantRepo.findOne({
          where: { id: coApplicantId, customerId: finalCustomer.id },
        });

        if (!coApp) throw new Error("Co-applicant not found");

        await coApplicantRepo.update(
          { id: coApplicantId },
          { mobile: mobileNumber },
        );
      } else {
        // ✅ Check for existing co-applicant with same mobile to prevent duplicates
        coApp = await coApplicantRepo.findOne({
          where: { customerId: finalCustomer.id, mobile: mobileNumber },
        });

        if (!coApp) {
          coApp = await coApplicantRepo.save(
            coApplicantRepo.create({
              customerId: finalCustomer.id,
              mobile: mobileNumber,
              name: "",
              email: undefined,
              gender: undefined,
              pan: undefined,
            } as Partial<CoApplicant>),
          );
        }

        coApplicantId = coApp.id;
      }
    }

    // ---------------------------------------------------
    // ✅ Update KYC status
    // ---------------------------------------------------
    const kycRow = await this.getOrCreateKycStatus(
      finalCustomer.id,
      ownerType,
      ownerType === KycOwnerType.APPLICANT ? applicant.id : undefined,
      ownerType === KycOwnerType.CO_APPLICANT ? coApplicantId : undefined,
    );

    kycRow.mobileStatus = KycStatus.VERIFIED;
    await kycStatusRepo.save(kycRow);

    // Ensure base rows exist
    await this.getOrCreateKycStatus(finalCustomer.id, KycOwnerType.COMPANY);
    await this.getOrCreateKycStatus(
      finalCustomer.id,
      KycOwnerType.APPLICANT,
      applicant.id,
    );

    return {
      success: true,
      customerId: finalCustomer.id,
      coApplicantId:
        ownerType === KycOwnerType.CO_APPLICANT ? coApplicantId : undefined,
    };
  }

  async sendEmailOtp(
    customerId: number,
    ownerType: KycOwnerType,
    email: string,
    coApplicantId?: number,
  ): Promise<{ coApplicantId?: number }> {
    const customerRepo = this.customerRepository;
    const applicantRepo = AppDataSource.getRepository(Applicant);
    const coApplicantRepo = AppDataSource.getRepository(CoApplicant);

    // ---------------------------------------------------
    // 🔎 Validate & Auto-Save Email (First Time Safe)
    // ---------------------------------------------------

    if (ownerType === KycOwnerType.COMPANY) {
      const customer = await customerRepo.findOne({
        where: { id: customerId },
      });

      if (!customer) throw new Error("Customer not found");

      // 🔥 First-time save
      if (!customer.companyEmail) {
        customer.companyEmail = email;
        await customerRepo.save(customer);
      }

      // 🔒 Block if mismatch
      if (customer.companyEmail !== email)
        throw new Error("Email does not match registered company email");
    } else if (ownerType === KycOwnerType.APPLICANT) {
      const applicant = await applicantRepo.findOne({
        where: { customerId },
      });

      if (!applicant) throw new Error("Applicant not found");

      // 🔥 First-time save
      if (!applicant.email) {
        applicant.email = email;
        await applicantRepo.save(applicant);
      }

      // 🔒 Block if mismatch
      if (applicant.email !== email)
        throw new Error("Email does not match registered applicant email");
    }

    // ---------------------------------------------------
    // ✅ AUTO-CREATE CO-APPLICANT (NEW)
    // ---------------------------------------------------
    else if (ownerType === KycOwnerType.CO_APPLICANT) {
      if (!customerId) throw new Error("customerId required for co-applicant");

      let coApplicant: CoApplicant | null = null;

      // 🔹 Create ONLY if missing
      if (!coApplicantId) {
        coApplicant = await coApplicantRepo.save(
          coApplicantRepo.create({
            customerId,
            email,
            name: "",
            mobile: "",
            gender: undefined,
            pan: undefined,
          } as Partial<CoApplicant>),
        );
        coApplicantId = coApplicant.id;
      } else {
        coApplicant = await coApplicantRepo.findOne({
          where: { id: coApplicantId, customerId },
        });
      }

      if (!coApplicant) throw new Error("Co-applicant not found");

      // 🔥 First-time save
      if (!coApplicant.email) {
        coApplicant.email = email;
        await coApplicantRepo.save(coApplicant);
      }

      if (coApplicant.email !== email)
        throw new Error("Email does not match registered co-applicant email");
    }
    // ---------------------------------------------------
    // 🔒 Prevent multiple OTP spam
    // ---------------------------------------------------

    const recentSession = await this.otpSessionRepository.findOne({
      where: {
        customerId,
        identifier: email,
        identifierType: OtpIdentifierType.EMAIL,
        status: OtpSessionStatus.SENT,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (recentSession) throw new Error("OTP already sent. Please wait.");

    // ---------------------------------------------------
    // 🔐 Generate OTP
    // ---------------------------------------------------

    const session = this.otpService.createOtp();

    const otpSession = this.otpSessionRepository.create({
      customerId,
      identifier: email,
      identifierType: OtpIdentifierType.EMAIL,
      otp: session.otp,
      expiresAt: session.expiresAt,
      status: OtpSessionStatus.SENT,
    });

    await this.otpSessionRepository.save(otpSession);

    // ---------------------------------------------------
    // 📧 Send Email
    // ---------------------------------------------------

    const subject = "Your Verification OTP";
    const html = `
    <p>Your OTP for onboarding is <b>${session.otp}</b>.</p>
    <p>Valid for 5 minutes.</p>
  `;

    await this.emailProvider.sendEmail(email, subject, html);

    return ownerType === KycOwnerType.CO_APPLICANT ? { coApplicantId } : {};
  }

  async verifyEmailOtp(
    customerId: number,
    otp: string,
    ownerType: KycOwnerType,
    coApplicantId?: number,
    skipOtpValidation?: boolean,
  ): Promise<boolean> {
    return await AppDataSource.transaction(async (manager) => {
      const otpRepo = manager.getRepository(OtpSession);
      const applicantRepo = manager.getRepository(Applicant);
      const coApplicantRepo = manager.getRepository(CoApplicant);
      const kycRepo = manager.getRepository(KycVerificationStatus);

      let session: OtpSession | null = null;

      if (!skipOtpValidation) {
        session = await otpRepo
          .createQueryBuilder("s")
          .setLock("pessimistic_write")
          .where("s.customerId = :customerId", { customerId })
          .andWhere("s.identifierType = :type", {
            type: OtpIdentifierType.EMAIL,
          })
          .andWhere("s.status = :status", { status: OtpSessionStatus.SENT })
          .andWhere("s.expiresAt > NOW()")
          .orderBy("s.createdAt", "DESC")
          .getOne();

        if (!session) throw new Error("No valid OTP session found");

        try {
          this.otpService.verifyOtp(
            {
              otp: session.otp,
              expiresAt: session.expiresAt,
              attempts: session.attempts,
              lastSentAt: session.createdAt,
            },
            otp,
          );

          session.status = OtpSessionStatus.VERIFIED;
        } catch (error: any) {
          session.attempts += 1;

          if (session.attempts >= 3) session.status = OtpSessionStatus.FAILED;

          await otpRepo.save(session);
          throw error;
        }

        await otpRepo.save(session);
      } else {
        session = await otpRepo
          .createQueryBuilder("s")
          .where("s.customerId = :customerId", { customerId })
          .andWhere("s.identifierType = :type", {
            type: OtpIdentifierType.EMAIL,
          })
          .andWhere("s.status = :status", { status: OtpSessionStatus.SENT })
          .orderBy("s.createdAt", "DESC")
          .getOne();

        if (session) {
          session.status = OtpSessionStatus.VERIFIED;
          await otpRepo.save(session);
        }
      }

      // ---------------------------------------------------
      // 📄 Resolve owner IDs properly (NULL based)
      // ---------------------------------------------------

      let applicantId: number | null = null;
      let resolvedCoApplicantId: number | null = null;

      if (ownerType === KycOwnerType.APPLICANT) {
        const applicant = await applicantRepo.findOne({
          where: { customerId },
        });

        if (!applicant) throw new Error("Applicant not found");

        applicantId = applicant.id;
      } else if (ownerType === KycOwnerType.CO_APPLICANT) {
        if (!coApplicantId) throw new Error("coApplicantId required");

        const coApplicant = await coApplicantRepo.findOne({
          where: { id: coApplicantId, customerId },
        });

        if (!coApplicant) throw new Error("CoApplicant not found");

        resolvedCoApplicantId = coApplicant.id;
      }

      // ---------------------------------------------------
      // 📄 Fetch correct KYC row
      // ---------------------------------------------------

      const kycRow = await kycRepo.findOne({
        where: {
          customerId,
          ownerType,
          applicantId: applicantId ?? IsNull(),
          coApplicantId: resolvedCoApplicantId ?? IsNull(),
        },
      });

      if (!kycRow) throw new Error("KYC status row not found");

      kycRow.emailStatus = KycStatus.VERIFIED;

      await kycRepo.save(kycRow);

      return true;
    });
  }

  // ---------------------------------------------------
  // 🔍 PAN Verification
  // ---------------------------------------------------
  async verifyPan(
    customerId: number,
    pan: string,
    name: string,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<any> {
    return await AppDataSource.transaction(async (manager) => {
      const kycRepo = manager.getRepository(KycVerificationStatus);
      const applicantRepo = manager.getRepository(Applicant);
      const coApplicantRepo = manager.getRepository(CoApplicant);
      const customerRepo = manager.getRepository(Customer);

      if (ownerType === KycOwnerType.APPLICANT && !applicantId) {
        const applicant = await applicantRepo.findOne({
          where: { customerId },
        });
        if (applicant) {
          applicantId = applicant.id;
        }
      }

      if (ownerType === KycOwnerType.CO_APPLICANT && !coApplicantId) {
        const coApplicant = await coApplicantRepo.save(
          coApplicantRepo.create({
            customerId,
            name,
            pan,
          }),
        );

        coApplicantId = coApplicant.id;
      }

      // ---------------------------------------------------
      // 🔐 Get or Create Correct KYC Row
      // ---------------------------------------------------

      const kycStatus = await this.getOrCreateKycStatus(
        customerId,
        ownerType,
        applicantId,
        coApplicantId,
      );

      kycStatus.panStatus = KycStatus.INITIATED;
      kycStatus.panApiRequest = { pan, name };

      await kycRepo.save(kycStatus);

      try {
        const result = await this.panService.validatePan(pan, name);

        kycStatus.panApiResponse = result;

        // Extract name fields from PAN API response
        if (result?.details) {
          kycStatus.firstName = result.details.firstName || result.details.name||null;
          kycStatus.middleName = result.details.middleName || null;
          kycStatus.lastName = result.details.lastName || null;
        }

        if (result.success && result.verified) {
          kycStatus.panStatus = KycStatus.VERIFIED;

          // ---------------------------------------------------
          // 🔥 Save PAN and Name to Correct Table
          // ---------------------------------------------------

          if (ownerType === KycOwnerType.COMPANY) {
            await customerRepo.update(
              { id: customerId },
              { companyPan: pan, companyName: name },
            );
          }

          if (ownerType === KycOwnerType.APPLICANT) {
            await applicantRepo.update({ id: applicantId }, { pan, name });
          }

          if (ownerType === KycOwnerType.CO_APPLICANT) {
            await coApplicantRepo.update({ id: coApplicantId }, { pan, name });
          }
        } else {
          kycStatus.panStatus = KycStatus.FAILED;
        }

        await kycRepo.save(kycStatus);
        return result;
      } catch (error: any) {
        kycStatus.panStatus = KycStatus.FAILED;
        kycStatus.panApiResponse = { error: error.message };

        await kycRepo.save(kycStatus);
        throw error;
      }
    });
  }

  // ---------------------------------------------------
  // 🔍 GST Verification
  // ---------------------------------------------------
  async verifyGst(
    customerId: number,
    gstNumber: string,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<any> {
    return await AppDataSource.transaction(async (manager) => {
      const kycRepo = manager.getRepository(KycVerificationStatus);
      const customerRepo = manager.getRepository(Customer);
      const applicantRepo = manager.getRepository(Applicant);

      if (ownerType === KycOwnerType.APPLICANT && !applicantId) {
        const applicant = await applicantRepo.findOne({
          where: { customerId },
        });
        if (applicant) {
          applicantId = applicant.id;
        }
      }

      const kycStatus = await this.getOrCreateKycStatus(
        customerId,
        ownerType,
        applicantId,
        coApplicantId,
      );

      kycStatus.gstStatus = KycStatus.INITIATED;
      kycStatus.gstApiRequest = { gstNumber };

      await kycRepo.save(kycStatus);

      try {
        const result = await this.gstService.getGstDetails(gstNumber);

        kycStatus.gstApiResponse = result;

        if (result.success) {
          kycStatus.gstStatus = KycStatus.VERIFIED;

          // Only company normally stores GST
          if (ownerType === KycOwnerType.COMPANY) {
            await customerRepo.update({ id: customerId }, { gstNumber });
          }
        } else {
          kycStatus.gstStatus = KycStatus.FAILED;
        }

        await kycRepo.save(kycStatus);
        return result;
      } catch (error: any) {
        kycStatus.gstStatus = KycStatus.FAILED;
        kycStatus.gstApiResponse = { error: error.message };

        await kycRepo.save(kycStatus);
        throw error;
      }
    });
  }

  // ---------------------------------------------------
  // 🔍 Aadhaar Verification
  // ---------------------------------------------------
  async verifyAadhaar(
    customerId: number,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<any> {
    const applicantRepo = AppDataSource.getRepository(Applicant);

    // Resolve applicantId automatically if APPLICANT
    if (ownerType === KycOwnerType.APPLICANT && !applicantId) {
      const applicant = await applicantRepo.findOne({ where: { customerId } });
      if (!applicant) {
        throw new Error("Applicant not found for customer");
      }
      applicantId = applicant.id;
    }

    // Get or create KYC row (ONE row per person)
    const kycStatus = await this.getOrCreateKycStatus(
      customerId,
      ownerType,
      applicantId,
      coApplicantId,
    );

    // Name MUST exist before Aadhaar
    if (!kycStatus.firstName) {
      throw new Error("First name is required before Aadhaar KYC");
    }

    // Generate internal referenceId (used as Digitap uid)
    const referenceId = `AADHAAR_${customerId}_${ownerType}_${applicantId || coApplicantId || "MAIN"}_${randomUUID()}`;

    // Mark initiated
    kycStatus.aadhaarStatus = KycStatus.INITIATED;
    kycStatus.aadhaarApiRequest = {
      referenceId,
      ownerType,
      applicantId,
      coApplicantId,
    };

    await this.kycStatusRepository.save(kycStatus);

    try {
      // Resolve contact details based on ownerType
      const customer = await this.customerRepository.findOne({
        where: { id: customerId },
      });
      if (!customer) throw new Error("Customer not found");

      let mobileNumber = "";
      let emailAddress = "";

      if (ownerType === KycOwnerType.APPLICANT) {
        // Get applicant's mobile number
        const applicant = await AppDataSource.getRepository(Applicant).findOne({
          where: { id: applicantId },
        });
        if (applicant) {
          mobileNumber = applicant.mobile || "";
          emailAddress = applicant.email || "";
        }
      } else if (ownerType === KycOwnerType.CO_APPLICANT) {
        // Get co-applicant's mobile number
        const coApplicant = await AppDataSource.getRepository(
          CoApplicant,
        ).findOne({
          where: { id: coApplicantId },
        });
        if (coApplicant) {
          mobileNumber = coApplicant.mobile || "";
          emailAddress = coApplicant.email || "";
        }
      } else {
        // COMPANY - use customer mobile
        mobileNumber = customer.mobile || customer.companyMobile || "";
        emailAddress = customer.email || "";
      }

      const result = await this.aadhaarService.generateKycLink({
        uid: referenceId, // ✅ NOT Aadhaar number
        firstName: kycStatus.firstName, // ✅ from kyc_verification_status
        lastName: kycStatus.lastName || "",
        mobile: mobileNumber, // ✅ Specific person's mobile
        emailId: emailAddress, // ✅ Specific person's email
        redirectionUrl: `https://fintreelms.com/onboarding/aadhaar/callback`,
      });

      // Store transaction details
      kycStatus.aadhaarTransactionId = result.transactionId;
      kycStatus.aadhaarApiResponse = result;

      await this.kycStatusRepository.save(kycStatus);
      return result;
    } catch (error: any) {
      kycStatus.aadhaarStatus = KycStatus.FAILED;
      kycStatus.aadhaarApiResponse = { error: error.message };
      await this.kycStatusRepository.save(kycStatus);
      throw error;
    }
  }

  // ---------------------------------------------------
  // 🏦 Bureau Check
  // ---------------------------------------------------
  async checkBureau(
    customerId: number,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<any> {
    console.log("🔥 checkBureau started", {
      customerId,
      ownerType,
      applicantId,
      coApplicantId,
    });

    const applicantRepo = AppDataSource.getRepository(Applicant);

    // Resolve applicantId if missing
    if (ownerType === KycOwnerType.APPLICANT && !applicantId) {
      const applicant = await applicantRepo.findOne({ where: { customerId } });
      if (applicant) applicantId = applicant.id;
    }

    const kycStatus = await this.getOrCreateKycStatus(
      customerId,
      ownerType,
      applicantId,
      coApplicantId,
    );

    /* ------------------------------------
       Preconditions
    ------------------------------------ */

    if (
      kycStatus.panStatus !== KycStatus.VERIFIED ||
      kycStatus.aadhaarStatus !== KycStatus.VERIFIED
    ) {
      throw new Error("PAN and Aadhaar must be verified before Bureau");
    }

    if (kycStatus.bureauStatus === KycStatus.VERIFIED) {
      return {
        success: false,
        message: "Bureau already verified",
      };
    }

    if (kycStatus.bureauStatus === KycStatus.INITIATED) {
      throw new Error("Bureau check already in progress");
    }

    /* ------------------------------------
       Extract Aadhaar Data
    ------------------------------------ */

    const aadhaarPayload = kycStatus.aadhaarWebhookResponse?.data || {};

    const aadhaarAddress = aadhaarPayload.address || {};

    const fullAadhaarAddress = [
      aadhaarAddress.house,
      aadhaarAddress.street,
      aadhaarAddress.landmark,
      aadhaarAddress.loc,
      aadhaarAddress.vtc,
      aadhaarAddress.subdist,
      aadhaarAddress.dist,
      aadhaarAddress.state,
      aadhaarAddress.pc,
    ]
      .filter(Boolean)
      .join(", ");

    const aadhaarCity =
      aadhaarAddress.vtc || aadhaarAddress.loc || aadhaarAddress.dist || "";

    /* ------------------------------------
       Name Normalization
    ------------------------------------ */

    const aadhaarName = aadhaarPayload?.name || "";
    let aadhaarFirstName = "";
    let aadhaarLastName = "";

    if (aadhaarName) {
      const parts = aadhaarName.trim().split(/\s+/);
      aadhaarFirstName = parts.shift() || "";
      aadhaarLastName = parts.join(" ");
    }

    let mobileNumber = "";

    if (ownerType === KycOwnerType.APPLICANT && applicantId) {
      const applicant = await applicantRepo.findOneBy({ id: applicantId });
      mobileNumber = applicant?.mobile || "";
    }

    if (ownerType === KycOwnerType.CO_APPLICANT && coApplicantId) {
      const coApplicantRepo = AppDataSource.getRepository(CoApplicant);
      const coApplicant = await coApplicantRepo.findOneBy({
        id: coApplicantId,
      });
      mobileNumber = coApplicant?.mobile || "";
    }

    const rawGender = aadhaarPayload.gender || "";
    const gender =
      rawGender === "M" || rawGender === "MALE"
        ? "M"
        : rawGender === "F" || rawGender === "FEMALE"
          ? "F"
          : "";

    /* ------------------------------------
       Build Bureau Request
    ------------------------------------ */

    const requestPayload = {
      firstName: kycStatus.firstName || aadhaarFirstName,
      lastName: kycStatus.lastName || aadhaarLastName,
      gender,
      dob: kycStatus.aadhaarDob || kycStatus.panApiResponse?.dob || null,
      pan_number:
        kycStatus.panApiResponse?.pan ||
        kycStatus.panApiResponse?.panNumber ||
        "",
      mobile_number: mobileNumber,
      current_address: kycStatus.aadhaarAddress || fullAadhaarAddress,
      current_village_city: aadhaarCity,
      current_state: aadhaarAddress.state || "",
      current_pincode: aadhaarAddress.pc || "",
      loan_amount: 1,
      loan_tenure: 5,
    };

    /* ------------------------------------
       Run Bureau
    ------------------------------------ */

    kycStatus.bureauStatus = KycStatus.INITIATED;
    // kycStatus.bureauApiRequest = requestPayload;
    await this.kycStatusRepository.save(kycStatus);

    try {
      const result = await this.bureauService.runBureau(requestPayload);

      kycStatus.bureauApiRequest = result.requestXml || result;
      kycStatus.bureauApiResponse = result.response;
      kycStatus.bureauStatus = result.success
        ? KycStatus.VERIFIED
        : KycStatus.FAILED;

      await this.kycStatusRepository.save(kycStatus);

      return result;
    } catch (error: any) {
      kycStatus.bureauStatus = KycStatus.FAILED;
      kycStatus.bureauApiResponse = { error: error.message };
      await this.kycStatusRepository.save(kycStatus);
      throw error;
    }
  }

  // ---------------------------------------------------
  // 🔍 OCR Processing
  // ---------------------------------------------------
  async processOcr(file: any, type: "PAN" | "AADHAAR"): Promise<any> {
    if (!file) throw new Error("File is required for OCR");

    if (type === "PAN") {
      const result = await this.ocrService.extractPanFromImage(file);
      return result;
    } else {
      // Aadhaar OCR logic if available in OcrService
      return {
        message:
          "Aadhaar OCR processing logic to be refined with specific provider",
      };
    }
  }

  // ---------------------------------------------------
  // 💾 helper: get or create KycVerificationStatus
  // ---------------------------------------------------
  private async getOrCreateKycStatus(
    customerId: number,
    ownerType: KycOwnerType,
    applicantId?: number,
    coApplicantId?: number,
  ): Promise<KycVerificationStatus> {
    const resolvedApplicantId =
      ownerType === KycOwnerType.APPLICANT ? (applicantId ?? null) : null;

    const resolvedCoApplicantId =
      ownerType === KycOwnerType.CO_APPLICANT ? (coApplicantId ?? null) : null;

    const where = {
      customerId,
      ownerType,
      applicantId:
        resolvedApplicantId === null ? IsNull() : resolvedApplicantId,
      coApplicantId:
        resolvedCoApplicantId === null ? IsNull() : resolvedCoApplicantId,
    };

    let status = await this.kycStatusRepository.findOne({ where });

    if (status) return status;

    // 🔥 Create safely without risky fallback
    status = this.kycStatusRepository.create({
      customerId,
      ownerType,
      applicantId: resolvedApplicantId,
      coApplicantId: resolvedCoApplicantId,
      mobileStatus: KycStatus.PENDING,
      emailStatus: KycStatus.PENDING,
      panStatus: KycStatus.PENDING,
      gstStatus: KycStatus.PENDING,
      aadhaarStatus: KycStatus.PENDING,
    });

    return await this.kycStatusRepository.save(status);
  }

  async getVerificationStatuses(
    customerId: number,
  ): Promise<KycVerificationStatus[]> {
    return await this.kycStatusRepository.find({
      where: { customerId },
    });
  }

  // ---------------------------------------------------
  // 💾 Helper: Save KYC Result
  // ---------------------------------------------------
  private async saveKycResult(
    customerId: number,
    type: string,
    number: string,
    verified: boolean,
    details: any,
    coApplicantId?: number,
  ) {
    const applicantType = coApplicantId ? "co_applicant" : "applicant";

    let kyc = await this.kycRepository.findOne({
      where: {
        customerId,
        kycType: type as any,
        applicantType,
        coApplicantId: coApplicantId ?? IsNull(),
      },
    });

    if (kyc) {
      kyc.kycNumber = number;
      kyc.verified = verified;
      kyc.verifiedAt = verified ? new Date() : null;
      kyc.remarks = JSON.stringify(details);
    } else {
      kyc = this.kycRepository.create({
        customerId,
        kycType: type as any,
        kycNumber: number,
        verified,
        verifiedAt: verified ? new Date() : null,
        remarks: JSON.stringify(details),
        applicantType,
        coApplicantId: coApplicantId ?? null,
      });
    }

    await this.kycRepository.save(kyc);
  }
}
