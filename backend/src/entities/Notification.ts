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

/**
 * Notification Entity
 * Represents notifications sent to customers
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ 
    type: 'enum', 
    enum: ['LOAN', 'DRAWDOWN', 'REPAYMENT', 'PAYMENT', 'KYC', 'DOCUMENT', 'GENERAL', 'ALERT', 'SYSTEM'],
    default: 'GENERAL' 
  })
  type: string;

  @Column({ 
    type: 'enum', 
    enum: ['UNREAD', 'READ'],
    default: 'UNREAD' 
  })
  readStatus: string;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  // Optional reference to related entity
  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType: string; // LOAN, DRAWDOWN, TRANSACTION, INVOICE

  @Column({ type: 'int', nullable: true })
  referenceId: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  actionUrl: string; // Deep link for the app

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, customer => customer.notifications)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}
