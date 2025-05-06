# Database Environment Setup

This document explains how to set up and manage database connections across different environments (development, staging, production).

## Environment Configuration

The application uses different environment files for each deployment context:

| Environment | File               | Database Location                        | Purpose                                |
|-------------|--------------------|-----------------------------------------|----------------------------------------|
| Development | `.env.local`       | Local Docker container (localhost:5432)  | Local development and testing          |
| Staging     | `.env.staging`     | AWS Lightsail staging instance          | Pre-production testing and QA          |
| Production  | `.env.production`  | AWS Lightsail production instance       | Live application                       |

## Setting Up Development Environment

1. Start the PostgreSQL container using Docker Compose:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Create or update your `.env.local` file:

   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/flowcode_dev
   # Add other environment variables
   ```

3. Restart your Next.js development server:

   ```bash
   pnpm dev
   ```

## Setting Up Staging/Production

1. Create your database in AWS Lightsail:
   - Go to Lightsail → Databases → Create database
   - Choose PostgreSQL and appropriate plan
   - Note the endpoint, username, and password

2. Create appropriate environment file (`.env.staging` or `.env.production`):

   ```
   DATABASE_URL=postgres://dbuser:password@ls-endpoint.us-east-1.lightsail.amazonaws.com:5432/dbname?sslmode=require
   # Add other environment variables
   ```

3. For secure connections, make sure to use `sslmode=require` in the connection URL

## Running Migrations

To run database migrations for specific environments:

```bash
# Development
pnpm db:migrate

# Staging
DATABASE_URL=$(grep DATABASE_URL .env.staging | cut -d= -f2) pnpm db:migrate

# Production
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d= -f2) pnpm db:migrate
```

## Safety Features

1. **Development Fallback**: In development, if the database connection fails, the application will log a warning but continue to function by returning empty results.

2. **Master User Protection**: The application will refuse to start if it detects the connection string using the `dbmasteruser` account for safety.

3. **SSL Connections**: For production/staging, SSL connections are enforced with certificate verification.

## Troubleshooting

- **ECONNREFUSED errors**: Check that your Docker container is running (`docker ps`) and that the port 5432 is exposed
- **Authentication errors**: Verify credentials in your environment files
- **SSL errors**: Ensure the `rds-combined-ca-bundle.pem` file exists in the `certs` directory

## Best Practices

1. Never commit real credentials to Git
2. Use different databases for different environments
3. Limit connection pool size to prevent overwhelming the database
4. Always run migrations before deploying new code
5. For security, use database users with minimal required permissions 