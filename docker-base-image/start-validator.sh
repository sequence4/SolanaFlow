#!/bin/bash
set -e

# Configuration
LEDGER_DIR="/usr/local/validator-ledger"
CONFIG_DIR="/usr/local/validator-config"
LOG_DIR="/usr/local/validator-logs"
PROGRAM_DIR="/usr/src/target/deploy"
VALIDATOR_LOG="$LOG_DIR/validator.log"
VALIDATOR_PID_FILE="$LOG_DIR/validator.pid"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Solana Test Validator Manager ===${NC}"

# Function to check if validator is already running
check_validator_running() {
    if [ -f "$VALIDATOR_PID_FILE" ]; then
        PID=$(cat "$VALIDATOR_PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            return 0  # Validator is running
        else
            rm -f "$VALIDATOR_PID_FILE"
        fi
    fi
    return 1  # Validator is not running
}

# Handle different commands
case "$1" in
    "reset")
        echo -e "${YELLOW}Resetting validator state...${NC}"
        # Kill existing validator if running
        if check_validator_running; then
            echo "Stopping existing validator (PID: $(cat $VALIDATOR_PID_FILE))..."
            kill $(cat "$VALIDATOR_PID_FILE") 2>/dev/null || true
            sleep 2
        fi
        # Clear ledger
        rm -rf $LEDGER_DIR/*
        echo -e "${GREEN}Validator state reset complete${NC}"
        shift  # Remove 'reset' from arguments
        ;;
    "stop")
        if check_validator_running; then
            echo -e "${YELLOW}Stopping validator (PID: $(cat $VALIDATOR_PID_FILE))...${NC}"
            kill $(cat "$VALIDATOR_PID_FILE")
            rm -f "$VALIDATOR_PID_FILE"
            echo -e "${GREEN}Validator stopped${NC}"
        else
            echo -e "${YELLOW}Validator is not running${NC}"
        fi
        exit 0
        ;;
    "status")
        if check_validator_running; then
            echo -e "${GREEN}Validator is running (PID: $(cat $VALIDATOR_PID_FILE))${NC}"
            # Try to get cluster version
            if solana cluster-version --url http://localhost:8899 2>/dev/null; then
                echo -e "${GREEN}RPC endpoint is responsive${NC}"
            else
                echo -e "${YELLOW}RPC endpoint is not yet responsive (may still be starting)${NC}"
            fi
            exit 0
        else
            echo -e "${RED}Validator is not running${NC}"
            exit 1
        fi
        ;;
esac

# Check if validator is already running
if check_validator_running; then
    echo -e "${YELLOW}Validator is already running (PID: $(cat $VALIDATOR_PID_FILE))${NC}"
    echo "Use '$0 stop' to stop it or '$0 reset' to restart with clean state"
    exit 0
fi

# Build program arguments for pre-loading
echo -e "${GREEN}Scanning for programs to pre-load...${NC}"
PROGRAM_ARGS=""
PROGRAM_COUNT=0
PROGRAM_LIST=""

# Also check in project-specific directories
ADDITIONAL_DIRS="/usr/src/*/target/deploy"

for CHECK_DIR in $PROGRAM_DIR $ADDITIONAL_DIRS; do
    if [ -d "$CHECK_DIR" ]; then
        echo "  Checking directory: $CHECK_DIR"
        for program_so in $CHECK_DIR/*.so; do
            if [ -f "$program_so" ]; then
                # Skip template programs
                if [[ "$program_so" == *"anchor_template"* ]] || [[ "$program_so" == *"anchor-template"* ]]; then
                    continue
                fi
                
                # Extract base name without .so extension
                base_name=$(basename "$program_so" .so)
                keypair_file="${program_so%.so}-keypair.json"
                
                if [ -f "$keypair_file" ]; then
                    # Get public key from keypair
                    PROGRAM_ID=$(solana-keygen pubkey "$keypair_file" 2>/dev/null)
                    if [ -n "$PROGRAM_ID" ]; then
                        # Check if we haven't already added this program
                        if [[ ! "$PROGRAM_LIST" == *"$PROGRAM_ID"* ]]; then
                            PROGRAM_ARGS="$PROGRAM_ARGS --bpf-program $PROGRAM_ID $program_so"
                            PROGRAM_LIST="$PROGRAM_LIST $PROGRAM_ID"
                            echo -e "  ${GREEN}✓${NC} Pre-loading: ${base_name} (${PROGRAM_ID:0:16}...)"
                            ((PROGRAM_COUNT++))
                        fi
                    fi
                else
                    echo -e "  ${YELLOW}⚠${NC} No keypair for ${base_name}.so"
                fi
            fi
        done
    fi
done

if [ $PROGRAM_COUNT -eq 0 ]; then
    echo -e "${YELLOW}No programs found to pre-load${NC}"
else
    echo -e "${GREEN}Pre-loading $PROGRAM_COUNT program(s)${NC}"
fi

# Add test accounts with SOL for testing
TEST_ACCOUNTS=""
if [ -n "$WALLET_PUBKEY" ]; then
    # Create a few test accounts with balance
    for i in {1..3}; do
        TEST_KEYPAIR="/tmp/test-account-$i.json"
        solana-keygen new --outfile "$TEST_KEYPAIR" --no-bip39-passphrase --force --silent 2>/dev/null
        TEST_PUBKEY=$(solana-keygen pubkey "$TEST_KEYPAIR")
        echo -e "  ${GREEN}✓${NC} Test account $i: ${TEST_PUBKEY:0:16}..."
    done
fi

# Start validator
echo -e "${GREEN}Starting Solana test validator...${NC}"
echo "  RPC Port: 8899"
echo "  Faucet Port: 9900"
echo "  Ledger: $LEDGER_DIR"
echo "  Logs: $VALIDATOR_LOG"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start validator in background
nohup solana-test-validator \
    --ledger "$LEDGER_DIR" \
    --rpc-port 8899 \
    --faucet-port 9900 \
    --bind-address 0.0.0.0 \
    --rpc-bind-address 0.0.0.0 \
    --faucet-host 0.0.0.0 \
    --rpc-cors all \
    --quiet \
    --reset \
    --log \
    $PROGRAM_ARGS \
    > "$VALIDATOR_LOG" 2>&1 &

VALIDATOR_PID=$!
echo $VALIDATOR_PID > "$VALIDATOR_PID_FILE"

echo -e "${YELLOW}Waiting for validator to start (PID: $VALIDATOR_PID)...${NC}"

# Wait for validator to be ready (max 30 seconds)
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if solana cluster-version --url http://localhost:8899 >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Validator is ready!${NC}"
        
        # Get cluster version for confirmation
        CLUSTER_VERSION=$(solana cluster-version --url http://localhost:8899 2>/dev/null)
        echo "  Cluster version: $CLUSTER_VERSION"
        
        # If wallet pubkey provided, airdrop SOL
        if [ -n "$WALLET_PUBKEY" ]; then
            echo -e "${GREEN}Airdropping 100 SOL to $WALLET_PUBKEY...${NC}"
            solana airdrop 100 "$WALLET_PUBKEY" --url http://localhost:8899 || {
                echo -e "${YELLOW}Warning: Airdrop failed (wallet may already be funded)${NC}"
            }
        fi
        
        echo -e "${GREEN}=== Validator started successfully ===${NC}"
        echo "RPC URL: http://localhost:8899"
        echo "Faucet URL: http://localhost:9900"
        echo "WebSocket URL: ws://localhost:8900"
        exit 0
    fi
    
    # Check if process is still running
    if ! ps -p $VALIDATOR_PID > /dev/null 2>&1; then
        echo -e "${RED}✗ Validator process died unexpectedly${NC}"
        echo "Check logs at: $VALIDATOR_LOG"
        tail -n 20 "$VALIDATOR_LOG"
        rm -f "$VALIDATOR_PID_FILE"
        exit 1
    fi
    
    sleep 1
    ((ATTEMPT++))
    echo -n "."
done

echo
echo -e "${RED}✗ Validator failed to start within 30 seconds${NC}"
echo "Check logs at: $VALIDATOR_LOG"
echo "Last 20 lines of log:"
tail -n 20 "$VALIDATOR_LOG"
exit 1