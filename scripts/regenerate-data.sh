#!/bin/bash
#
# Regenerate all processed data files for MedAdmit v2
#
# This script runs all Python processing scripts and updates the data manifest.
# Run from project root: ./scripts/regenerate-data.sh
#

set -e  # Exit on any error

echo "=========================================="
echo "MedAdmit Data Regeneration"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found"
    exit 1
fi

# Check required packages
python3 -c "import numpy, scipy, pandas" 2>/dev/null || {
    echo "Installing required Python packages..."
    pip install numpy scipy pandas --quiet
}

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"
echo ""

# Step 1: Process A-23
echo "Step 1: Processing AAMC Table A-23..."
python3 python/process_a23.py
echo ""

# Step 2: Process A-18
echo "Step 2: Processing AAMC Table A-18..."
python3 python/process_a18.py
echo ""

# Step 3: Enhance schools
echo "Step 3: Enhancing school data..."
python3 python/enhance_schools.py
echo ""

# Step 4: Update manifest timestamp
echo "Step 4: Updating data manifest..."
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Update generatedAt in manifest (simple sed replacement)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"generatedAt\": \"[^\"]*\"/\"generatedAt\": \"$TIMESTAMP\"/" data/model/data-manifest.json
else
    # Linux
    sed -i "s/\"generatedAt\": \"[^\"]*\"/\"generatedAt\": \"$TIMESTAMP\"/" data/model/data-manifest.json
fi
echo "  Manifest updated: $TIMESTAMP"
echo ""

# Step 5: Validate
echo "Step 5: Validating processed data..."
npx ts-node scripts/validate-data.ts

echo ""
echo "=========================================="
echo "Data regeneration complete!"
echo "=========================================="
