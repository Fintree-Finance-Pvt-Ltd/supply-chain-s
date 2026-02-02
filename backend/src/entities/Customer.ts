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
import { CASE_STATUS } from '../config/constants';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  pan: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  aadhaar: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  electricityBillNo: string;

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS), default: CASE_STATUS.DRAFT })
  status: string;

  @Column({ type: 'boolean', default: false })
  kycVerified: boolean;

  @Column({ type: 'uuid' })
  rmId: string; // Relationship Manager who created this

  @Column({ type: 'text', nullable: true })
  remarks: string;

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

  @OneToMany(() => CreditSanction, (sanction) => sanction.customer)
  creditSanctions: CreditSanction[];

  @OneToMany(() => PostSanction, (postSanction) => postSanction.customer)
  postSanctions: PostSanction[];

  @OneToMany(() => OperationsCheck, (opsCheck) => opsCheck.customer)
  operationsChecks: OperationsCheck[];

  @OneToMany(() => CaseStatusHistory, (history) => history.customer)
  statusHistory: CaseStatusHistory[];
}

