import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Document } from './Document';
import { CreditSanction } from './CreditSanction';
import { PostSanction } from './PostSanction';
import { OperationsCheck } from './OperationsCheck';
import { CaseStatusHistory } from './CaseStatusHistory';
import { KycDetail } from './KycDetail';
import { CoApplicant } from './CoApplicant';
import { Supplier } from './Supplier';
import { Invoice } from './Invoice';
import { CaseWorkflow } from './CaseWorkflow';
import { ContactPerson } from './ContactPerson';
import { CustomerAddress } from './CustomerAddress';
import { CASE_STATUS, COMPANY_TYPES } from '../config/constants';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'enum', enum: Object.values(COMPANY_TYPES), nullable: true })
  companyType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string;

  @Column({ type: 'varchar', length: 15, nullable: true, unique: true })
  gstNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  electricityBillNo: string;

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

  @Column({ type: 'varchar', length: 50, nullable: true })
  lanId: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  pushedTo: string; // Comma-separated list of entities (Credit Team, Kite, etc.)

  @Column({ type: 'boolean', default: false })
  kycVerified: boolean;

  @Column({ type: 'int' })
  rmId: number; // Relationship Manager who created this

  @Column({ type: 'text', nullable: true })
  remarks: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.customers)
  @JoinColumn({ name: 'rmId' })
  rm: User;

  @OneToMany(() => Document, (document) => document.customer)
  documents: Document[];

  @OneToMany(() => KycDetail, (kycDetail) => kycDetail.customer)
  kycDetails: KycDetail[];

  @OneToMany(() => CoApplicant, (coApp) => coApp.customer)
  coApplicants: CoApplicant[];

  @OneToMany(() => CreditSanction, (sanction) => sanction.customer)
  creditSanctions: CreditSanction[];

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
}


