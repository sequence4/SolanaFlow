# On-Chain Interaction Testing Guide

This guide provides step-by-step instructions for manually testing the complete on-chain interaction flow in the SolanaFlow dapp generator.

## Prerequisites

- Docker running locally
- Phantom wallet installed and set to Devnet
- Node.js and npm/yarn installed
- Access to the SolanaFlow application

## Complete Testing Flow

### 1. Project Creation and Code Generation

#### Step 1.1: Create a New Project
1. Open SolanaFlow application
2. Click "Create New Project"
3. Add nodes to the flow:
   - Add an "Initialize Mint" instruction node
   - Add a "Mint To" instruction node
   - Connect the nodes if needed
4. Save the project

**Expected Result:** Project created successfully with a unique project ID

#### Step 1.2: Generate Code
1. Click the "Generate Code" button
2. Wait for the generation to complete (watch the progress indicators)

**Expected Result:** 
- Code generation completes without errors
- You see "Program built successfully" message
- A program ID is displayed in the logs

**Verify:**
```bash
# Check if IDL was extracted
curl http://localhost:3001/api/projects/{PROJECT_ID}/details | jq '.details.projectState.idl'
```

### 2. Program Deployment

#### Step 2.1: Deploy to Devnet
1. Click the "Deploy" button
2. Connect your Phantom wallet (ensure it's set to Devnet)
3. Approve all transaction prompts

**Expected Result:**
- Deployment completes successfully
- Program ID is shown
- You see "IDL uploaded successfully" in console logs

#### Step 2.2: Verify Deployment
1. Copy the program ID from the deployment success message
2. Visit [Solana Explorer](https://explorer.solana.com/?cluster=devnet)
3. Search for your program ID
4. Verify the program shows as "Executable: Yes"

**API Verification:**
```bash
# Check program status
curl http://localhost:3001/api/projects/{PROJECT_ID}/program-status

# Expected response:
{
  "deployed": true,
  "executable": true,
  "programId": "...",
  "hasIdl": true,
  "idl": {...}
}
```

### 3. Frontend Interaction

#### Step 3.1: Access the Interface
1. Navigate to the "Interface" tab in your project
2. Wait for the iframe to load (may take a few seconds)
3. You should see the SolMint interface

**Expected Result:**
- Interface loads successfully
- Program ID is displayed at the top
- Status badge shows "✓ Deployed"

#### Step 3.2: Get Test SOL
1. Connect your wallet using the button in the interface
2. Click "Get Devnet SOL" button
3. Wait for the airdrop to complete

**Expected Result:**
- Toast notification shows "Airdrop successful!"
- Your balance shows ~2 SOL

#### Step 3.3: Initialize a Mint
1. In the "Initialize Mint" card:
   - Set Decimals: 9
   - Leave Mint Authority blank (will use your wallet)
   - Check "Create Token Metadata"
   - Fill in token details:
     - Name: "Test Token"
     - Symbol: "TEST"
     - URI: Leave blank or use a valid metadata URI
2. Click "Initialize Mint"
3. Approve the transaction in Phantom

**Expected Result:**
- Transaction succeeds
- Success message appears with transaction ID
- Mint public key is displayed

#### Step 3.4: Mint Tokens
1. In the "Mint New Token" card:
   - Destination Address: Use your wallet address
   - Amount: 1000000000 (for 1 token with 9 decimals)
2. Click "Mint Token"
3. Approve the transaction

**Expected Result:**
- Tokens are minted successfully
- Transaction ID is displayed
- Tokens appear in your wallet

### 4. Debug Panel

#### Step 4.1: Open Debug Panel
1. Look for the "Debug Info" panel in the bottom-right corner
2. Click to expand it

**What to Check:**
- Program ID matches deployment
- Wallet shows as connected
- Balance is displayed
- All status indicators are green

### 5. Troubleshooting Common Issues

#### Issue: "Program not deployed"
**Solution:**
1. Check the deployment actually completed
2. Verify program ID in project details
3. Ensure container has restarted with new environment

#### Issue: "Insufficient SOL"
**Solution:**
1. Click "Get Devnet SOL" button
2. Wait a few seconds and try again
3. Check wallet is on Devnet network

#### Issue: "Transaction simulation failed"
**Solution:**
1. Check program is deployed (use debug panel)
2. Verify wallet has SOL
3. Check browser console for detailed error

#### Issue: "IDL not found"
**Solution:**
1. This is non-critical - frontend will use bundled IDL
2. To fix: Redeploy the program
3. Check logs for IDL upload status

### 6. Automated Testing

Run the comprehensive test suite:

```bash
# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
export SOLANA_RPC_URL=https://api.devnet.solana.com

# Run tests
npm test tests/on-chain-interaction.test.ts
```

### 7. API Testing with cURL

Test individual endpoints:

```bash
# Get program status
curl http://localhost:3001/api/projects/{PROJECT_ID}/program-status

# Get project details with IDL
curl http://localhost:3001/api/projects/{PROJECT_ID}/details | jq '.details.projectState'

# Check container URL
curl http://localhost:3001/api/projects/{PROJECT_ID}/container-url
```

### 8. Verification Checklist

Run through this checklist to ensure everything works:

- [ ] Project creates successfully
- [ ] Code generates without errors
- [ ] Program builds and shows program ID
- [ ] IDL is extracted and saved
- [ ] Program deploys to devnet
- [ ] Program shows as executable on-chain
- [ ] IDL uploads to chain (or fails gracefully)
- [ ] Container restarts with new environment
- [ ] Frontend loads with correct program ID
- [ ] Program status shows as deployed
- [ ] Wallet connects successfully
- [ ] Airdrop works
- [ ] Mint initialization succeeds
- [ ] Token minting works
- [ ] Debug panel shows correct information
- [ ] Tokens appear in wallet

### 9. Performance Benchmarks

Expected timings for operations:

- Code Generation: 10-30 seconds
- Program Build: 30-60 seconds
- Deployment: 10-20 seconds
- IDL Upload: 5-10 seconds
- Container Restart: 5-10 seconds
- Frontend Load: 2-5 seconds
- Transaction Confirmation: 2-5 seconds

### 10. Logging and Monitoring

Check these logs for debugging:

**Server Logs:**
```bash
# Watch server logs
docker logs -f solanaflow-server

# Key log messages to look for:
"[BUILD] IDL extracted successfully"
"[DEPLOY] IDL uploaded successfully"
"[DEPLOY] Container restarted successfully"
```

**Browser Console:**
- Open DevTools (F12)
- Check Console tab for:
  - `[VERIFY] Program verification successful`
  - `[MINT] Transaction successful`
  - `[DEBUG] Program ID from .env`

**Docker Container:**
```bash
# Check container environment
docker exec {CONTAINER_NAME} cat /usr/src/web/.env | grep NEXT_PUBLIC_PROGRAM_ID

# Check IDL file exists
docker exec {CONTAINER_NAME} ls -la /usr/src/target/idl/
```

## Summary

This testing guide covers the complete flow from project creation to on-chain interaction. Following these steps ensures that:

1. Programs are generated and built correctly
2. Deployment works with proper IDL handling
3. Frontend can interact with deployed programs
4. Users can mint and manage tokens
5. Error handling works appropriately

For automated testing, use the test suite in `/tests/on-chain-interaction.test.ts`.