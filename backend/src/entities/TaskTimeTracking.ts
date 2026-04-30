import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { CaseWorkflow } from './CaseWorkflow';

/**
 * Task Time Tracking Entity
 * Tracks time metrics for task completion per user
 */
@Entity('task_time_tracking')
export class TaskTimeTracking {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int', nullable: true })
  caseWorkflowId: number | null; // Link to CaseWorkflow for customer name join

  @Column({ type: 'varchar', length: 255 })
  taskId: string; // Task identifier (could be customer_id, case_id, etc.)

  @Column({ type: 'varchar', length: 100 })
  taskType: string; // e.g., 'kyc', 'credit', 'approval', 'document'

  @Column({ type: 'varchar', length: 100, nullable: true })
  bucket: string | null; // Role-based bucket assignment

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date; // When task was assigned

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date; // When user started working on task

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date; // When task was completed

  @Column({ type: 'int', nullable: true })
  totalCompletionTimeMinutes: number; // Total time from assigned to completed

  @Column({ type: 'int', nullable: true })
  l1ProcessingTimeMinutes: number; // L1 stage processing time

  @Column({ type: 'int', nullable: true })
  l2ProcessingTimeMinutes: number; // L2 stage processing time

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string; // 'pending', 'in_progress', 'completed', 'overdue'

  @Column({ type: 'boolean', default: false })
  isOverdue: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.id, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => CaseWorkflow, (workflow) => workflow.id, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'caseWorkflowId' })
  caseWorkflow: CaseWorkflow;
}
