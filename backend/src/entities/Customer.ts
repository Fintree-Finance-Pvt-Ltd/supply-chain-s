import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  OneToOne,
} from 'typeorm';

import { User } from './User';
import { Document } from './Document';
import { CreditSanction } from './CreditSanction';
import { PostSanction } from './PostSanction';
import { OperationsCheck } from './OperationsCheck';
import { CaseStatusHistory } from './CaseStatusHistory';
import { KycDetail } from './KycDetail';
import { CoApplicant } from './CoApplicant';
import { Applicant } from './Applicant';
import { Supplier } from './Supplier';
import { Invoice } from './Invoice';
import { CaseWorkflow } from './CaseWorkflow';
import { ContactPerson } from './ContactPerson';
import { CustomerAddress } from './CustomerAddress';
import { KycVerificationStatus } from './KycVerificationStatus';

import { CASE_STATUS, COMPANY_TYPES } from '../config/constants';
import { Loan } from './Loan';
import { Drawdown } from './Drawdown';
import { Notification } from './Notification';
import { RefreshToken } from './RefreshToken';
import { SanctionLimitHistory } from './SanctionLimitHistory';
import { LoanAccount } from './LoanAccount';

@Entity('customers')
export class Customer {

  @PrimaryGeneratedColumn('increment')
  id: number;

  // =====================================================
  // 🔹 OLD PERSONAL FIELDS (DO NOT REMOVE)
  // =====================================================

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pan: string;

  // =====================================================
  // 🔹 COMPANY FIELDS
  // =====================================================

  @Column({ type: 'enum', enum: Object.values(COMPANY_TYPES), nullable: true })
  companyType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  companyMobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  companyPan: string;

  @Column({ type: 'varchar', length: 15, nullable: true, unique: true })
  gstNumber: string;

  // =====================================================
  // 🔹 CASE / BUSINESS META
  // =====================================================

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS), default: CASE_STATUS.DRAFT })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customerName: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  customerCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industryType: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  annualTurnover: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  pushedTo: string;

  @Column({ type: 'boolean', default: false })
  kycVerified: boolean;

  @Column({ type: 'int' })
  rmId: number;

  @Column({ type: 'int', nullable: true })
  assignedUserId: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  assignedStage: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // =====================================================
  // 🔹 BANKING
  // =====================================================

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankAccountNo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankIfscCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankBranch: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bankType: string;

  @Column({ type: 'enum', enum: ['pending', 'completed'], default: 'pending' })
  eNachStatus: string;

  @Column({ type: 'enum', enum: ['pending', 'completed'], default: 'pending' })
  eSignStatus: string;

  // =====================================================
  // 🔹 TIMESTAMPS
  // =====================================================

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =====================================================
  // 🔹 RELATIONS (ALL OLD + NEW SAFE)
  // =====================================================

  @ManyToOne(() => User, (user) => user.customers)
  @JoinColumn({ name: 'rmId' })
  rm: User;

  @ManyToOne(() => User, (user) => user.assignedCustomers, { nullable: true })
  @JoinColumn({ name: 'assignedUserId' })
  assignedUser: User;

  @OneToMany(() => Document, (document) => document.customer)
  documents: Document[];

  @OneToMany(() => KycDetail, (kycDetail) => kycDetail.customer)
  kycDetails: KycDetail[];

  @OneToMany(() => CoApplicant, (coApp) => coApp.customer)
  coApplicants: CoApplicant[];

  @OneToOne(() => Applicant, (applicant) => applicant.customer, { cascade: true })
  applicant: Applicant;

  @OneToMany(() => KycVerificationStatus, (kyc) => kyc.customer)
  kycStatuses: KycVerificationStatus[];

  @OneToMany(() => CreditSanction, (sanction) => sanction.customer)
  creditSanctions: CreditSanction[];

  @OneToMany(() => SanctionLimitHistory, (sanctionLimit) => sanctionLimit.customer)
  sanctionLimitHistory: SanctionLimitHistory[];

  @OneToMany(() => PostSanction, (postSanction) => postSanction.customer)
  postSanctions: PostSanction[];

  @OneToMany(() => OperationsCheck, (opsCheck) => opsCheck.customer)
  operationsChecks: OperationsCheck[];

  @OneToMany(() => CaseStatusHistory, (history) => history.customer)
  statusHistory: CaseStatusHistory[];

  @OneToMany(() => Supplier, (supplier) => supplier.customer)
  suppliers: Supplier[];

  @OneToMany(() => Invoice, (invoice) => invoice.customer)
  invoices: Invoice[];

  @OneToMany(() => CaseWorkflow, (workflow) => workflow.customer)
  workflows: CaseWorkflow[];

  @OneToMany(() => ContactPerson, (contact) => contact.customer, { cascade: true })
  contactPersons: ContactPerson[];

  @OneToMany(() => CustomerAddress, (address) => address.customer, { cascade: true })
  addresses: CustomerAddress[];

  // =====================================================
  // 🔹 NEW SCF CUSTOMER APP RELATIONS
  // =====================================================

  @OneToMany(() => Loan, (loan) => loan.customer)
  loans: Loan[];

  @OneToMany(() => Drawdown, (drawdown) => drawdown.customer)
  drawdowns: Drawdown[];

  @OneToMany(() => Notification, (notification) => notification.customer)
  notifications: Notification[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.customer)
  refreshTokens: RefreshToken[];

  @OneToMany(() => LoanAccount, (loanAccount) => loanAccount.customer)
  loanAccounts: LoanAccount[];
}
