import json
import base64
import hashlib

# Read file
with open('test_file.txt', 'rb') as f:
    content = f.read()

# Calculate hash
file_hash = hashlib.sha256(content).hexdigest()
file_size = len(content)
file_content_b64 = base64.b64encode(content).decode()

# Create request data
data = {
    'filename': 'test_file.txt',
    'content_hash': file_hash,
    'size_bytes': file_size,
    'mime_type': 'text/plain',
    'encrypted_key': 'dGVzdGtleQ==',
    'file_data': file_content_b64
}

request = {
    'query': 'mutation UploadFileFromMap($input: UploadFileFromMapInput!) { uploadFileFromMap(input: $input) { id filename mime_type file { size_bytes } } }',
    'variables': {
        'input': {
            'data': json.dumps(data)
        }
    }
}

with open('upload_request.json', 'w') as f:
    json.dump(request, f)

print('Request created successfully')
