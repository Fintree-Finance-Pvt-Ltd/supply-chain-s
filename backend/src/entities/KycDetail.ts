import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { CoApplicant } from './CoApplicant';
import { KYC_TYPES } from '../config/constants';

@Entity('kyc_details')
export class KycDetail {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'varchar', length: 50, default: 'applicant' })
    applicantType: string; // 'applicant' or 'co-applicant'

    @Column({ type: 'int', default: 0 })
    applicantIndex: number; // 0 for main applicant, 1,2,3... for co-applicants

    @Column({ type: 'int', nullable: true })
    coApplicantId: number | null;

    @Column({ type: 'enum', enum: Object.values(KYC_TYPES) })
    kycType: string; // PAN, GST, AADHAAR

    @Column({ type: 'varchar', length: 100 })
    kycNumber: string;

    @Column({ type: 'boolean', default: false })
    verified: boolean;

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date | null;

    @Column({ type: 'int', nullable: true })
    verifiedBy: number | null;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Customer, (customer) => customer.kycDetails, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @ManyToOne(() => CoApplicant, (coApp) => coApp.kycDetails, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'coApplicantId' })
    coApplicant: CoApplicant;
}
