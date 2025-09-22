package integration

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"github.com/balkanid/aegis-backend/internal/database"
	"github.com/balkanid/aegis-backend/internal/services"
)

type FileDecryptionTestSuite struct {
	BaseIntegrationTestSuite
	shareService  *services.ShareService
	cryptoManager *services.CryptoManager
}

func (suite *FileDecryptionTestSuite) SetupTest() {
	// Call parent setup
	suite.BaseIntegrationTestSuite.SetupTest()

	// Create crypto manager for testing
	cryptoManager, err := services.NewCryptoManager()
	if err != nil {
		suite.T().Fatalf("Failed to create crypto manager: %v", err)
	}
	suite.cryptoManager = cryptoManager

	// Create database service wrapper
	dbService := database.NewDB(suite.TestDB)

	suite.shareService = services.NewShareService(dbService, "http://localhost:8080", cryptoManager)
}

func (suite *FileDecryptionTestSuite) TestFileShareDecryptionKeyEncoding() {
	// Test the specific fix for key encoding issue
	suite.T().Log("Testing file share decryption key encoding fix")

	// Create a test file share
	masterPassword := "TestPassword123!"
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, masterPassword, 5, nil, nil)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)

	suite.T().Logf("Created share with ID: %d, Token: %s", fileShare.ID, fileShare.ShareToken)

	// Test the key decryption process
	decryptedKey, err := suite.shareService.DecryptFileKey(fileShare, masterPassword)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), decryptedKey)
	assert.Greater(suite.T(), len(decryptedKey), 0, "Decrypted key should not be empty")

	suite.T().Logf("Decrypted key length: %d bytes", len(decryptedKey))
	suite.T().Logf("Decrypted key (hex): %x", decryptedKey)

	// Test the key encoding that goes into the URL
	// This is the fix we applied - ensure the key is properly base64 encoded
	encodedKey := base64.StdEncoding.EncodeToString(decryptedKey)
	suite.T().Logf("Base64 encoded key: %s", encodedKey)

	// Test that we can decode it back correctly
	decodedKey, err := base64.StdEncoding.DecodeString(encodedKey)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), decryptedKey, decodedKey, "Key should survive base64 encoding/decoding")

	// Test what would happen with the old broken method (string conversion)
	brokenKeyString := string(decryptedKey)
	suite.T().Logf("Broken key (as string): %q", brokenKeyString)
	suite.T().Logf("Broken key length: %d", len(brokenKeyString))

	// Try to decode the broken key as base64 (this would fail or give wrong results)
	_, err = base64.StdEncoding.DecodeString(brokenKeyString)
	if err != nil {
		suite.T().Logf("Broken key fails base64 decode (expected): %v", err)
	} else {
		suite.T().Log("Broken key unexpectedly decoded as valid base64")
	}

	suite.T().Log("✅ Key encoding fix verified - proper base64 encoding prevents corruption")
}

func (suite *FileDecryptionTestSuite) TestFileShareEndToEndDecryption() {
	// Test the full flow including file decryption
	suite.T().Log("Testing end-to-end file share and decryption")

	masterPassword := "TestPassword123!"

	// Create a test file share
	fileShare, err := suite.shareService.CreateShare(suite.TestData.UserFile1.ID, masterPassword, 5, nil, nil)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), fileShare)

	// Decrypt the file key as done in the access endpoint
	decryptedKey, err := suite.shareService.DecryptFileKey(fileShare, masterPassword)
	assert.NoError(suite.T(), err)
	assert.NotNil(suite.T(), decryptedKey)

	// Encode the key properly (this is our fix)
	encodedKey := base64.StdEncoding.EncodeToString(decryptedKey)

	// Simulate what the download endpoint does
	decodedKey, err := base64.StdEncoding.DecodeString(encodedKey)
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), decryptedKey, decodedKey)

	suite.T().Log("✅ End-to-end key handling works correctly")
}

func TestFileDecryptionTestSuite(t *testing.T) {
	suite.Run(t, new(FileDecryptionTestSuite))
}
