# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require JWT authentication. Include token in header:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### POST /auth/login
Login and get JWT token.

**Request:**
```json
{
  "email": "admin@scf.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@scf.com",
      "name": "Admin User",
      "role": "admin"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/logout
Logout (requires auth).

---

## User Management (Admin Only)

### POST /users
Create new user.

**Request:**
```json
{
  "name": "New User",
  "email": "user@example.com",
  "password": "password123",
  "mobile": "9876543210",
  "roleId": 2
}
```

### GET /users
Get all users.

### GET /users/:id
Get user by ID.

### PUT /users/:id
Update user.

### DELETE /users/:id
Delete user (soft delete).

### POST /users/assign-role
Assign role to user.

**Request:**
```json
{
  "userId": 5,
  "roleId": 2
}
```

---

## Customer Management

### POST /customers
Create new customer (RM only).

**Request:**
```json
{
  "name": "ABC Enterprises",
  "mobile": "9876543210",
  "pan": "ABCDE1234F",
  "aadhaar": "123456789012",
  "electricityBillNo": "EL123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 101,
    "name": "ABC Enterprises",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /customers
Get customers (with optional filters).

**Query Params:**
- `status`: Filter by status
- `rmId`: Filter by RM ID

### GET /customers/:id
Get customer by ID with full details.

### PUT /customers/:id
Update customer (RM only).

### POST /customers/:id/submit
Submit case to credit team (RM only).

---

## Credit Management

### POST /credit/sanction
Create credit sanction (Credit Team only).

**Request:**
```json
{
  "customerId": "customer-uuid",
  "sanctionAmount": 1000000,
  "tenure": 12,
  "interestRate": 12.5,
  "conditions": "Standard terms apply",
  "creditRemarks": "Customer verified"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 5001,
    "status": "pending",
    "message": "Credit sanction created and submitted for approval"
  }
}
```

### GET /credit/pending
Get pending sanctions (Credit Team only).

### GET /credit/sanction/:id
Get sanction details.

### PUT /credit/sanction/:id
Update sanction.

---

## Approval Management

### GET /approvals/pending
Get pending approvals for current user (Management roles).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 9001,
      "status": "pending",
      "currentStep": 1,
      "creditSanction": {
        "sanctionAmount": 1000000,
        "customer": {
          "name": "ABC Enterprises"
        }
      }
    }
  ]
}
```

### POST /approvals/:id/action
Process approval (approve/reject).

**Request:**
```json
{
  "action": "approved",
  "comments": "Approved based on credit analysis"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 9001,
    "status": "approved",
    "currentStep": 2
  },
  "message": "Approval approved successfully"
}
```

### GET /approvals/:id/history
Get approval history.

---

## Document Management

### POST /documents/upload
Upload document.

**Request:** (multipart/form-data)
- `file`: File to upload
- `customerId`: Customer ID (integer)
- `documentType`: Type of document (pan, aadhaar, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 7001,
    "fileName": "document.pdf",
    "filePath": "./uploads/file-1234567890.pdf",
    "documentType": "pan"
  }
}
```

### GET /documents/customer/:customerId
Get all documents for a customer.

### POST /documents/:id/verify
Verify document.

**Request:**
```json
{
  "remarks": "Document verified"
}
```

### DELETE /documents/:id
Delete document.

---

## Operations Management

### GET /operations/pending
Get pending operations checks (Operations Team only).

### GET /operations/:id
Get operations check details.

### PUT /operations/:id
Update operations check.

**Request:**
```json
{
  "documentsVerified": true,
  "esignVerified": true,
  "enachVerified": true,
  "opsRemarks": "All verifications completed"
}
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Error Response Format

```json
{
  "success": false,
  "message": "Error message here"
}
```

---

## Workflow Examples

### Complete Customer Onboarding Flow

1. **RM creates customer:**
   ```
   POST /customers
   ```

2. **RM uploads documents:**
   ```
   POST /documents/upload
   ```

3. **RM submits case:**
   ```
   POST /customers/:id/submit
   ```

4. **Credit team creates sanction:**
   ```
   POST /credit/sanction
   ```
   (This automatically creates approval instance)

5. **Management approves (sequential):**
   ```
   GET /approvals/pending
   POST /approvals/:id/action
   ```
   (Repeat for each approver: CFO → CEO → MD)

6. **RM completes post-sanction:**
   ```
   PUT /customers/:id
   ```
   (Update post-sanction status)

7. **Operations verifies:**
   ```
   PUT /operations/:id
   ```

8. **Customer fully onboarded!**


