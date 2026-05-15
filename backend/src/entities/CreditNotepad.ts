import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Customer } from './Customer';
import { User } from './User';

export const CREDIT_NOTEPAD_SECTIONS = {
  CREDIT_MAKER: 'credit_maker',
  CEO_CHECKER: 'ceo_checker',
} as const;

export type CreditNotepadSection =
  typeof CREDIT_NOTEPAD_SECTIONS[keyof typeof CREDIT_NOTEPAD_SECTIONS];

@Entity('credit_notepads')
@Unique(['customerId', 'sanctionKey', 'section'])
export class CreditNotepad {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 50 })
  section: CreditNotepadSection;

  @Column({ type: 'varchar', length: 50, default: 'general' })
  sanctionKey: string;

  @Column({ type: 'mediumtext', nullable: true })
  content: string | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @Column({ type: 'int', nullable: true })
  updatedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedByUserId' })
  updatedByUser: User | null;
}
