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
import { GENDERS } from '../config/constants';

@Entity('contact_persons')
export class ContactPerson {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 20 })
    mobile: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    designation: string | null;

    @Column({ type: 'enum', enum: Object.values(GENDERS), nullable: true })
    gender: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Customer, (customer) => customer.contactPersons, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;
}
