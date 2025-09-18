const { default: fetch } = require('node-fetch');
const crypto = require('crypto');

// First login to get the token
async function login() {
  const response = await fetch('http://localhost:8080/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            token
            user {
              id
              email
            }
          }
        }
      `,
      variables: {
        email: 'kalki.eshwar@gmail.com',
        password: 'password123'
      }
    })
  });
  
  const data = await response.json();
  return data.data.login.token;
}

// Test file upload
async function testUpload() {
  try {
    console.log('Getting auth token...');
    const token = await login();
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Create test file data
    const testContent = 'Hello, this is a test file content!';
    const fileData = Buffer.from(testContent).toString('base64');
    const contentHash = crypto.createHash('sha256').update(testContent).digest('hex');
    
    console.log('Content hash:', contentHash);
    console.log('File size:', testContent.length);
    
    const uploadData = {
      filename: 'test-file.txt',
      mime_type: 'text/plain',
      size_bytes: testContent.length,
      content_hash: contentHash,
      encrypted_key: 'test-encryption-key-123',
      file_data: fileData
    };
    
    console.log('Uploading file...');
    const response = await fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: `
          mutation UploadFileFromMap($input: UploadFileFromMapInput!) {
            uploadFileFromMap(input: $input) {
              id
              filename
              mime_type
              file {
                size_bytes
                content_hash
              }
            }
          }
        `,
        variables: {
          input: {
            data: JSON.stringify(uploadData)
          }
        }
      })
    });
    
    const result = await response.json();
    console.log('Upload result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUpload();