/**
 * Data Transfer Objects (DTOs) for Customer App APIs
 * Validation schemas for incoming requests
 */

// =====================================================
// 🔹 AUTH DTOs
// =====================================================

/**
 * OTP Request DTO
 */
export interface OtpRequestDto {
  mobile: string;
}

/**
 * OTP Verify DTO
 */
export interface OtpVerifyDto {
  mobile: string;
  otp: string;
}

/**
 * Login with Password DTO
 */
export interface LoginDto {
  mobile: string;
  password: string;
}

/**
 * Set Password DTO
 */
export interface SetPasswordDto {
  mobile: string;
  password: string;
}

/**
 * Refresh Token DTO
 */
export interface RefreshTokenDto {
  refreshToken: string;
}

/**
 * Logout DTO
 */
export interface LogoutDto {
  refreshToken?: string;
}

// =====================================================
// 🔹 CUSTOMER DTOs
// =====================================================

/**
 * Get Customer Details DTO
 */
export interface GetCustomerDetailsParams {
  id: string;
}

// =====================================================
// 🔹 DRAWDOWN DTOs
// =====================================================

/**
 * Create Drawdown DTO
 */
export interface CreateDrawdownDto {
  loanId?: number;
  requestedAmount: number;
  purpose?: string;
  description?: string;
  invoiceNumber?: string;
  invoiceId?: number;
  beneficiaryName?: string;
  beneficiaryBankAccount?: string;
  beneficiaryIfsc?: string;
}

/**
 * Drawdown List Query DTO
 */
export interface DrawdownListQueryDto {
  page?: string;
  limit?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// =====================================================
// 🔹 LOAN DTOs
// =====================================================

/**
 * Loan List Query DTO
 */
export interface LoanListQueryDto {
  page?: string;
  limit?: string;
  status?: string;
}

/**
 * Get Loan Detail Params DTO
 */
export interface GetLoanDetailParams {
  id: string;
}

/**
 * Get Loan Schedule Params DTO
 */
export interface GetLoanScheduleParams {
  id: string;
}

/**
 * Get Loan Statement Query DTO
 */
export interface GetLoanStatementQueryDto {
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

/**
 * Get Foreclosure Preview Params DTO
 */
export interface GetForeclosurePreviewParams {
  id: string;
}

// =====================================================
// 🔹 TRANSACTION DTOs
// =====================================================

/**
 * Transaction List Query DTO
 */
export interface TransactionListQueryDto {
  page?: string;
  limit?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  loanId?: string;
}

/**
 * Get Transaction Receipt Params DTO
 */
export interface GetTransactionReceiptParams {
  id: string;
}

// =====================================================
// 🔹 NOTIFICATION DTOs
// =====================================================

/**
 * Notification List Query DTO
 */
export interface NotificationListQueryDto {
  page?: string;
  limit?: string;
  readStatus?: string;
  type?: string;
}

/**
 * Mark Notification Read Params DTO
 */
export interface MarkNotificationReadParams {
  id: string;
}

// =====================================================
// 🔹 PROFILE DTOs
// =====================================================

/**
 * Get Bank Details Response DTO
 */
export interface BankDetailsResponseDto {
  bankAccountNo: string;
  bankName: string;
  bankBranch: string;
  bankIfscCode: string;
  bankType: string;
}
