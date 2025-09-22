#!/bin/bash

# Simple manual test for file sharing after fix
set -e

BASE_URL="http://localhost:8080"

echo "=== Manual File Sharing Test ==="
echo ""
echo "This script will help you test file sharing manually."
echo ""
echo "Steps:"
echo "1. Go to http://localhost:3000"
echo "2. Register/login"
echo "3. Upload the test file: test_share_file.txt"
echo "4. Share the file with password: SharePass123!"
echo "5. Copy the share token and run this script with it"
echo ""

if [ "$1" = "" ]; then
  echo "Usage: $0 <share_token>"
  echo ""
  echo "Example: $0 abc123def456..."
  exit 1
fi

SHARE_TOKEN="$1"
SHARE_PASSWORD="SharePass123!"

echo "Testing with:"
echo "Share Token: $SHARE_TOKEN"
echo "Password: $SHARE_PASSWORD"
echo ""

# Test accessing the shared file
echo "1. Testing shared file access..."
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
echo ""

# Extract download URL
DOWNLOAD_URL=$(echo "$ACCESS_RESPONSE" | grep -o '"accessSharedFile":"[^"]*"' | cut -d'"' -f4 | sed 's/\\//g')
if [ -z "$DOWNLOAD_URL" ]; then
  echo "❌ Failed to get download URL"
  echo "Full response: $ACCESS_RESPONSE"
  exit 1
fi

echo "✅ Got download URL: $DOWNLOAD_URL"
echo ""

# Download the file
echo "2. Downloading shared file..."
DOWNLOADED_FILE="downloaded_$(date +%s).txt"
curl -s -v -o "$DOWNLOADED_FILE" "$DOWNLOAD_URL" 2>curl_debug.log

echo "✅ Download completed"
echo ""

# Check results
echo "3. Checking results..."
echo "Downloaded file: $DOWNLOADED_FILE"
echo "File size: $(wc -c < "$DOWNLOADED_FILE") bytes"
echo ""

echo "Content preview:"
head -c 200 "$DOWNLOADED_FILE"
echo ""
echo ""

# Check if it's readable text
if file "$DOWNLOADED_FILE" | grep -q "text"; then
  echo "✅ File appears to be readable text"
  
  if [ -f "test_share_file.txt" ]; then
    echo ""
    echo "4. Comparing with original..."
    echo "Original file size: $(wc -c < "test_share_file.txt") bytes"
    
    if cmp -s "test_share_file.txt" "$DOWNLOADED_FILE"; then
      echo "✅ SUCCESS: Files are identical!"
      echo "🎉 File sharing and decryption is working perfectly!"
    else
      echo "❌ FAILURE: Files are different"
      echo "Differences:"
      diff "test_share_file.txt" "$DOWNLOADED_FILE" || true
    fi
  else
    echo "Note: Original test file not found for comparison"
  fi
else
  echo "❌ File appears to be binary/corrupted"
  echo "File type: $(file "$DOWNLOADED_FILE")"
  echo "Hex dump (first 100 bytes):"
  xxd "$DOWNLOADED_FILE" | head -10
fi

# Cleanup
rm -f curl_debug.log

echo ""
echo "=== Test completed ==="