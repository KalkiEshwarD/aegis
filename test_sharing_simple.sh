#!/bin/bash

# Simplified test script for file sharing functionality
set -e

BASE_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"

echo "=== File Sharing Download Test ==="
echo "This script will test an existing shared file"

# Test accessing a shared file that already exists
echo "Testing shared file access..."

# For now, let's test with known parameters. We'll create a share manually first.
# Let me check if there are existing shares in the system first

echo "Checking GraphQL playground for manual testing..."
echo "Visit: $BASE_URL/ (GraphQL playground)"
echo "Visit: $FRONTEND_URL (Frontend)"

echo "Please:"
echo "1. Go to $FRONTEND_URL"
echo "2. Register/login with a user"
echo "3. Upload a test file"
echo "4. Share the file with a password"
echo "5. Copy the share token"
echo "6. Run this script again with the token as parameter"

if [ "$1" != "" ]; then
  SHARE_TOKEN="$1"
  SHARE_PASSWORD="$2"
  
  if [ "$SHARE_PASSWORD" = "" ]; then
    echo "Usage: $0 <share_token> <share_password>"
    exit 1
  fi
  
  echo "Testing with token: $SHARE_TOKEN"
  echo "Testing with password: $SHARE_PASSWORD"
  
  # Test accessing the shared file
  ACCESS_MUTATION='{
    "query": "mutation AccessSharedFile($input: AccessSharedFileInput!) { accessSharedFile(input: $input) }",
    "variables": {
      "input": {
        "token": "'$SHARE_TOKEN'",
        "masterPassword": "'$SHARE_PASSWORD'"
      }
    }
  }'
  
  ACCESS_RESPONSE=$(curl -s -X POST \
    "$BASE_URL/v1/graphql" \
    -H "Content-Type: application/json" \
    -d "$ACCESS_MUTATION")
  
  echo "Access response: $ACCESS_RESPONSE"
  
  # Extract download URL
  DOWNLOAD_URL=$(echo "$ACCESS_RESPONSE" | grep -o '"accessSharedFile":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$DOWNLOAD_URL" ]; then
    echo "Failed to get download URL"
    echo "Full response: $ACCESS_RESPONSE"
    exit 1
  fi
  
  echo "Got download URL: $DOWNLOAD_URL"
  
  # Download the file
  echo "Downloading shared file..."
  DOWNLOADED_FILE="downloaded_test_file.txt"
  curl -s -v -o "$DOWNLOADED_FILE" "$DOWNLOAD_URL" 2>curl_debug.log
  
  echo "Download response headers:"
  grep "< " curl_debug.log || true
  
  echo "File downloaded to: $DOWNLOADED_FILE"
  echo "Downloaded file size: $(wc -c < "$DOWNLOADED_FILE")"
  
  echo "Downloaded file content (first 500 bytes):"
  head -c 500 "$DOWNLOADED_FILE" | xxd
  echo ""
  
  echo "Downloaded file content (as text, first 200 chars):"
  head -c 200 "$DOWNLOADED_FILE"
  echo ""
  
  # Check if it looks like valid text or binary data
  if file "$DOWNLOADED_FILE" | grep -q "text"; then
    echo "✅ File appears to be text"
    echo "Content preview:"
    head -5 "$DOWNLOADED_FILE"
  else
    echo "❌ File appears to be binary/corrupted"
    echo "File type: $(file "$DOWNLOADED_FILE")"
  fi
fi

echo "=== Test completed ===