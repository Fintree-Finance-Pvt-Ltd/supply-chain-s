import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Customer } from './Customer';
import { CoApplicant } from './CoApplicant';
import { Applicant } from './Applicant';

export enum KycStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export enum KycOwnerType {
  COMPANY = 'COMPANY',
  APPLICANT = 'APPLICANT',
  CO_APPLICANT = 'CO_APPLICANT',
}

/**
 * ✅ Design: 1 row per "owner"
 * - COMPANY row: ownerType=COMPANY, applicantId=null, coApplicantId=null
 * - APPLICANT row: ownerType=APPLICANT, applicantId=<id>, coApplicantId=null
 * - CO_APPLICANT row: ownerType=CO_APPLICANT, applicantId=null, coApplicantId=<id>
 */
@Entity('kyc_verification_status')
@Index(['customerId', 'ownerType', 'applicantId', 'coApplicantId'], { unique: true })
export class KycVerificationStatus {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'enum', enum: KycOwnerType })
  ownerType: KycOwnerType;

  @Column({ type: 'int', nullable: true })
  applicantId: number | null;

  @Column({ type: 'int', nullable: true })
  coApplicantId: number | null;

  // -------------------------
  // Status Fields (KEEP)
  // -------------------------
  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  panStatus: KycStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  gstStatus: KycStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  aadhaarStatus: KycStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  bureauStatus: KycStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  mobileStatus: KycStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  emailStatus: KycStatus;

  // -------------------------
  // Aadhaar Metadata (KEEP)
  // -------------------------
  @Column({ type: 'varchar', length: 255, nullable: true })
  aadhaarTransactionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aadhaarName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  aadhaarMaskedNumber: string;

  @Column({ type: 'date', nullable: true })
  aadhaarDob: Date;

  @Column({ type: 'text', nullable: true })
  aadhaarAddress: string;

  // -------------------------
  // API Audit Fields (KEEP ALL)
  // -------------------------
  @Column({ type: 'json', nullable: true })
  panApiRequest: any;

  @Column({ type: 'json', nullable: true })
  panApiResponse: any;

  @Column({ type: 'json', nullable: true })
  gstApiRequest: any;

  @Column({ type: 'json', nullable: true })
  gstApiResponse: any;

  @Column({ type: 'json', nullable: true })
  aadhaarApiRequest: any;

  @Column({ type: 'json', nullable: true })
  aadhaarApiResponse: any;

  @Column({ type: 'json', nullable: true })
  bureauApiRequest: any;

  @Column({ type: 'json', nullable: true })
  bureauApiResponse: any;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;

  // -------------------------
  // Relations
  // -------------------------
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Applicant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'applicantId' })
  applicant: Applicant | null;

  @ManyToOne(() => CoApplicant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'coApplicantId' })
  coApplicant: CoApplicant | null;
}
