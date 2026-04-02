import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum REPAYMENT_UPLOAD_STATUS {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  FAILED = 'FAILED',
}

@Entity('repayment_collections')
@Index(['lan', 'collectionUtr'], { unique: true })
@Index(['status'])
@Index(['createdAt'])
export class RepaymentUpload {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 50, name: 'lan' })
  lan: string;

  @Column({ type: 'date', name: 'collection_date' })
  collectionDate: Date;

  @Column({ type: 'varchar', length: 100, name: 'collection_utr' })
  collectionUtr: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'collection_amount' })
  collectionAmount: number;

  @Column({
    type: 'enum',
    enum: REPAYMENT_UPLOAD_STATUS,
    default: REPAYMENT_UPLOAD_STATUS.PENDING,
    name: 'status',
  })
  status: REPAYMENT_UPLOAD_STATUS;

  @Column({ type: 'text', nullable: true, name: 'lms_response' })
  lmsResponse: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'int', nullable: true, name: 'uploaded_by' })
  uploadedBy: number;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'datetime', nullable: true, name: 'uploaded_at' })
  uploadedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}