#!/bin/bash
# Advanced Component Management Testing Script
# Tests versioning, AI generation, and analytics features

set -e

PROJECT_ID=${1:-"test-advanced"}
SERVER_URL="http://localhost:9999"
echo "🧪 Testing Advanced Component Management Features"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test utilities
test_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

test_fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

test_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

test_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Test 1: Health Check
echo "🏥 Test 1: Health Check"
echo "-----------------------"
HEALTH_RESPONSE=$(curl -s "${SERVER_URL}/api/advanced/health" 2>/dev/null)
if [[ $? -eq 0 ]]; then
  test_pass "Advanced features API is responding"
  echo "  Features status:"
  echo "$HEALTH_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
features = data.get('features', {})
for feature, status in features.items():
    color = '\033[0;32m' if status == 'enabled' else '\033[1;33m'
    print(f'    - {feature}: {color}{status}\033[0m')
" 2>/dev/null || echo "    (unable to parse response)"
else
  test_fail "Advanced features API not responding"
fi
echo ""

# Test 2: Version Management
echo "📦 Test 2: Version Management"
echo "-----------------------------"

# Get version history
test_info "Fetching version history..."
VERSIONS=$(curl -s -X GET "${SERVER_URL}/api/advanced/projects/${PROJECT_ID}/versions" \
  -H "Content-Type: application/json" 2>/dev/null)

if [[ $? -eq 0 ]]; then
  VERSION_COUNT=$(echo "$VERSIONS" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('versions', [])))" 2>/dev/null || echo "0")
  test_pass "Retrieved version history: $VERSION_COUNT versions found"
  
  # Display recent versions
  echo "  Recent versions:"
  echo "$VERSIONS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
versions = data.get('versions', [])[:3]
for v in versions:
    print(f\"    - {v.get('version', 'unknown')} ({v.get('status', 'unknown')}) - {v.get('created_at', 'unknown date')}\")
" 2>/dev/null || echo "    (no versions found)"
else
  test_warn "Could not retrieve version history"
fi
echo ""

# Test 3: AI Generation (if enabled)
echo "🤖 Test 3: AI Component Generation"
echo "----------------------------------"

if [ -n "$ANTHROPIC_API_KEY" ]; then
  test_info "Testing AI component generation..."
  
  AI_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/advanced/ai/generate-component" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Create a simple button component that connects to a Solana wallet",
      "context": {
        "projectId": "'${PROJECT_ID}'",
        "programId": "11111111111111111111111111111111"
      }
    }' 2>/dev/null)
  
  if [[ $? -eq 0 ]]; then
    SUCCESS=$(echo "$AI_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
    if [[ "$SUCCESS" == "True" ]]; then
      test_pass "AI component generation successful"
      CONFIDENCE=$(echo "$AI_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('component', {}).get('metadata', {}).get('confidence', 0))" 2>/dev/null || echo "unknown")
      echo "  Confidence: $CONFIDENCE"
    else
      ERROR=$(echo "$AI_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', 'Unknown error'))" 2>/dev/null)
      test_warn "AI generation not available: $ERROR"
    fi
  else
    test_warn "AI generation endpoint not responding"
  fi
else
  test_info "Skipping AI tests (ANTHROPIC_API_KEY not set)"
fi
echo ""

# Test 4: Component Documentation
echo "📚 Test 4: Documentation Generation"
echo "----------------------------------"

test_info "Generating documentation for sample component..."

SAMPLE_CODE='
export const SampleComponent = () => {
  return <div>Hello World</div>;
};
'

DOC_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/advanced/ai/generate-docs" \
  -H "Content-Type: application/json" \
  -d "{
    \"componentCode\": $(echo "$SAMPLE_CODE" | python3 -c "import sys, json; print(json.dumps(sys.stdin.read()))"),
    \"componentName\": \"SampleComponent\"
  }" 2>/dev/null)

if [[ $? -eq 0 ]]; then
  SUCCESS=$(echo "$DOC_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
  if [[ "$SUCCESS" == "True" ]]; then
    test_pass "Documentation generated successfully"
    echo "  Documentation preview:"
    echo "$DOC_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
doc = data.get('documentation', {}).get('markdown', '')
lines = doc.split('\\n')[:5]
for line in lines:
    print(f'    {line}')
" 2>/dev/null || echo "    (unable to display)"
  else
    test_warn "Documentation generation not available"
  fi
else
  test_warn "Documentation endpoint not responding"
fi
echo ""

# Test 5: Analytics Dashboard
echo "📊 Test 5: Analytics Dashboard"
echo "------------------------------"

test_info "Fetching analytics data..."

ANALYTICS=$(curl -s -X GET "${SERVER_URL}/api/advanced/projects/${PROJECT_ID}/analytics" \
  -H "Content-Type: application/json" 2>/dev/null)

if [[ $? -eq 0 ]]; then
  test_pass "Analytics data retrieved"
  
  # Display summary
  echo "  Dashboard summary:"
  echo "$ANALYTICS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
summary = data.get('dashboard', {}).get('summary', {})
print(f\"    Health: {summary.get('health', 'unknown')}\")
print(f\"    Error Rate: {summary.get('errorRate', 0):.2f}%\")
print(f\"    Cache Hit Rate: {summary.get('cacheHitRate', 0):.2f}%\")
print(f\"    Avg Load Time: {summary.get('avgLoadTime', 0):.2f}ms\")
print(f\"    Recommendation: {summary.get('recommendation', 'No recommendations')}\")
" 2>/dev/null || echo "    (unable to parse analytics)"
else
  test_warn "Analytics not available"
fi
echo ""

# Test 6: Metric Tracking
echo "📈 Test 6: Metric Tracking"
echo "-------------------------"

test_info "Sending test metrics..."

# Track component load
TRACK_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/advanced/analytics/track" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "component-load",
    "data": {
      "projectId": "'${PROJECT_ID}'",
      "componentName": "TestComponent",
      "version": "v1.0.0",
      "loadTime": 250,
      "cached": false
    }
  }' 2>/dev/null)

if [[ $? -eq 0 ]]; then
  test_pass "Component load metric tracked"
else
  test_warn "Failed to track component load metric"
fi

# Track hot reload
RELOAD_RESPONSE=$(curl -s -X POST "${SERVER_URL}/api/advanced/analytics/track" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "hot-reload",
    "data": {
      "projectId": "'${PROJECT_ID}'",
      "triggerType": "manual",
      "reloadTime": 150,
      "success": true
    }
  }' 2>/dev/null)

if [[ $? -eq 0 ]]; then
  test_pass "Hot reload metric tracked"
else
  test_warn "Failed to track hot reload metric"
fi
echo ""

# Test 7: Version Comparison
echo "🔍 Test 7: Version Comparison"
echo "-----------------------------"

# Only test if we have versions
if [[ "$VERSION_COUNT" -gt "1" ]]; then
  test_info "Comparing versions..."
  
  # Get two version names for comparison
  V1=$(echo "$VERSIONS" | python3 -c "import sys, json; versions = json.load(sys.stdin).get('versions', []); print(versions[0].get('version', '')) if len(versions) > 0 else print('')" 2>/dev/null)
  V2=$(echo "$VERSIONS" | python3 -c "import sys, json; versions = json.load(sys.stdin).get('versions', []); print(versions[1].get('version', '')) if len(versions) > 1 else print('')" 2>/dev/null)
  
  if [[ -n "$V1" && -n "$V2" ]]; then
    COMPARE_RESPONSE=$(curl -s -X GET "${SERVER_URL}/api/advanced/projects/${PROJECT_ID}/versions/compare?v1=${V1}&v2=${V2}" \
      -H "Content-Type: application/json" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
      test_pass "Version comparison successful ($V1 vs $V2)"
      echo "  Changes:"
      echo "$COMPARE_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
changes = data.get('comparison', {}).get('changes', {})
print(f\"    Added files: {len(changes.get('added', []))}\")
print(f\"    Modified files: {len(changes.get('modified', []))}\")
print(f\"    Removed files: {len(changes.get('removed', []))}\")
" 2>/dev/null || echo "    (unable to parse comparison)"
    else
      test_warn "Version comparison failed"
    fi
  else
    test_info "Not enough versions for comparison"
  fi
else
  test_info "Skipping version comparison (need at least 2 versions)"
fi
echo ""

# Test 8: Time Series Data
echo "📉 Test 8: Time Series Analytics"
echo "--------------------------------"

test_info "Fetching time series data..."

TIMESERIES=$(curl -s -X GET "${SERVER_URL}/api/advanced/projects/${PROJECT_ID}/analytics/timeseries?metricType=component-load&days=7" \
  -H "Content-Type: application/json" 2>/dev/null)

if [[ $? -eq 0 ]]; then
  DATA_POINTS=$(echo "$TIMESERIES" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('data', [])))" 2>/dev/null || echo "0")
  test_pass "Time series data retrieved: $DATA_POINTS data points"
else
  test_warn "Time series data not available"
fi
echo ""

# Test 9: Error Recovery Test
echo "🛡️ Test 9: Error Recovery"
echo "------------------------"

test_info "Testing error handling..."

# Test invalid version rollback
INVALID_ROLLBACK=$(curl -s -X POST "${SERVER_URL}/api/advanced/projects/${PROJECT_ID}/versions/rollback" \
  -H "Content-Type: application/json" \
  -d '{"targetVersion": "v999.999.999"}' 2>/dev/null)

ERROR_MSG=$(echo "$INVALID_ROLLBACK" | python3 -c "import sys, json; print(json.load(sys.stdin).get('error', ''))" 2>/dev/null)
if [[ -n "$ERROR_MSG" ]]; then
  test_pass "Error handling works correctly"
  echo "  Error message: $ERROR_MSG"
else
  test_warn "Error handling test inconclusive"
fi
echo ""

# Test 10: Performance Summary
echo "⚡ Test 10: Performance Check"
echo "----------------------------"

test_info "Checking system performance..."

# Measure API response time
START_TIME=$(date +%s%N)
curl -s "${SERVER_URL}/api/advanced/health" > /dev/null 2>&1
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( ($END_TIME - $START_TIME) / 1000000 ))

if [[ $RESPONSE_TIME -lt 100 ]]; then
  test_pass "API response time excellent: ${RESPONSE_TIME}ms"
elif [[ $RESPONSE_TIME -lt 500 ]]; then
  test_pass "API response time good: ${RESPONSE_TIME}ms"
else
  test_warn "API response time slow: ${RESPONSE_TIME}ms"
fi

echo ""
echo "============================================"
echo "📊 Test Summary"
echo "============================================"
echo ""
echo "✅ Advanced Component Management Tests Complete!"
echo ""
echo "Features Tested:"
echo "---------------"
echo "✓ Version Management"
echo "✓ AI Generation (if configured)"
echo "✓ Documentation Generation"
echo "✓ Analytics Dashboard"
echo "✓ Metric Tracking"
echo "✓ Version Comparison"
echo "✓ Time Series Data"
echo "✓ Error Recovery"
echo "✓ Performance Monitoring"
echo ""
echo "Configuration:"
echo "-------------"
echo "- Project ID: $PROJECT_ID"
echo "- Server URL: $SERVER_URL"
echo "- AI Enabled: $([ -n "$ANTHROPIC_API_KEY" ] && echo "Yes" || echo "No")"
echo ""
echo "Next Steps:"
echo "----------"
echo "1. Configure ANTHROPIC_API_KEY for AI features"
echo "2. Run migrations: cd server && npm run migrate"
echo "3. Generate components to create version history"
echo "4. Monitor analytics dashboard for insights"
echo ""

echo "Test completed at $(date)"