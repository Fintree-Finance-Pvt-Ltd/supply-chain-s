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
import { User } from './User';
import { CoApplicant } from './CoApplicant';
import { Applicant } from './Applicant';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  // ✅ NEW (for applicant documents)
  @Column({ type: 'int', nullable: true })
  applicantId: number | null;

  // ✅ already exists (for co-applicant documents)
  @Column({ type: 'int', nullable: true })
  coApplicantId: number | null;

  @Column({ type: 'varchar', length: 50 })
  documentType: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ type: 'int' })
  uploadedBy: number;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'int', nullable: true })
  verifiedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  rmRemarks: string;

  @Column({ type: 'timestamp', nullable: true })
issueDate: Date;

@Column({ type: 'timestamp', nullable: true })
expiryDate: Date;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Applicant, (applicant) => applicant.documents, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'applicantId' })
  applicant: Applicant | null;

  @ManyToOne(() => CoApplicant, (coApp) => coApp.documents, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'coApplicantId' })
  coApplicant: CoApplicant | null;

  @ManyToOne(() => User, (user) => user.uploadedDocuments)
  @JoinColumn({ name: 'uploadedBy' })
  uploadedByUser: User;
}
