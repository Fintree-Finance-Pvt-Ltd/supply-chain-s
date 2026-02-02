import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApprovalInstance } from './ApprovalInstance';
import { User } from './User';
import { APPROVAL_STATUS } from '../config/constants';

@Entity('approval_actions')
export class ApprovalAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  approvalInstanceId: string;

  @Column({ type: 'int' })
  approverId: number;

  @Column({ type: 'enum', enum: Object.values(APPROVAL_STATUS) })
  action: string; // approved, rejected

  @Column({ type: 'int' })
  stepOrder: number; // Which step this action was for

  @Column({ type: 'text', nullable: true })
  comments: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => ApprovalInstance, (instance) => instance.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approvalInstanceId' })
  approvalInstance: ApprovalInstance;

  @ManyToOne(() => User, (user) => user.approvalActions)
  @JoinColumn({ name: 'approverId' })
  approver: User;
}

