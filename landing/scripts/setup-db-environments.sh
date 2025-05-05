#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up database environments${NC}"

# 1. Start the local development database
echo -e "${YELLOW}Starting local development database with Docker Compose...${NC}"
if [ ! -f "../docker-compose.dev.yml" ]; then
  echo -e "${RED}Error: docker-compose.dev.yml not found in the project root directory.${NC}"
  exit 1
fi

docker compose -f ../docker-compose.dev.yml up -d db
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to start the development database container. Please check Docker is running.${NC}"
  exit 1
fi
echo -e "${GREEN}Development database is now running at localhost:5432${NC}"

# 2. Create .env.local for development (if it doesn't exist)
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}Creating .env.local for development...${NC}"
  cat > .env.local << EOF
DATABASE_URL=postgres://postgres:postgres@localhost:5432/flowcode_dev
# Keep existing Upstash Redis environment variables
UPSTASH_REDIS_REST_URL=$(grep UPSTASH_REDIS_REST_URL .env.example | cut -d= -f2)
UPSTASH_REDIS_REST_TOKEN=$(grep UPSTASH_REDIS_REST_TOKEN .env.example | cut -d= -f2)
EOF
  echo -e "${GREEN}.env.local created successfully${NC}"
else
  echo -e "${YELLOW}.env.local already exists, not overwriting${NC}"
  echo -e "Make sure it contains: DATABASE_URL=postgres://postgres:postgres@localhost:5432/flowcode_dev"
fi

# 3. Create example files for staging and production
echo -e "${YELLOW}Creating example environment files for staging and production...${NC}"

# Create .env.staging.example
cat > .env.staging.example << EOF
# Staging environment
DATABASE_URL=postgres://dbuser:password@ls-staging-endpoint.us-east-1.lightsail.amazonaws.com:5432/flowcode_stage?sslmode=require

# Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-staging-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_staging_token
EOF

# Create .env.production.example
cat > .env.production.example << EOF
# Production environment
DATABASE_URL=postgres://dbuser:password@ls-production-endpoint.us-east-1.lightsail.amazonaws.com:5432/flowcode_prod?sslmode=require

# Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-production-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_production_token
EOF

echo -e "${GREEN}Created .env.staging.example and .env.production.example${NC}"
echo -e "${YELLOW}NOTE: For staging/production, copy the example file and update with real credentials:${NC}"
echo -e "  cp .env.staging.example .env.staging"
echo -e "  cp .env.production.example .env.production"

# 4. Print instructions
echo -e "\n${GREEN}Environment Setup Complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. For local development:"
echo -e "   - Restart your Next.js server: pnpm dev"
echo -e "   - Your app will now connect to the local Postgres database"
echo -e "\n2. For staging/production deployments:"
echo -e "   - Create your databases in AWS Lightsail"
echo -e "   - Copy the example files and update with real credentials"
echo -e "   - Use the appropriate environment file during deployment"
echo -e "\n3. Running migrations:"
echo -e "   - Development: pnpm db:migrate"
echo -e "   - Staging: DATABASE_URL=\$STAGING_DB_URL pnpm db:migrate"
echo -e "   - Production: DATABASE_URL=\$PRODUCTION_DB_URL pnpm db:migrate" 