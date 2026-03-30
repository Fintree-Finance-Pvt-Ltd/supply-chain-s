import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';

/**
 * Reward Points Entity
 * Stores reward points awarded for task completion
 * NOTE: CEO and MD are NOT eligible for reward points
 */
@Entity('reward_points')
export class RewardPoint {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 255 })
  taskId: string; // Reference to the completed task

  @Column({ type: 'int' })
  points: number; // Points awarded (1-5)

  @Column({ type: 'varchar', length: 50 })
  completionSpeedCategory: string; // 'fast', 'medium', 'slow'

  @Column({ type: 'int', default: 0 })
  completionTimeMinutes: number; // Time taken to complete

  @Column({ type: 'varchar', length: 100, nullable: true })
  bucket: string | null; // Task bucket for reporting

  @Column({ type: 'varchar', length: 50, nullable: true })
  taskType: string | null; // Type of task completed

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null; // Description of why points were awarded

  @CreateDateColumn()
  awardedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}

/**
 * Reward Configuration Entity
 * Stores configurable reward point settings (SUPERADMIN controlled)
 */
@Entity('reward_configuration')
export class RewardConfiguration {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  category: string; // 'fast', 'medium', 'slow'

  @Column({ type: 'int' })
  points: number; // Points for this category (1-5)

  @Column({ type: 'int', nullable: true })
  maxMinutes: number | null; // Max minutes for this category

  @Column({ type: 'int', nullable: true })
  minMinutes: number | null; // Min minutes for this category

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}