#!/bin/bash

# Test authentication and workflow access for all roles

BASE_URL="http://localhost:3002"

# Test users
declare -A users=(
  ["RM"]="rm@scf.com"
  ["Credit_L1"]="credit_l1@scf.com"
  ["Credit_L2"]="credit_l2@scf.com"
  ["Ops_L1"]="ops_l1@scf.com"
  ["Ops_L2"]="ops_l2@scf.com"
  ["Ops_Head"]="ops_head@scf.com"
  ["CEO"]="ceo@scf.com"
  ["MD"]="md@scf.com"
)

echo "======================================"
echo "  AUTHENTICATION & AUTHORIZATION TEST"
echo "======================================"
echo ""

for role in "${!users[@]}"; do
  email="${users[$role]}"
  echo "Testing: $role ($email)"
  
  # Login
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"password123\"}")
  
  # Extract token
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
    echo "  ❌ LOGIN FAILED"
    echo "  Response: $LOGIN_RESPONSE"
    echo ""
    continue
  fi
  
  echo "  ✅ Login successful"
  echo "  Token: ${TOKEN:0:50}..."
  
  # Test accessing a workflow endpoint
  TEST_ENDPOINT="$BASE_URL/api/workflows/customers/dashboard/rm"
  TEST_RESPONSE=$(curl -s -X GET "$TEST_ENDPOINT" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$TEST_RESPONSE" | grep -q "success"; then
    echo "  ✅ Workflow access OK"
  else
    ERROR_MSG=$(echo "$TEST_RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  ⚠️  Endpoint response: $ERROR_MSG"
  fi
  
  echo ""
done

echo "======================================"
echo "  TEST COMPLETE"
echo "======================================"
