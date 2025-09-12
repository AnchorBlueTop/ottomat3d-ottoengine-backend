#!/bin/bash
# Terminal Wrapper for OTTOMAT3D with Clean Loading
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
OTTOMAT3D_EXEC="$SCRIPT_DIR/OTTOMAT3D_actual"

osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "clear && echo '🚀 OTTOMAT3D macOS - Please wait, loading...' && echo 'Initializing Python runtime (this may take 10-15 seconds)...' && echo '' && cd '$SCRIPT_DIR' && '$OTTOMAT3D_EXEC' && echo '' && echo 'OTTOMAT3D finished. You can close this window.' && read -p 'Press ENTER to close...'"
end tell
APPLESCRIPT