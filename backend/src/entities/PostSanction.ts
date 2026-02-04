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

@Entity('post_sanctions')
export class PostSanction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  customerId: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  esignStatus: string; // pending, completed, failed

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  enachStatus: string; // pending, completed, failed

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: false })
  isReadyForOps: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.postSanctions)
  @JoinColumn({ name: 'customerId' })
  customer: Customer;
}


