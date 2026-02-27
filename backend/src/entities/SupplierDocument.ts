import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from './Supplier';

@Entity('supplier_documents')
export class SupplierDocument {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  supplierId: number;

  @Column({ type: 'varchar', length: 30 })
  documentType: string; // CHEQUE

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType?: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize?: number;

  @Column()
  uploadedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Supplier, (s: any) => s.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;
}