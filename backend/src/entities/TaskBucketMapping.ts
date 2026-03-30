import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './Role';

/**
 * Task Bucket Mapping Entity
 * Maps roles to task buckets for automatic task distribution
 */
@Entity('task_bucket_mapping')
export class TaskBucketMapping {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  roleId: number;

  @Column({ type: 'varchar', length: 100 })
  bucketName: string; // e.g., 'Bucket A', 'Bucket B', 'Bucket C'

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number; // Processing priority within bucket

  @Column({ type: 'varchar', length: 100, nullable: true })
  taskTypeFilter: string; // Optional filter for task types

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Role, (role) => role.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;
}

/**
 * Performance Metrics Cache Entity
 * Stores aggregated performance metrics for quick dashboard access
 */
@Entity('performance_metrics_cache')
export class PerformanceMetricsCache {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  roleId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bucket: string | null;

  @Column({ type: 'varchar', length: 50 })
  metricType: string; // 'user', 'role', 'bucket', 'overall'

  @Column({ type: 'int', default: 0 })
  tasksAssigned: number;

  @Column({ type: 'int', default: 0 })
  tasksCompleted: number;

  @Column({ type: 'int', default: 0 })
  tasksPending: number;

  @Column({ type: 'int', default: 0 })
  tasksOverdue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgCompletionTimeMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgL1TimeMinutes: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgL2TimeMinutes: number;

  @Column({ type: 'int', default: 0 })
  totalPoints: number;

  @Column({ type: 'int', default: 0 })
  rank: number | null; // Performance ranking

  @Column({ type: 'varchar', length: 20 })
  period: string; // 'daily', 'weekly', 'monthly', 'overall'

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @CreateDateColumn()
  calculatedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}