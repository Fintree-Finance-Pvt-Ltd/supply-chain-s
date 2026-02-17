import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { KycDetail } from './KycDetail';
import { Document } from './Document';
import { GENDERS } from '../config/constants';

@Entity('co_applicants')
export class CoApplicant {
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

    @Column({ type: 'varchar', length: 20, nullable: true })
pan: string;


    @Column({ type: 'enum', enum: Object.values(GENDERS), nullable: true })
    gender: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Customer, (customer) => customer.coApplicants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @OneToMany(() => KycDetail, (kycDetail) => kycDetail.coApplicant)
    kycDetails: KycDetail[];
    


    @OneToMany(() => Document, (document) => document.coApplicant)
    documents: Document[];
}
