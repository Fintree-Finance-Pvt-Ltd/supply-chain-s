import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './Customer';
import { KycVerificationStatus } from './KycVerificationStatus';
import { Document } from './Document';

@Entity('applicants')
@Index(['customerId'], { unique: true }) // ✅ enforce 1 applicant per customer
export class Applicant {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  // make nullable because applicant may be filled after company flow
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pan: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ✅ 1 Applicant <-> 1 Customer
  @OneToOne(() => Customer, (customer) => customer.applicant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @OneToMany(() => KycVerificationStatus, (kyc) => kyc.applicant)
  kycStatuses: KycVerificationStatus[];

  @OneToMany(() => Document, (document) => document.applicant)
  documents: Document[];
}
