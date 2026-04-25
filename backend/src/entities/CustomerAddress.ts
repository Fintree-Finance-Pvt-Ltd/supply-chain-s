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
import { ADDRESS_TYPES } from '../config/constants';

@Entity('customer_addresses')
export class CustomerAddress {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'enum', enum: Object.values(ADDRESS_TYPES) })
    type: string;

  @Column({
  type: 'enum',
  enum: ['Owned', 'Rented'],
})
ownership: string;

    @Column({ type: 'text' })
    fullAddress: string;

    @Column({ type: 'varchar', length: 10 })
    pincode: string;

    @Column({ type: 'varchar', length: 100 })
    state: string;

    @Column({ type: 'varchar', length: 100 })
    city: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Customer, (customer) => customer.addresses, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;
}
