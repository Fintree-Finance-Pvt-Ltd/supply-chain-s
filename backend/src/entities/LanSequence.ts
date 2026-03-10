import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Partner } from './Partner';

export enum LENDER {
  KITE = 'KITE',
  FFPL = 'FFPL',
  MFL = 'MFL',
}

/**
 * @deprecated Use Partner entity instead. This enum is kept for backward compatibility.
 */

@Entity('lan_sequences')
export class LanSequence {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  partnerId: number;

  /**
   * @deprecated Use partner relation instead. Kept for backward compatibility.
   */
  @Column({ type: 'enum', enum: LENDER, nullable: true })
  lender: LENDER;

  @Column({ type: 'int', default: 10000100 })
  currentValue: number;

  @Column({ type: 'varchar', length: 10 })
  prefix: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Partner, (partner) => partner.lanSequences)
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;
}
