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

@Entity('sanction_limit_history')
export class SanctionLimitHistory {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'decimal', precision: 15, scale: 2 })
    sanctionAmount: number;

    @Column({ type: 'int' })
    tenure: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    interestRate: number;

    @Column({ type: 'text', nullable: true })
    remarks: string;

    @Column({ type: 'varchar', length: 50 })
    changedByRole: string; // 'CREDIT_L2', 'CEO', 'MD'

    @Column({ type: 'int' })
    changedByUserId: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Customer)
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'changedByUserId' })
    changedByUser: User;
}
