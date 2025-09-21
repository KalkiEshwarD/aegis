package config

import (
	"fmt"
	"net/url"
	"strings"
)

// BuildFileDownloadURL constructs the full URL for downloading a file
func BuildFileDownloadURL(cfg *Config, fileID string) string {
	path := strings.Replace(cfg.APIEndpoints.Files.Download, ":id", url.PathEscape(fileID), 1)
	return fmt.Sprintf("%s%s", cfg.BaseURL, path)
}

// BuildShareAccessURL constructs the full URL for accessing a shared file via token
func BuildShareAccessURL(cfg *Config, token string) string {
	path := strings.Replace(cfg.APIEndpoints.Share.Access, ":token", url.PathEscape(token), 1)
	return fmt.Sprintf("%s%s", cfg.BaseURL, path)
}

// BuildSharedBaseURL constructs the full URL for the shared files base endpoint
func BuildSharedBaseURL(cfg *Config) string {
	return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.APIEndpoints.Shared.Base)
}

// BuildFilesBaseURL constructs the full URL for the files base endpoint
func BuildFilesBaseURL(cfg *Config) string {
	return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.APIEndpoints.Files.Base)
}

// BuildShareBaseURL constructs the full URL for the share base endpoint
func BuildShareBaseURL(cfg *Config) string {
	return fmt.Sprintf("%s%s", cfg.BaseURL, cfg.APIEndpoints.Share.Base)
}