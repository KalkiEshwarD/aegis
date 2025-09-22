# Aegis Project

This repository contains the source code for Aegis, a secure file storage and sharing application.

## Directory Structure

*   `.env` & `.env.example`: These files manage environment variables for the project. `.env.example` serves as a template, and `.env` is used for local configuration.
*   `aegis-policy.json`: An AWS IAM policy file that defines permissions for accessing an S3 bucket named `aegis-files`.
*   `cloud_sql_proxy`: A binary for the Google Cloud SQL Auth proxy, likely used for connecting to a Cloud SQL database instance.
*   `docker-compose.yml`: This file orchestrates the local development environment using Docker. It defines the services for the backend, frontend, database, and object storage.
*   `package.json` & `package-lock.json`: Node.js project files, likely used for running utility scripts from the root of the project.
*   `backend/`: This directory contains the backend application, which is written in Go. It exposes a GraphQL API.
*   `frontend/`: This directory contains the frontend application, which is a React-based web interface.
*   `google-cloud-sdk/`: This directory contains the Google Cloud SDK.
*   `shared/`: This directory contains files that are shared between the frontend and backend applications, such as configuration or validation rules.

## Services

The `docker-compose.yml` file defines the following services:

*   **postgres**: A PostgreSQL database for storing application data.
*   **minio**: An S3-compatible object storage service used for local file storage.
*   **backend**: The Go backend application.
*   **frontend**: The React frontend application.
