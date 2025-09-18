#!/bin/bash

# Get login token
TOKEN=$(curl -s -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation Login($input: LoginInput!) { login(input: $input) { token } }",
    "variables": {
      "input": {
        "email": "test@example.com",
        "password": "password123"
      }
    }
  }' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:50}..."

# Create simple test data
CONTENT="Hello World"
SIZE=${#CONTENT}
BASE64_DATA=$(echo -n "$CONTENT" | base64)
HASH=$(echo -n "$CONTENT" | sha256sum | cut -d' ' -f1)

echo "Content: $CONTENT"
echo "Size: $SIZE"
echo "Hash: $HASH"

# Create upload JSON 
UPLOAD_JSON=$(cat <<EOF
{
  "filename": "hello.txt",
  "mime_type": "text/plain", 
  "size_bytes": $SIZE,
  "content_hash": "$HASH",
  "encrypted_key": "key123",
  "file_data": "$BASE64_DATA"
}
EOF
)

echo "Testing upload..."

# Test upload
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"mutation { uploadFileFromMap(input: { data: \\\"$(echo "$UPLOAD_JSON" | sed 's/"/\\"/g' | tr -d '\n' | tr -d ' ')\\\" }) { id filename } }\",
    \"variables\": {}
  }"

echo ""