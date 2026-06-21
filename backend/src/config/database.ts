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
import { CreditNotepad } from '../entities/CreditNotepad';
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
import { LoanAccount } from '../entities/LoanAccount';
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
import { Partner } from '../entities/Partner';
import { LanSequence } from '../entities/LanSequence';
import { RepaymentUpload } from '../entities/RepaymentUpload';
import {
  LoanAccountSnapshot,
  LoanDemand,
  LoanDisbursement,
  LoanLedgerEntry,
  LoanProduct,
  Repayment,
  RepaymentAllocation,
  ReportRun,
} from '../entities/InternalLms';
import { PerformanceMetricsCache, RewardConfiguration, RewardPoint, TaskBucketMapping, TaskTimeTracking } from '../entities';

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
  CreditNotepad,
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
  LoanAccount,
  ContactPerson,
  CustomerAddress,
  OtpSession,
  KycVerificationStatus,
  SupplierBankDetail,
  SupplierDocument,
  Loan,
  Partner,
  LanSequence,
  LoanSchedule,
  LoanTransaction,
  Drawdown,
  Notification,
  RefreshToken,
  Applicant,
  RepaymentUpload,
  LoanProduct,
  LoanDisbursement,
  LoanDemand,
  Repayment,
  RepaymentAllocation,
  LoanLedgerEntry,
  LoanAccountSnapshot,
  ReportRun,
  RewardPoint,
  RewardConfiguration,
  PerformanceMetricsCache,
  TaskBucketMapping,
  TaskTimeTracking
];

// Always use .js files since we're running compiled code
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'supplychainnew',
  synchronize: false, // Disable in production, use migrations instead

  // Use explicitly imported entities instead of glob pattern
  // This ensures TypeORM can find all entity metadata
  entities: entities,

  migrations: [
    path.join(__dirname, '../migrations/**/*.{js,ts}')
  ],

  subscribers: [
    path.join(__dirname, '../subscribers/**/*.js')
  ],
});

// Export entities for external use
export { entities };
