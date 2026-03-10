import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from './Customer';
import { Partner } from './Partner';

export enum LENDER {
  KITE = 'KITE',
  FFPL = 'FFPL',
  MFL = 'MFL',
}

/**
 * @deprecated Use Partner entity instead. This enum is kept for backward compatibility.
 */

@Entity('loan_accounts')
export class LoanAccount {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'int', nullable: true })
  partnerId: number;

  /**
   * @deprecated Use partner relation instead. Kept for backward compatibility.
   */
  @Column({ type: 'enum', enum: LENDER, nullable: true })
  lender: LENDER;

  @Column({ type: 'varchar', length: 50, unique: true })
  lanId: string; // Loan Account Number (auto-generated)

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  sanctionedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  disbursedAmount: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // active, closed, defaulted

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.loanAccounts)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Partner, (partner) => partner.loanAccounts)
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;
}
