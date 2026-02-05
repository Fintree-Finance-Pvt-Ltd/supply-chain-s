import { Request, Response } from 'express';
import { RoleService } from '../services/role.service';

export class RoleController {
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
  }

  createRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, label, description } = req.body;

      if (!name || !label) {
        res.status(400).json({
          success: false,
          message: 'Name and label are required',
        });
        return;
      }

      const role = await this.roleService.createRole({
        name,
        label,
        description,
      });

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create role',
      });
    }
  };

  getRoles = async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = await this.roleService.getRoles();

      res.json({
        success: true,
        data: roles,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch roles',
      });
    }
  };

  getRoleById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Role ID is required',
        });
        return;
      }

      const role = await this.roleService.getRoleById(Number(id));

      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found',
        });
        return;
      }

      res.json({
        success: true,
        data: role,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch role',
      });
    }
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { label, description, isActive } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Role ID is required',
        });
        return;
      }

      const role = await this.roleService.updateRole(Number(id), {
        label,
        description,
        isActive,
      });

      res.json({
        success: true,
        message: 'Role updated successfully',
        data: role,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update role',
      });
    }
  };

  deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Role ID is required',
        });
        return;
      }

      await this.roleService.deleteRole(Number(id));

      res.json({
        success: true,
        message: 'Role deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete role',
      });
    }
  };

  toggleRoleStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Role ID is required',
        });
        return;
      }

      const role = await this.roleService.toggleRoleStatus(Number(id));

      res.json({
        success: true,
        message: `Role ${role.isActive ? 'activated' : 'deactivated'} successfully`,
        data: role,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to toggle role status',
      });
    }
  };

  assignPermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleId, permissionId } = req.body;

      if (!roleId || !permissionId) {
        res.status(400).json({
          success: false,
          message: 'Role ID and Permission ID are required',
        });
        return;
      }

      const rolePermission = await this.roleService.assignPermission(Number(roleId), Number(permissionId));

      res.json({
        success: true,
        message: 'Permission assigned to role successfully',
        data: rolePermission,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to assign permission',
      });
    }
  };

  removePermission = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roleId, permissionId } = req.body;

      if (!roleId || !permissionId) {
        res.status(400).json({
          success: false,
          message: 'Role ID and Permission ID are required',
        });
        return;
      }

      await this.roleService.removePermission(Number(roleId), Number(permissionId));

      res.json({
        success: true,
        message: 'Permission removed from role successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to remove permission',
      });
    }
  };
}
