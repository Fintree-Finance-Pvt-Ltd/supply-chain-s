import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './RolePermission';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string; // e.g., 'users.create', 'cases.view'

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  resource: string; // e.g., 'users', 'cases', 'approvals'

  @Column({ type: 'varchar', length: 50 })
  action: string; // e.g., 'create', 'read', 'update', 'delete'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermission[];
}


