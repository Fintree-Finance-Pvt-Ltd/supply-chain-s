import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { Customer } from './Customer';
import { Applicant } from './Applicant';
import { CoApplicant } from './CoApplicant';
import { KycOwnerType } from './KycVerificationStatus';

export enum OtpSessionStatus {
    SENT = 'SENT',
    VERIFIED = 'VERIFIED',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED',
}

export enum IdentifierType {
    MOBILE = 'MOBILE',
    EMAIL = 'EMAIL',
}

@Entity('otp_sessions')
@Index(['customerId', 'ownerType', 'applicantId', 'coApplicantId', 'identifier', 'identifierType'])
export class OtpSession {

    @PrimaryGeneratedColumn('increment')
    id: number;

    // --------------------------------------------------
    // BASIC INFO
    // --------------------------------------------------

    @Column({ type: 'int', nullable: true })
    customerId: number | null;

    @Column({ type: 'varchar', length: 255 })
    identifier: string; // email or mobile

    @Column({ type: 'enum', enum: IdentifierType })
    identifierType: IdentifierType;

    // --------------------------------------------------
    // 🔥 NEW OWNER STRUCTURE
    // --------------------------------------------------

    @Column({ type: 'enum', enum: KycOwnerType })
    ownerType: KycOwnerType;

    @Column({ type: 'int', nullable: true })
    applicantId: number | null;

    @Column({ type: 'int', nullable: true })
    coApplicantId: number | null;

    // --------------------------------------------------
    // OTP DETAILS
    // --------------------------------------------------

    @Column({ type: 'varchar', length: 10 })
    otp: string;

    @Column({ type: 'varchar', length: 50, default: 'ONBOARDING' })
    purpose: string;

    @Column({ type: 'enum', enum: OtpSessionStatus, default: OtpSessionStatus.SENT })
    status: OtpSessionStatus;

    @Column({ type: 'int', default: 0 })
    attempts: number;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: false })
    consentAccepted: boolean;

    @Column({ type: "text", nullable: true })
    consentText: string;

    // --------------------------------------------------
    // RELATIONS
    // --------------------------------------------------

    @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @ManyToOne(() => Applicant, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'applicantId' })
    applicant: Applicant | null;

    @ManyToOne(() => CoApplicant, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'coApplicantId' })
    coApplicant: CoApplicant | null;
}
