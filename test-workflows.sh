#!/bin/bash

BASE_URL="http://localhost:3002"

echo "=================================="
echo "  ROLE-BASED WORKFLOW TEST"
echo "=================================="
echo ""

# Helper function to login and get token
get_token() {
  local email=$1
  local response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"password123\"}")
  
  echo "$response" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4
}

# Helper function to test endpoint with role
test_endpoint_with_role() {
  local email=$1
  local role_name=$2
  local method=$3
  local endpoint=$4
  local data=$5
  
  local token=$(get_token "$email")
  
  if [ -z "$token" ]; then
    echo "❌ $role_name: Failed to get token"
    return 1
  fi
  
  if [ "$method" = "GET" ]; then
    local response=$(curl -s -X GET "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token")
  else
    local response=$(curl -s -X POST "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  if echo "$response" | grep -q '"success":true'; then
    echo "✅ $role_name"
    return 0
  elif echo "$response" | grep -q '"success":false'; then
    local msg=$(echo "$response" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "⚠️  $role_name: $msg"
    return 1
  else
    echo "❌ $role_name: Unexpected response"
    return 1
  fi
}

echo "=== TEST 1: Customer Dashboard Access ==="
echo "RM can access RM dashboard:"
test_endpoint_with_role "rm@scf.com" "RM" "GET" "/api/workflows/customers/dashboard/rm" ""

echo ""
echo "Credit Team can access credit dashboard:"
test_endpoint_with_role "credit_l1@scf.com" "Credit L1" "GET" "/api/workflows/customers/dashboard/credit/1" ""

echo ""
echo "Operations can access ops dashboard:"
test_endpoint_with_role "ops_l1@scf.com" "Ops L1" "GET" "/api/workflows/customers/dashboard/operations" ""

echo ""
echo "=== TEST 2: Create Customer (RM Only) ==="
RANDOM_NUMBER=$((RANDOM % 10000))
token=$(get_token "rm@scf.com")
create_response=$(curl -s -X POST "$BASE_URL/api/workflows/customers/create" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerName\": \"Test Corp Ltd\",
    \"customerCode\": \"TCL$RANDOM_NUMBER\",
    \"industryType\": \"Manufacturing\",
    \"annualTurnover\": 75000000,
    \"email\": \"contact@testcorp.com\",
    \"contactNumber\": \"9876543210\"
  }")

if echo "$create_response" | grep -q '"success":true'; then
  echo "✅ RM can create customer"
  CUSTOMER_ID=$(echo "$create_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  echo "   Customer ID: $CUSTOMER_ID"
else
  echo "❌ RM failed to create customer"
fi

echo ""
echo "=== TEST 3: Submit Customer (RM Only) ==="
if [ ! -z "$CUSTOMER_ID" ]; then
  token=$(get_token "rm@scf.com")
  submit_response=$(curl -s -X POST "$BASE_URL/api/workflows/customers/$CUSTOMER_ID/submit" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d '{"remarks": "Ready for credit review"}')
  
  if echo "$submit_response" | grep -q '"success":true'; then
    echo "✅ RM can submit customer"
  else
    echo "❌ RM failed to submit customer"
  fi
fi

echo ""
echo "=== TEST 4: Credit L1 Approval ==="
if [ ! -z "$CUSTOMER_ID" ]; then
  token=$(get_token "credit_l1@scf.com")
  approve_response=$(curl -s -X POST "$BASE_URL/api/workflows/customers/$CUSTOMER_ID/credit-l1" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d '{"approved": true, "remarks": "Approved for L2"}')
  
  if echo "$approve_response" | grep -q '"success":true'; then
    echo "✅ Credit L1 can approve"
  elif echo "$approve_response" | grep -q 'Access denied'; then
    echo "❌ Credit L1 denied access (RBAC issue)"
  else
    echo "⚠️  Credit L1 response: $(echo "$approve_response" | head -c 100)"
  fi
fi

echo ""
echo "=== TEST 5: Role Separation Test ==="
echo "Test: RM tries to approve at Credit L1 step (should fail)"
if [ ! -z "$CUSTOMER_ID" ]; then
  token=$(get_token "rm@scf.com")
  deny_response=$(curl -s -X POST "$BASE_URL/api/workflows/customers/$CUSTOMER_ID/credit-l1" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d '{"approved": true}')
  
  if echo "$deny_response" | grep -q "Access denied\|must have one of these roles"; then
    echo "✅ Correctly denied RM access to Credit L1 approval"
  else
    echo "⚠️  Unexpected: Should have denied RM access"
  fi
fi

echo ""
echo "=== ALL TESTS COMPLETE ==="
