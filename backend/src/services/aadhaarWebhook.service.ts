import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { KycVerificationStatus, KycStatus } from '../entities/KycVerificationStatus';
import { Document } from '../entities/Document';

/* =====================================================
   FILE HELPERS
===================================================== */

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function isProbablyUrl(s?: string) {
    return !!s && (s.startsWith('http://') || s.startsWith('https://'));
}

function isProbablyBase64(s?: string) {
    return !!s && s.length > 100 && !isProbablyUrl(s);
}

function stripDataUrlPrefix(base64: string) {
    const i = base64.indexOf('base64,');
    return i >= 0 ? base64.substring(i + 7) : base64;
}

async function saveFile(
    source: string,
    absDir: string,
    relDir: string,
    fileName: string
): Promise<string | null> {
    if (!source) return null;

    const absPath = path.join(absDir, fileName);
    const relPath = path.posix.join(relDir, fileName);

    try {
        if (isProbablyBase64(source)) {
            const cleaned = stripDataUrlPrefix(source);
            fs.writeFileSync(absPath, Buffer.from(cleaned, 'base64'));
            return relPath;
        }

        if (isProbablyUrl(source)) {
            const resp = await axios.get(source, { responseType: 'arraybuffer' });
            fs.writeFileSync(absPath, Buffer.from(resp.data));
            return relPath;
        }

        return null;
    } catch (e: any) {
        console.error(`❌ File save failed (${fileName}):`, e.message);
        return null;
    }
}

/* =====================================================
   MAIN WEBHOOK PROCESSOR
===================================================== */

export async function processAadhaarWebhook(payload: any) {
    const transactionId = payload?.transactionId;
    const status = (payload?.status || '').toLowerCase();
    const data = payload?.data;

    console.log('📦 Aadhaar webhook received:', transactionId);

    if (!transactionId) {
        console.warn('⚠️ Aadhaar webhook missing transactionId');
        return;
    }

    const kycRepo = AppDataSource.getRepository(KycVerificationStatus);
    const docRepo = AppDataSource.getRepository(Document);

    const kyc = await kycRepo.findOne({
        where: { aadhaarTransactionId: transactionId },
    });

    if (!kyc) {
        console.warn(`⚠️ No KYC row found for Aadhaar txn=${transactionId}`);
        return;
    }

    // Always store raw webhook payload
    kyc.aadhaarWebhookResponse = payload;

    /* -------------------- FAILURE -------------------- */

    if (!['success', 'completed', 'verified'].includes(status)) {
        kyc.aadhaarStatus = KycStatus.FAILED;
        await kycRepo.save(kyc);
        console.warn(`❌ Aadhaar FAILED txn=${transactionId}`);
        return;
    }

    /* -------------------- SUCCESS -------------------- */

    kyc.aadhaarStatus = KycStatus.VERIFIED;
    kyc.aadhaarName = data?.name ?? null;
    kyc.aadhaarMaskedNumber = data?.maskedAdharNumber ?? null;

    // DOB (dd-mm-yyyy or dd/mm/yyyy or yyyy-mm-dd)
    if (data?.dob) {
        const parts = data.dob.replace(/\//g, '-').split('-');
        let parsed: Date = new Date(NaN); // Invalid date initially

        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // Format: yyyy-mm-dd
                parsed = new Date(data.dob);
            } else if (parts[2].length === 4) {
                // Format: dd-mm-yyyy
                const [dd, mm, yyyy] = parts;
                parsed = new Date(`${yyyy}-${mm}-${dd}`);
            }
        }

        if (!isNaN(parsed.getTime())) {
            kyc.aadhaarDob = parsed;
        } else {
            console.warn(`⚠️ Could not parse Aadhaar DOB: ${data.dob}`);
        }
    }

    // Address (flattened)
    if (data?.address) {
        const a = data.address;
        kyc.aadhaarAddress = [
            a.house,
            a.street,
            a.landmark,
            a.loc,
            a.vtc,
            a.subdist,
            a.dist,
            a.state,
            a.pc,
        ]
            .filter(Boolean)
            .join(', ');
    }

    /* -------------------- FILE STORAGE -------------------- */

    const absDir = path.join(
        process.cwd(),
        'uploads',
        'aadhaar',
        transactionId
    );

    const relDir = path.posix.join(
        'uploads',
        'aadhaar',
        transactionId
    );

    ensureDir(absDir);

    const pdfPath = await saveFile(
        data?.pdfLink,
        absDir,
        relDir,
        'aadhaar.pdf'
    );

    const xmlPath = await saveFile(
        data?.docLink || data?.link,
        absDir,
        relDir,
        'aadhaar.xml'
    );

    /* -------------------- DB TRANSACTION -------------------- */

    await AppDataSource.manager.transaction(async (manager) => {
        await manager.save(kyc);

        if (pdfPath) {
            await manager.save(Document, {
                customerId: kyc.customerId,
                applicantId: kyc.applicantId,
                coApplicantId: kyc.coApplicantId,
                documentType: 'AADHAAR_PDF',
                fileName: 'aadhaar.pdf',
                filePath: pdfPath,
                mimeType: 'application/pdf',
                verified: true,
                status: 'verified',
                uploadedBy: 1, // system user
            });
        }

        if (xmlPath) {
            await manager.save(Document, {
                customerId: kyc.customerId,
                applicantId: kyc.applicantId,
                coApplicantId: kyc.coApplicantId,
                documentType: 'AADHAAR_XML',
                fileName: 'aadhaar.xml',
                filePath: xmlPath,
                mimeType: 'application/xml',
                verified: true,
                status: 'verified',
                uploadedBy: 1, // system user
            });
        }
    });

    console.log(`✅ Aadhaar VERIFIED and stored txn=${transactionId}`);
}
