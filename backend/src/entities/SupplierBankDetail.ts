import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Supplier } from './Supplier';

@Entity('supplier_bank_details')
export class SupplierBankDetail {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true })
  supplierId: number;

  @Column({ type: 'varchar', length: 50 })
  bankAccountNumber: string;

  @Column({ type: 'varchar', length: 20 })
  ifscCode: string;

  @Column({ type: 'varchar', length: 120 })
  bankName: string;

  @Column({ type: 'varchar', length: 120 })
  accountHolderName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  micrCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  chequeNumber: string;

  @Column({ nullable: true })
  chequeDocumentId?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Supplier, (s: any) => s.bankDetail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;
}