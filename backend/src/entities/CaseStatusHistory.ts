import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { User } from './User';
import { CASE_STATUS } from '../config/constants';

@Entity('case_status_history')
export class CaseStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS) })
  status: string;

  @Column({ type: 'enum', enum: Object.values(CASE_STATUS), nullable: true })
  previousStatus: string;

  @Column({ type: 'uuid' })
  changedBy: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.statusHistory)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.statusHistory)
  @JoinColumn({ name: 'changedBy' })
  changedByUser: User;
}

