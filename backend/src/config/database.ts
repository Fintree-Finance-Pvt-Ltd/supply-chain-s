import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Import all entities explicitly to ensure TypeORM can find metadata
// This fixes the "No metadata for User was found" error
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';
import { UserRole } from '../entities/UserRole';
import { RolePermission } from '../entities/RolePermission';
import { Customer } from '../entities/Customer';
import { CoApplicant } from '../entities/CoApplicant';
import { Document } from '../entities/Document';
import { KycDetail } from '../entities/KycDetail';
import { CreditSanction } from '../entities/CreditSanction';
import { PostSanction } from '../entities/PostSanction';
import { OperationsCheck } from '../entities/OperationsCheck';
import { CaseStatusHistory } from '../entities/CaseStatusHistory';
import { ApprovalFlow } from '../entities/ApprovalFlow';
import { ApprovalStep } from '../entities/ApprovalStep';
import { ApprovalInstance } from '../entities/ApprovalInstance';
import { ApprovalAction } from '../entities/ApprovalAction';
import { Supplier } from '../entities/Supplier';
import { Invoice } from '../entities/Invoice';
import { CaseWorkflow } from '../entities/CaseWorkflow';
import { SanctionLimitHistory } from '../entities/SanctionLimitHistory';
import { ContactPerson } from '../entities/ContactPerson';
import { CustomerAddress } from '../entities/CustomerAddress';
import { OtpSession } from '../entities/OtpSession';
import { KycVerificationStatus } from '../entities/KycVerificationStatus';
import { SupplierBankDetail } from '../entities/SupplierBankDetail';
import { SupplierDocument } from '../entities/SupplierDocument';
import { Loan, LoanSchedule, LoanTransaction } from '../entities/Loan';
import { Drawdown } from '../entities/Drawdown';
import { Notification } from '../entities/Notification';
import { RefreshToken } from '../entities/RefreshToken';
import { Applicant } from '../entities/Applicant';

// Export entities array for use in DataSource
const entities = [
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  Customer,
  CoApplicant,
  Document,
  KycDetail,
  CreditSanction,
  PostSanction,
  OperationsCheck,
  CaseStatusHistory,
  ApprovalFlow,
  ApprovalStep,
  ApprovalInstance,
  ApprovalAction,
  Supplier,
  Invoice,
  CaseWorkflow,
  SanctionLimitHistory,
  ContactPerson,
  CustomerAddress,
  OtpSession,
  KycVerificationStatus,
  SupplierBankDetail,
  SupplierDocument,
  Loan,
  LoanSchedule,
  LoanTransaction,
  Drawdown,
  Notification,
  RefreshToken,
  Applicant,
];

// Always use .js files since we're running compiled code
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'supplychainnew',
  synchronize: false, // Set to false to use migrations exclusively
  logging: false,

  // Use explicitly imported entities instead of glob pattern
  // This ensures TypeORM can find all entity metadata
  entities: entities,

  migrations: [
    path.join(__dirname, '../migrations/**/*.js')
  ],

  subscribers: [
    path.join(__dirname, '../subscribers/**/*.js')
  ],
});

// Export entities for external use
export { entities };
