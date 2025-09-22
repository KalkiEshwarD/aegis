#!/bin/bash

# Test script for file sharing functionality
set -e

BASE_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"
TEST_USERNAME="testuser_$(date +%s)"
TEST_EMAIL="${TEST_USERNAME}@example.com"
TEST_PASSWORD="TestPassword123!"
SHARE_PASSWORD="SharePass123!"
TEST_FILE="test_share_file.txt"

echo "=== File Sharing Test ==="
echo "Creating test user: $TEST_USERNAME"

# Register user using GraphQL
REGISTER_MUTATION='{
  "query": "mutation Register($input: RegisterInput!) { register(input: $input) { token user { id username email } } }",
  "variables": {
    "input": {
      "username": "'$TEST_USERNAME'",
      "email": "'$TEST_EMAIL'",
      "password": "'$TEST_PASSWORD'"
    }
  }
}'

REGISTER_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/v1/graphql" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_MUTATION")

echo "Register response: $REGISTER_RESPONSE"

# Extract token
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "Failed to get token from registration"
  echo "Register response: $REGISTER_RESPONSE"
  exit 1
fi

echo "Got token: $TOKEN"

# Upload test file
echo "Uploading test file..."
UPLOAD_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/v1/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE")

echo "Upload response: $UPLOAD_RESPONSE"

# Extract file ID
FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$FILE_ID" ]; then
  echo "Failed to get file ID from upload"
  exit 1
fi

echo "Got file ID: $FILE_ID"

# Create GraphQL mutation to share the file
echo "Creating file share..."
SHARE_MUTATION='{
  "query": "mutation CreateFileShare($input: CreateFileShareInput!) { createFileShare(input: $input) { id shareToken encryptedKey envelopeKey } }",
  "variables": {
    "input": {
      "userFileID": "'$FILE_ID'",
      "masterPassword": "'$SHARE_PASSWORD'",
      "maxDownloads": 5
    }
  }
}'

SHARE_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SHARE_MUTATION")

echo "Share response: $SHARE_RESPONSE"

# Extract share token
SHARE_TOKEN=$(echo "$SHARE_RESPONSE" | grep -o '"shareToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SHARE_TOKEN" ]; then
  echo "Failed to get share token"
  exit 1
fi

echo "Got share token: $SHARE_TOKEN"

# Test accessing the shared file
echo "Testing shared file access..."
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
  "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d "$ACCESS_MUTATION")

echo "Access response: $ACCESS_RESPONSE"

# Extract download URL
DOWNLOAD_URL=$(echo "$ACCESS_RESPONSE" | grep -o '"accessSharedFile":"[^"]*"' | cut -d'"' -f4)
if [ -z "$DOWNLOAD_URL" ]; then
  echo "Failed to get download URL"
  exit 1
fi

echo "Got download URL: $DOWNLOAD_URL"

# Download the file
echo "Downloading shared file..."
DOWNLOADED_FILE="downloaded_test_file.txt"
curl -s -o "$DOWNLOADED_FILE" "$DOWNLOAD_URL"

echo "File downloaded to: $DOWNLOADED_FILE"

# Compare original and downloaded files
echo "=== Comparing files ==="
echo "Original file size: $(wc -c < "$TEST_FILE")"
echo "Downloaded file size: $(wc -c < "$DOWNLOADED_FILE")"

echo "Original file content:"
cat "$TEST_FILE"
echo -e "\n"

echo "Downloaded file content:"
cat "$DOWNLOADED_FILE" 
echo -e "\n"

if cmp -s "$TEST_FILE" "$DOWNLOADED_FILE"; then
  echo "✅ SUCCESS: Files are identical!"
else
  echo "❌ FAILURE: Files are different!"
  echo "Differences:"
  diff "$TEST_FILE" "$DOWNLOADED_FILE" || true
fi

echo "=== Test completed ==="