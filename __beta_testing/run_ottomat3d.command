#!/bin/bash
# ============================================================================
# OTTOMAT3D Master Automation Script - Double-Click to Run!
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and change into it
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Clear screen for clean start
clear

echo "============================================================================"
echo "🚀 OTTOMAT3D Master Automation Script"
echo "============================================================================"
echo

# --- MODIFIED SECTION START ---
# Define the full, absolute path to the Python executable and the main script
PYTHON_EXE="$SCRIPT_DIR/src/_internal/python-3.13-mac/bin/python3"
MAIN_SCRIPT_PATH="$SCRIPT_DIR/src/main.py"

# The following exports are generally not needed for a self-contained environment
# and have been removed to prevent potential conflicts.
# export PYTHONPATH
# export PYTHONHOME
export PYTHONDONTWRITEBYTECODE=1
export PYTHONIOENCODING=utf-8
# --- MODIFIED SECTION END ---

# Check if Python is available
if [ ! -f "$PYTHON_EXE" ]; then
    echo -e "${RED}❌ ERROR: Python not found at $PYTHON_EXE${NC}"
    echo "Please ensure the _internal directory is properly set up."
    echo
    read -p "Press Enter to exit..."
    exit 1
fi

echo -e "${GREEN}✅ Python found: $PYTHON_EXE${NC}"
echo

# Clean up old log files (keep last 7 days)
echo "🧹 Cleaning up old log files..."
if [ -d "src/logs" ]; then
    find src/logs -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
fi

# Run the main script
echo -e "${GREEN}🚀 Starting OTTOMAT3D Master Script...${NC}"
echo
echo "============================================================================"
echo

# --- MODIFIED SECTION START ---
# Use the full path to the main script for maximum reliability
"$PYTHON_EXE" "$MAIN_SCRIPT_PATH"
# --- MODIFIED SECTION END ---

# Check exit code and provide feedback
EXIT_CODE=$?
echo
echo "============================================================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Script completed successfully!${NC}"
else
    echo -e "${RED}❌ Script finished with errors (Exit code: $EXIT_CODE)${NC}"
    echo "Check the logs directory for detailed error information."
fi
echo "============================================================================"
echo
echo "💡 You can now close this terminal window."
read -p "Press Enter to exit..."