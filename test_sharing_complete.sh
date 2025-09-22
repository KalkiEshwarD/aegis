#!/bin/bash

# Complete test script for file sharing functionality after fix
set -e

BASE_URL="http://localhost:8080"
TEST_USERNAME="testuser_$(date +%s)"
TEST_EMAIL="${TEST_USERNAME}@example.com"
TEST_PASSWORD="TestPassword123!"
SHARE_PASSWORD="SharePass123!"
TEST_FILE="test_share_file.txt"

echo "=== File Sharing End-to-End Test ==="
echo "Creating test user: $TEST_USERNAME"

# Wait for services to be ready
echo "Waiting for services to be ready..."
for i in {1..30}; do
  if curl -s "$BASE_URL/v1/graphql" >/dev/null 2>&1; then
    echo "Services are ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

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

echo "Registering user..."
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

echo "Got token: ${TOKEN:0:20}..."

# Upload file using multipart/form-data to GraphQL
echo "Uploading test file..."

# Use curl with multipart form data for GraphQL file upload
UPLOAD_MUTATION='{ 
  "query": "mutation UploadFile($input: UploadFileInput!) { uploadFile(input: $input) { id filename mime_type } }",
  "variables": { 
    "input": { 
      "filename": "'$(basename $TEST_FILE)'", 
      "folder_id": null,
      "file_data": null 
    } 
  }
}'

UPLOAD_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/v1/graphql" \
  -H "Authorization: Bearer $TOKEN" \
  -F 'operations='"$UPLOAD_MUTATION" \
  -F 'map={"0": ["variables.input.file_data"]}' \
  -F '0=@'"$TEST_FILE")

echo "Upload response: $UPLOAD_RESPONSE"

# Extract file ID
FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$FILE_ID" ]; then
  echo "Failed to get file ID from upload"
  echo "Upload response: $UPLOAD_RESPONSE"
  exit 1
fi

echo "Got file ID: $FILE_ID"

# Create file share
echo "Creating file share..."
SHARE_MUTATION='{
  "query": "mutation CreateFileShare($input: CreateFileShareInput!) { createFileShare(input: $input) { id shareToken } }",
  "variables": {
    "input": {
      "userFileID": "'$FILE_ID'",
      "masterPassword": "'$SHARE_PASSWORD'",
      "maxDownloads": 5
    }
  }
}'

SHARE_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/v1/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$SHARE_MUTATION")

echo "Share response: $SHARE_RESPONSE"

# Extract share token
SHARE_TOKEN=$(echo "$SHARE_RESPONSE" | grep -o '"shareToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SHARE_TOKEN" ]; then
  echo "Failed to get share token"
  echo "Share response: $SHARE_RESPONSE"
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
  "$BASE_URL/v1/graphql" \
  -H "Content-Type: application/json" \
  -d "$ACCESS_MUTATION")

echo "Access response: $ACCESS_RESPONSE"

# Extract download URL
DOWNLOAD_URL=$(echo "$ACCESS_RESPONSE" | grep -o '"accessSharedFile":"[^"]*"' | cut -d'"' -f4)
if [ -z "$DOWNLOAD_URL" ]; then
  echo "Failed to get download URL"
  echo "Access response: $ACCESS_RESPONSE"
  exit 1
fi

echo "Got download URL: $DOWNLOAD_URL"

# Download the file
echo "Downloading shared file..."
DOWNLOADED_FILE="downloaded_test_file.txt"
curl -s -v -o "$DOWNLOADED_FILE" "$DOWNLOAD_URL" 2>curl_debug.log

echo "Download completed"
echo "Response headers:"
grep "< " curl_debug.log || true

echo "Original file size: $(wc -c < "$TEST_FILE")"
echo "Downloaded file size: $(wc -c < "$DOWNLOADED_FILE")"

echo "=== Content Comparison ==="
echo "Original file content:"
cat "$TEST_FILE"
echo -e "\n"

echo "Downloaded file content:"
cat "$DOWNLOADED_FILE"
echo -e "\n"

# Compare files
if cmp -s "$TEST_FILE" "$DOWNLOADED_FILE"; then
  echo "✅ SUCCESS: Files are identical!"
  echo "🎉 File sharing and decryption is working correctly!"
else
  echo "❌ FAILURE: Files are different!"
  echo "Differences:"
  diff "$TEST_FILE" "$DOWNLOADED_FILE" || true
  echo ""
  echo "Downloaded file hex dump (first 100 bytes):"
  xxd "$DOWNLOADED_FILE" | head -10
fi

# Cleanup
rm -f curl_debug.log

echo "=== Test completed ==="