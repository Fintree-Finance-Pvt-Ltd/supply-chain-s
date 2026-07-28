import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './Customer';

@Entity('case_reminder_logs')
@Index(
  ['customerId', 'referenceType', 'referenceId', 'reminderType', 'reminderDate'],
  { unique: true },
)
export class CaseReminderLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 50 })
  referenceType: string;

  @Column({ type: 'int', nullable: true })
  referenceId: number | null;

  @Column({ type: 'varchar', length: 50 })
  reminderType: string;

  @Column({ type: 'date' })
  reminderDate: Date;

  @Column({ type: 'date' })
  scheduledFor: Date;

  @Column({ type: 'text', nullable: true })
  sentTo: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'sent' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}
