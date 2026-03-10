import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LoanAccount } from './LoanAccount';
import { LanSequence } from './LanSequence';

export enum PARTNER_STATUS {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  code: string; // Used as LAN prefix (FFPL, MFL, KITE)

  @Column({ type: 'varchar', length: 10 })
  lanPrefix: string; // LAN prefix (FFPL, MFL, KITE)

  @Column({ 
    type: 'enum', 
    enum: PARTNER_STATUS, 
    default: PARTNER_STATUS.ACTIVE 
  })
  status: PARTNER_STATUS;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => LoanAccount, (loanAccount) => loanAccount.partner)
  loanAccounts: LoanAccount[];

  @OneToMany(() => LanSequence, (lanSequence) => lanSequence.partner)
  lanSequences: LanSequence[];
}
