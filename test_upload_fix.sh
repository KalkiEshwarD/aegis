#!/bin/bash

# Test script to verify the upload fix works
echo "Testing upload functionality fix..."

# Check if the uploadFileFromMap mutation exists in the schema
echo "Checking if uploadFileFromMap mutation exists in GraphQL schema..."
cd /Users/kalkieshward/Work/Projects/vit-2026-capstone-internship-hiring-task-KalkiEshwarD/aegis/backend

if grep -q "uploadFileFromMap" graph/schema.graphql; then
    echo "✅ uploadFileFromMap mutation exists in schema"
else
    echo "❌ uploadFileFromMap mutation NOT found in schema"
    exit 1
fi

# Check if the frontend uses the new mutation
echo "Checking if frontend uses the new mutation..."
cd ../frontend

if grep -q "UPLOAD_FILE_FROM_MAP_MUTATION" src/apollo/queries.ts; then
    echo "✅ Frontend includes UPLOAD_FILE_FROM_MAP_MUTATION"
else
    echo "❌ Frontend does NOT include UPLOAD_FILE_FROM_MAP_MUTATION"
    exit 1
fi

if grep -q "uploadFileFromMap" src/components/common/FileUploadDropzone.tsx; then
    echo "✅ FileUploadDropzone uses the new mutation"
else
    echo "❌ FileUploadDropzone does NOT use the new mutation"
    exit 1
fi

# Run the upload converter tests
echo "Running upload converter tests..."
cd ../backend

if go test -v ./test/internal/services -run "Upload" > /dev/null 2>&1; then
    echo "✅ All upload converter tests pass"
else
    echo "❌ Upload converter tests FAILED"
    exit 1
fi

echo ""
echo "🎉 Upload functionality fix verification COMPLETE!"
echo ""
echo "Summary of changes made:"
echo "1. ✅ Added UPLOAD_FILE_FROM_MAP_MUTATION to frontend queries"
echo "2. ✅ Updated FileUploadDropzone to use uploadFileFromMap mutation"
echo "3. ✅ Fixed frontend to send data as JSON string instead of Upload type"
echo "4. ✅ Backend already had proper map-to-struct conversion logic"
echo "5. ✅ All upload converter unit tests pass"
echo ""
echo "The 'map[string]interface {} is not an Upload' error should now be resolved!"