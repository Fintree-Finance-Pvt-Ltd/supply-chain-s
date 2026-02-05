# Database Seeding Guide

## Problem
The `npm run seed` command was not updating the database because the TypeScript seed script (`run-seed.ts`) was still using the old role definitions that didn't match the updated role names in the constants.

## Solution Applied

### Updated Files:
1. **backend/src/seed/run-seed.ts** - Updated to use new role constants
2. **backend/src/config/constants.ts** - New roles and flow types already added

### Changes Made to Seed Script:

#### 1. Updated Role Definitions
Changed from:
- `credit_team` → `credit_team_l1`, `credit_team_l2`
- `operations_team` → `operations_team_l1`, `operations_team_l2`, `operations_head`

#### 2. Updated Default Users
Added new users for each new role:
- credit_l1@scf.com - Credit Team L1
- credit_l2@scf.com - Credit Team L2
- ops_l1@scf.com - Operations Team L1
- ops_l2@scf.com - Operations Team L2
- ops_head@scf.com - Operations Head

#### 3. Updated Approval Flows
Replaced old flows with new comprehensive approval flows:
- **Credit Sanction Customer Approval** - Credit L1 → L2 → CEO → MD
- **Operations Approval for Customer** - Ops L1 → Ops Head
- **Invoice Discounting Flow** - Ops L1 → L2 → Ops Head → CEO → MD
- **Supplier Onboard Flow** - Ops L1 → Ops Head

## How to Run

### Option 1: Run TypeScript Seed (Recommended)
```bash
cd backend
npm run seed
```

### Option 2: Direct SQL Execution
If you prefer to execute SQL directly:

1. Create tables:
```bash
mysql -h 217.21.80.3 -u u341672715_supply_chain -p < sql/01_create_tables.sql
```

2. Seed data:
```bash
mysql -h 217.21.80.3 -u u341672715_supply_chain -p < sql/02_seed_data.sql
```

## Default Test Users

After running the seed, use these credentials to login:

| Email | Password | Role |
|-------|----------|------|
| admin@scf.com | password123 | Admin |
| rm@scf.com | password123 | Relationship Manager |
| credit_l1@scf.com | password123 | Credit Team L1 |
| credit_l2@scf.com | password123 | Credit Team L2 |
| ops_l1@scf.com | password123 | Operations Team L1 |
| ops_l2@scf.com | password123 | Operations Team L2 |
| ops_head@scf.com | password123 | Operations Head |
| ceo@scf.com | password123 | CEO |
| cfo@scf.com | password123 | CFO |
| md@scf.com | password123 | Managing Director |

## Next Steps

1. ✅ Run `npm run seed` in the backend folder
2. ✅ Start the backend: `npm run dev`
3. ✅ Start the frontend: `npm run dev` (in frontend folder)
4. ✅ Login with any of the test accounts above
5. ⚠️ Change default passwords in production!

## Troubleshooting

### If seed still fails:

1. **Check database connection:**
   ```bash
   mysql -h 217.21.80.3 -u u341672715_supply_chain -p -e "SELECT 1"
   ```

2. **Check if tables exist:**
   ```bash
   mysql -h 217.21.80.3 -u u341672715_supply_chain -p -e "USE u341672715_supply_chain_s; SHOW TABLES;"
   ```

3. **Clear and reseed:**
   ```bash
   # Drop and recreate tables
   mysql -h 217.21.80.3 -u u341672715_supply_chain -p < sql/01_create_tables.sql
   
   # Then run seed
   npm run seed
   ```

## Database Configuration

Your database is configured in `.env`:
- **Host:** 217.21.80.3
- **Port:** 3306
- **Database:** u341672715_supply_chain_s
- **Username:** u341672715_supply_chain

This configuration is used by both the application (via `AppDataSource`) and the seed script.
