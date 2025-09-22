# GCP Deployment Secrets for Aegis

This document lists the GitHub secrets required to deploy the Aegis app to Google Cloud using GitHub Actions. Values were retrieved using `gcloud` commands from your GCP project (`aegis-drive`).

## Required GitHub Secrets

### 1. GCP_PROJECT_ID
- **Value**: `aegis-drive`
- **How to get**: `gcloud config get-value project`

### 2. GCP_SA_KEY
- **Value**: 
  ```
  ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYWVnaXMtZHJpdmUiLAogICJwcml2YXRlX2tleV9pZCI6ICJjNjQ1NTE3ZjAyYjFlYThlMGNkMzA4YTIxMWZlM2U1NGEyNDQ5OGNlIiwKICAicHJpdmF0ZV9rZXkiOiAiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdmdJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLZ3dnZ1NrQWdFQUFvSUJBUUM0dDVJcHFFTG9rMVROXG5JNEZJRVlJaDhUM1c1WnhvNVRCNDgrL2NyQlA2MDk3T0U4d09mQThNR0FuZ1ZyaDRDOC80dEJEV1ZwNk12VDRjXG4zODJMc2RrQzkvaWFmaUlydzczUVFDbGk2L0tMV2JkcFcrcUdnbzZ4cnFibnVWclo5TlkzS016SkxMK1kxYTQxXG5pdlZ3RGd4S2x0ZTJUTytjL3JyNWtDd0ZYTDkyM1VxTFV2Sm5MUGJpZUZqdVNjN0dXK0dPUVVOMEdqRWUyWVNaXG41VW9vdVFFSGtQMTFSbVh3ZDlwRE1tVUIxZWM4bmxrdTJ5czhZRXpITlZGTUNVQnU1STQzTUdHYkdpVmFXSDdTXG42bG5xcE1lb0sxRmtjY1gvWWY3T1VZQlhKakpIVkhkTE4yTFVVZGtQOVhQNFF0QkJqWEhrZmkxY0c0WWJnK0Y0XG5aWW5SK0hVdEFnTUJBQUVDZ2dFQUs3aUhpQVNqa1prTndXQmVBVWpqbkZVVlpnQUMvWEVDQUI3ODd5WnJ0RHJoXG55YlUxMzFmTjEvYjRuM2puUU1MSy92cmY0VnV2TzNDdmV2WWVHS3FIeXdRV2U3clBLN3l3K05HMitnc081WnplXG5wTGwwMFZHbHBMaktHSjd1dWhnUmZBelVLK25EajlGRDRyaDVUNFNEdEVQdjJ0NXErS1h5YTQrTVc5aVFHUG53XG5xOUdWMlEwaWhuSXZ6RTArVEltVmUzWmk1VzFsejB5ejBENGpjU2hwS2RJRVRMdm9RRDdHaEsrc0tNWkNVQ1ppXG5aZzQzNHFLeEMzVndVeWhJVi81cVZTRjlFN3UxQ1ZtQU14WmxBQ0kxZkVzRUhZS0Q3TWt3bWRhUU5aOGhuOUhyXG5UUlN0ZW0wT3ExOXRMUXpYdjJuS2hzVERnRzBXZHV5VUpDdW9kdXRVQVFLQmdRRHA1NDkvVUVMRWNjMEFGdDQwXG5rb3MvdkZYaFczVTZIeUZRUzBwMVd5M3YvVEtDSmNYOWZEMlZiblI2anlpMTVxSmdkNnZHUXR5aWJxVVdUYUNXXG5UNWtTRU5KZTRJeWVZNzl4NGtuL0NwUUxKME1yMmJEcUxEam51Q0UzRWp6bGZTZ05jS0llLytkbUQ0azdZYUxBXG41dThtazIwckxXNzViclFhRE90ZWdMaGlEUUtCZ1FES0tvYU94WWwrajN4ZjNTVjBCR3RWanFkcW5YVmh1eWY2XG55elMydGwvOHpiZGQ0NkhjVGhhQ2oveFp2VHRWcTJUa0M4M2NVQlRWakp0ajZZbmdwUTc2Y09ZNTFHcktuQTAxXG5aWDVLWld6dUs1djEzeVFlZ29vc1N3TmRBUTkzMlFpMitWaDlpazZTMENIaGdrS0JmS2ZtY0Y1V3VkSVFQVlN0XG43U0dBc2pvM29RS0JnUUM4Nk5vS1Z3WTFwanVOTU9yeHh0RlQvb1hWNW9tOUVWdFVnQnA0d2RWT0dFNXNzcGsvXG5hdEpLRjlWWERyd3dmVDd6Ym5ON1FwRHpWeTFaNEFRc29jamN3RjFIWjAvcXRHRHdWM1N2MlJsTUVMKzljS25qXG4xeWQyYmszVkxwT2tQUHJXTC91ZjBjcFBzWWlDUHc2MWdVM3c5K3laaks0dUlleXZoWE9xOVliMUdRS0JnRFJzXG44TFhuYmU5ZkFDN1A1MTE5bytQcytXZEJhK1lySllQNDNET2hlYVRTS0FIMS9NeG5oNWpXQStlMWxjUnlqTmhDXG5ZMkVGZDFHbGc4cFdEb1l0NTROMGNZOS9rUzMzWjhsNEIxYjlsRkR6Q0IrcmZPOVloTUpWdFlxUnN0UXVlUDhTXG5EQ3VLQ1RRek93WUN4SUpWdENpaTdTUHFUaG9kL1c2WTlyNHIrY0xoQW9HQkFLeERCdTV3WnA5TEprdTd3a0FyXG5VL20wSTNwQWQvWFp2NFgyb093RmlOc2I2LzEzMGt0d3daOHBQemdOZGJhamZNQWIzS0ZpaWxFVjNTUlNya0NSXG43NGtROUx0LzJaSm4rOTdpZGFmTXJaTUNUN28vL244VFo2UkY3Z21UK2VyaDkvNlFEbDFaUkl1eWNmQS9DeHFaXG42Mi94N0U0c3VETkFXY1Ftayt2VFRHU1Bcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJhZWdpcy1zYUBhZWdpcy1kcml2ZS5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgImNsaWVudF9pZCI6ICIxMTMwODAxNDAwNTU5MzkwNDA1NTEiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS10b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2FlZ2lzLXNhJTQwYWVnaXMtZHJpdmUuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K
  ```
- **How to get**: Base64 encode the `service-account-key.json` file created by the setup script.

### 3. DATABASE_URL
- **Value**: `postgresql://aegis_user:/2JHMYZeClY04c1dJF8Ufbj6WL3ZGxIm6PObK0+8cvU=@34.93.51.126:5432/aegis?sslmode=require`
- **How to get**: The IP is from `gcloud sql instances describe aegis-db --format="value(ipAddresses[0].ipAddress)"`. The password was generated during setup and isn't retrievable via gcloud. You'll need to use the password you set or reset it if forgotten.

### 3.1. DB_PASSWORD
- **Value**: `/2JHMYZeClY04c1dJF8Ufbj6WL3ZGxIm6PObK0+8cvU=`
- **How to get**: This is the same password used in DATABASE_URL, extracted for migration scripts.

### 4. JWT_SECRET
- **Value**: `3+Q71GgAirXU+e/cdzW1gtjJQXEM4YfB4tBJ7FbaL0E=`
- **How to get**: Generate one, e.g., `openssl rand -base64 32`.

### 5. MINIO_ENDPOINT
- **Value**: `storage.googleapis.com`

### 6. MINIO_ACCESS_KEY
- **Value**: `GOOG1ED6YKEFQANF5U6A7Y7QESZRISS3IT63EVP4L2EU2MHAN4JY6IEZKV2JW`
- **How to get**: First, create an HMAC key if none exists: `gcloud storage hmac create aegis-sa@aegis-drive.iam.gserviceaccount.com --project=aegis-drive`. Then list: `gcloud storage hmac list --project=aegis-drive` to get the access key.

### 7. MINIO_SECRET_KEY
- **Value**: `MHO0VEGc2rhtZqmMZzopzHP45kzynDben0QtoN09`
- **How to get**: Same as above, from the HMAC list output.

### 8. MINIO_BUCKET
- **Value**: `aegis-files-46c24f7918ac52a2`
- **How to get**: `gcloud storage buckets list --format="value(name)" | grep aegis-files`

### 9. CORS_ALLOWED_ORIGINS
- **Value**: The URL of your deployed frontend (e.g., `https://aegis-frontend-<hash>-uc.a.run.app`)
- **How to get**: After deployment, run: `gcloud run services describe aegis-frontend --region=us-central1 --project=aegis-drive --format='value(status.url)'`

### 10. REACT_APP_GRAPHQL_ENDPOINT
- **Value**: The URL of your deployed backend + `/v1/graphql` (e.g., `https://aegis-backend-<hash>-uc.a.run.app/v1/graphql`)
- **How to get**: After deployment, run: `gcloud run services describe aegis-backend --region=us-central1 --project=aegis-drive --format='value(status.url)'` and append `/v1/graphql`

### 11. REACT_APP_API_BASE_URL
- **Value**: The URL of your deployed backend (e.g., `https://aegis-backend-<hash>-uc.a.run.app`)
- **How to get**: After deployment, run: `gcloud run services describe aegis-backend --region=us-central1 --project=aegis-drive --format='value(status.url)'`

## Notes
- For the MinIO-related secrets, since your app appears to use MinIO client with GCS, you'll need to create HMAC keys for the service account if not already done.
- The Cloud Run URLs will be available after the first successful deployment.
- Set these secrets in your GitHub repository under Settings > Secrets and variables > Actions.