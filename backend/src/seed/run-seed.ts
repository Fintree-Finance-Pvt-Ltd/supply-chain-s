import { AppDataSource } from '../config/database';
import { hashPassword } from '../utils/password';
import { User, Role, Permission, UserRole, RolePermission, ApprovalFlow, ApprovalStep } from '../entities';
import { ROLES } from '../config/constants';

/**
 * Seed script to populate database with initial data
 * Run: npm run seed
 */
async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Synchronize database schema
    console.log('Creating database schema...');
    await AppDataSource.synchronize();
    console.log('✅ Database schema synchronized');

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const userRoleRepository = AppDataSource.getRepository(UserRole);
    const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    const approvalFlowRepository = AppDataSource.getRepository(ApprovalFlow);
    const approvalStepRepository = AppDataSource.getRepository(ApprovalStep);

    // Clear existing data to ensure clean seed with numeric IDs
    console.log('Clearing existing data...');
    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    
    try { await rolePermissionRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await userRoleRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await userRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await permissionRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await approvalStepRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await approvalFlowRepository.clear(); } catch (e) { /* Table may not exist */ }
    try { await roleRepository.clear(); } catch (e) { /* Table may not exist */ }
    
    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Existing data cleared');

    // Create Roles
    console.log('Creating roles...');
    const roles = [
      { name: ROLES.SUPERADMIN, label: 'Super Admin', description: 'Super Administrator - Full system access' },
      { name: ROLES.ADMIN, label: 'Admin', description: 'System Administrator' },
      { name: ROLES.RELATIONSHIP_MANAGER, label: 'Relationship Manager', description: 'Manages customer relationships' },
      { name: ROLES.CREDIT_TEAM_L1, label: 'Credit Team L1', description: 'Credit Team Level 1 - Initial review' },
      { name: ROLES.CREDIT_TEAM_L2, label: 'Credit Team L2', description: 'Credit Team Level 2 - Secondary review' },
      { name: ROLES.OPERATIONS_TEAM_L1, label: 'Operations Team L1', description: 'Operations Team Level 1 - Document verification' },
      { name: ROLES.OPERATIONS_TEAM_L2, label: 'Operations Team L2', description: 'Operations Team Level 2 - Further verification' },
      { name: ROLES.OPERATIONS_HEAD, label: 'Operations Head', description: 'Operations Head - Final operations approval' },
      { name: ROLES.CFO, label: 'CFO', description: 'Chief Financial Officer' },
      { name: ROLES.CEO, label: 'CEO', description: 'Chief Executive Officer' },
      { name: ROLES.MD, label: 'Managing Director', description: 'Managing Director' },
    ];

    const savedRoles: Role[] = [];
    for (const roleData of roles) {
      const role = roleRepository.create({
        name: roleData.name,
        label: roleData.label,
        description: roleData.description,
      });
      const savedRole = await roleRepository.save(role);
      savedRoles.push(savedRole);
    }
    console.log('✅ Roles created');

    // Create default password hash
    const defaultPassword = await hashPassword('password123');

    // Create Users
    console.log('Creating users...');
    const users = [
      { email: 'superadmin@scf.com', name: 'Super Admin', roles: [ROLES.SUPERADMIN] },
      { email: 'admin@scf.com', name: 'Admin User', roles: [ROLES.ADMIN] },
      { email: 'rm@scf.com', name: 'John Doe - RM', roles: [ROLES.RELATIONSHIP_MANAGER] },
      { email: 'credit_l1@scf.com', name: 'Credit Officer L1', roles: [ROLES.CREDIT_TEAM_L1] },
      { email: 'credit_l2@scf.com', name: 'Credit Officer L2', roles: [ROLES.CREDIT_TEAM_L2] },
      { email: 'ops_l1@scf.com', name: 'Operations Officer L1', roles: [ROLES.OPERATIONS_TEAM_L1] },
      { email: 'ops_l2@scf.com', name: 'Operations Officer L2', roles: [ROLES.OPERATIONS_TEAM_L2] },
      { email: 'ops_head@scf.com', name: 'Operations Head', roles: [ROLES.OPERATIONS_HEAD] },
      { email: 'ceo@scf.com', name: 'CEO', roles: [ROLES.CEO] },
      { email: 'cfo@scf.com', name: 'CFO', roles: [ROLES.CFO] },
      { email: 'md@scf.com', name: 'Managing Director', roles: [ROLES.MD] },
      // User with multiple roles for testing
      { email: 'harish@scf.com', name: 'Harish - SuperAdmin + CEO', roles: [ROLES.SUPERADMIN, ROLES.CEO] },
    ];

    const savedUsers: User[] = [];
    for (const userData of users) {
      const user = userRepository.create({
        email: userData.email,
        name: userData.name,
        password: defaultPassword,
        defaultRole: userData.roles[0], // Set primary role as default
      });
      const savedUser = await userRepository.save(user);
      savedUsers.push(savedUser);

      // Assign all roles
      for (const roleName of userData.roles) {
        const role = savedRoles.find(r => r.name === roleName);
        if (role) {
          const userRole = userRoleRepository.create({
            userId: savedUser.id,
            roleId: role.id,
            assignedBy: savedUsers[0]?.id || 1, // Admin assigns
          });
          await userRoleRepository.save(userRole);
        }
      }
    }
    console.log('✅ Users created');

    // Create Approval Flows
    console.log('Creating approval flows...');
    
    // Credit Sanction Customer Approval Flow
    const flow1 = approvalFlowRepository.create({
      name: 'Credit Sanction Customer Approval',
      flowType: 'credit_sanction',
      description: 'Credit Sanction Approval: Credit Team L1 → Credit Team L2 → CEO → Managing Director',
      isActive: true,
      isSequential: true,
    });
    const savedFlow1 = await approvalFlowRepository.save(flow1);

    const creditSteps = [
      { order: 1, roleName: ROLES.CREDIT_TEAM_L1, name: 'Credit Team L1 Review' },
      { order: 2, roleName: ROLES.CREDIT_TEAM_L2, name: 'Credit Team L2 Review' },
      { order: 3, roleName: ROLES.CEO, name: 'CEO Approval' },
      { order: 4, roleName: ROLES.MD, name: 'Managing Director Final Approval' },
    ];

    for (const stepData of creditSteps) {
      const role = savedRoles.find(r => r.name === stepData.roleName);
      if (role) {
        const step = approvalStepRepository.create({
          approvalFlowId: savedFlow1.id,
          approverRoleId: role.id,
          stepOrder: stepData.order,
          stepName: stepData.name,
          isRequired: true,
        });
        await approvalStepRepository.save(step);
      }
    }

    // Operations Approval for Customer Flow
    const flow2 = approvalFlowRepository.create({
      name: 'Operations Approval for Customer',
      flowType: 'operations',
      description: 'Operations Approval: Operations Team L1 → Operations Head',
      isActive: true,
      isSequential: true,
    });
    const savedFlow2 = await approvalFlowRepository.save(flow2);

    const opsSteps = [
      { order: 1, roleName: ROLES.OPERATIONS_TEAM_L1, name: 'Operations Team L1 Verification' },
      { order: 2, roleName: ROLES.OPERATIONS_HEAD, name: 'Operations Head Done' },
    ];

    for (const stepData of opsSteps) {
      const role = savedRoles.find(r => r.name === stepData.roleName);
      if (role) {
        const step = approvalStepRepository.create({
          approvalFlowId: savedFlow2.id,
          approverRoleId: role.id,
          stepOrder: stepData.order,
          stepName: stepData.name,
          isRequired: true,
        });
        await approvalStepRepository.save(step);
      }
    }

    // Invoice Discounting Flow
    const flow3 = approvalFlowRepository.create({
      name: 'Invoice Discounting Flow',
      flowType: 'invoice_discounting',
      description: 'Invoice Discounting: Customer → Operation L1 → L2 → Operation Head → CEO → Managing Director',
      isActive: true,
      isSequential: true,
    });
    const savedFlow3 = await approvalFlowRepository.save(flow3);

    const invoiceSteps = [
      { order: 1, roleName: ROLES.OPERATIONS_TEAM_L1, name: 'Operation L1 Review' },
      { order: 2, roleName: ROLES.OPERATIONS_TEAM_L2, name: 'Operation L2 Review' },
      { order: 3, roleName: ROLES.OPERATIONS_HEAD, name: 'Operation Head Approval' },
      { order: 4, roleName: ROLES.CEO, name: 'CEO Approval' },
      { order: 5, roleName: ROLES.MD, name: 'Managing Director Approval' },
    ];

    for (const stepData of invoiceSteps) {
      const role = savedRoles.find(r => r.name === stepData.roleName);
      if (role) {
        const step = approvalStepRepository.create({
          approvalFlowId: savedFlow3.id,
          approverRoleId: role.id,
          stepOrder: stepData.order,
          stepName: stepData.name,
          isRequired: true,
        });
        await approvalStepRepository.save(step);
      }
    }

    // Supplier Onboard Flow
    const flow4 = approvalFlowRepository.create({
      name: 'Supplier Onboard Flow',
      flowType: 'supplier_onboard',
      description: 'Supplier Onboarding: Operation L1 → Operation Head',
      isActive: true,
      isSequential: true,
    });
    const savedFlow4 = await approvalFlowRepository.save(flow4);

    const supplierSteps = [
      { order: 1, roleName: ROLES.OPERATIONS_TEAM_L1, name: 'Operation L1 Onboarding' },
      { order: 2, roleName: ROLES.OPERATIONS_HEAD, name: 'Operation Head Approval' },
    ];

    for (const stepData of supplierSteps) {
      const role = savedRoles.find(r => r.name === stepData.roleName);
      if (role) {
        const step = approvalStepRepository.create({
          approvalFlowId: savedFlow4.id,
          approverRoleId: role.id,
          stepOrder: stepData.order,
          stepName: stepData.name,
          isRequired: true,
        });
        await approvalStepRepository.save(step);
      }
    }
    console.log('✅ Approval flows created');

    console.log('✅ Seed completed successfully!');
    console.log('\n📝 Default credentials:');
    console.log('   Email: admin@scf.com');
    console.log('   Password: password123');
    console.log('\n⚠️  Change default passwords in production!');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

seed();



