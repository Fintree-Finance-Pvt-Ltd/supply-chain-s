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
import { User } from './User';
import { DOCUMENT_TYPES } from '../config/constants';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'enum', enum: Object.values(DOCUMENT_TYPES) })
  documentType: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number; // in bytes

  @Column({ type: 'int' })
  uploadedBy: number;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'int', nullable: true })
  verifiedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Customer, (customer) => customer.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => User, (user) => user.uploadedDocuments)
  @JoinColumn({ name: 'uploadedBy' })
  uploadedByUser: User;
}

