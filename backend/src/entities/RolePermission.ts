import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './Role';
import { Permission } from './Permission';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  roleId: number;

  @Column({ type: 'int' })
  permissionId: number;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Role, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  permission: Permission;
}


