import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { UserRole } from './UserRole';
import { RolePermission } from './RolePermission';
import { ApprovalStep } from './ApprovalStep';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string; // e.g., 'admin', 'relationship_manager'

  @Column({ type: 'varchar', length: 255 })
  label: string; // e.g., 'Admin', 'Relationship Manager'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => ApprovalStep, (step) => step.approverRole)
  approvalSteps: ApprovalStep[];
}


