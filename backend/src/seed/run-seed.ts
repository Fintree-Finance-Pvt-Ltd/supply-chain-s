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

    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const permissionRepository = AppDataSource.getRepository(Permission);
    const userRoleRepository = AppDataSource.getRepository(UserRole);
    const rolePermissionRepository = AppDataSource.getRepository(RolePermission);
    const approvalFlowRepository = AppDataSource.getRepository(ApprovalFlow);
    const approvalStepRepository = AppDataSource.getRepository(ApprovalStep);

    // Create Roles
    console.log('Creating roles...');
    const roles = [
      { name: ROLES.ADMIN, label: 'Admin', description: 'System Administrator' },
      { name: ROLES.RELATIONSHIP_MANAGER, label: 'Relationship Manager', description: 'Manages customer relationships' },
      { name: ROLES.CREDIT_TEAM, label: 'Credit Team', description: 'Credit review and sanction' },
      { name: ROLES.OPERATIONS_TEAM, label: 'Operations Team', description: 'Operations verification' },
      { name: ROLES.CFO, label: 'CFO', description: 'Chief Financial Officer' },
      { name: ROLES.CEO, label: 'CEO', description: 'Chief Executive Officer' },
      { name: ROLES.MD, label: 'Managing Director', description: 'Managing Director' },
    ];

    const savedRoles: Role[] = [];
    for (const roleData of roles) {
      let role = await roleRepository.findOne({ where: { name: roleData.name } });
      if (!role) {
        role = roleRepository.create(roleData);
        role = await roleRepository.save(role);
      }
      savedRoles.push(role);
    }
    console.log('✅ Roles created');

    // Create default password hash
    const defaultPassword = await hashPassword('password123');

    // Create Users
    console.log('Creating users...');
    const users = [
      { email: 'admin@scf.com', name: 'Admin User', role: ROLES.ADMIN },
      { email: 'rm@scf.com', name: 'John Doe - RM', role: ROLES.RELATIONSHIP_MANAGER },
      { email: 'credit@scf.com', name: 'Credit Officer', role: ROLES.CREDIT_TEAM },
      { email: 'ops@scf.com', name: 'Operations Manager', role: ROLES.OPERATIONS_TEAM },
      { email: 'ceo@scf.com', name: 'CEO', role: ROLES.CEO },
      { email: 'cfo@scf.com', name: 'CFO', role: ROLES.CFO },
      { email: 'md@scf.com', name: 'Managing Director', role: ROLES.MD },
    ];

    const savedUsers: User[] = [];
    for (const userData of users) {
      let user = await userRepository.findOne({ where: { email: userData.email } });
      if (!user) {
        user = userRepository.create({
          email: userData.email,
          name: userData.name,
          password: defaultPassword,
          defaultRole: userData.role,
        });
        user = await userRepository.save(user);
      }
      savedUsers.push(user);

      // Assign role
      const role = savedRoles.find(r => r.name === userData.role);
      if (role) {
        let userRole = await userRoleRepository.findOne({
          where: { userId: user.id, roleId: role.id },
        });
        if (!userRole) {
          userRole = userRoleRepository.create({
            userId: user.id,
            roleId: role.id,
            assignedBy: savedUsers[0].id, // Admin assigns
          });
          await userRoleRepository.save(userRole);
        }
      }
    }
    console.log('✅ Users created');

    // Create Approval Flows
    console.log('Creating approval flows...');
    const creditFlow = await approvalFlowRepository.findOne({
      where: { flowType: 'credit_sanction' },
    });
    if (!creditFlow) {
      const flow = approvalFlowRepository.create({
        name: 'Credit Sanction Approval',
        flowType: 'credit_sanction',
        description: 'Multi-level approval: Credit Team → CFO → CEO → MD',
        isActive: true,
        isSequential: true,
      });
      const savedFlow = await approvalFlowRepository.save(flow);

      // Create steps
      const steps = [
        { order: 1, roleName: ROLES.CREDIT_TEAM, name: 'Credit Team Review' },
        { order: 2, roleName: ROLES.CFO, name: 'CFO Approval' },
        { order: 3, roleName: ROLES.CEO, name: 'CEO Approval' },
        { order: 4, roleName: ROLES.MD, name: 'MD Final Approval' },
      ];

      for (const stepData of steps) {
        const role = savedRoles.find(r => r.name === stepData.roleName);
        if (role) {
          const step = approvalStepRepository.create({
            approvalFlowId: savedFlow.id,
            approverRoleId: role.id,
            stepOrder: stepData.order,
            stepName: stepData.name,
            isRequired: true,
          });
          await approvalStepRepository.save(step);
        }
      }
    }

    const opsFlow = await approvalFlowRepository.findOne({
      where: { flowType: 'operations' },
    });
    if (!opsFlow) {
      const flow = approvalFlowRepository.create({
        name: 'Operations Approval',
        flowType: 'operations',
        description: 'Multi-level approval: Ops Checker → Ops Manager → Final Approver',
        isActive: true,
        isSequential: true,
      });
      const savedFlow = await approvalFlowRepository.save(flow);

      const steps = [
        { order: 1, roleName: ROLES.OPERATIONS_TEAM, name: 'Operations Checker' },
        { order: 2, roleName: ROLES.OPERATIONS_TEAM, name: 'Operations Manager' },
        { order: 3, roleName: ROLES.CEO, name: 'Final Approver (CEO)' },
      ];

      for (const stepData of steps) {
        const role = savedRoles.find(r => r.name === stepData.roleName);
        if (role) {
          const step = approvalStepRepository.create({
            approvalFlowId: savedFlow.id,
            approverRoleId: role.id,
            stepOrder: stepData.order,
            stepName: stepData.name,
            isRequired: true,
          });
          await approvalStepRepository.save(step);
        }
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

