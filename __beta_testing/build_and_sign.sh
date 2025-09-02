#!/bin/bash

# OTTOMAT3D Complete Build & Sign Script
# Builds with PyInstaller, applies fixes, and signs in one go
# Usage: ./build_and_sign.sh [architecture]
# Example: ./build_and_sign.sh x86_64
# Example: ./build_and_sign.sh arm64

set -e  # Exit on any error

# Configuration
DEVELOPER_ID="Developer ID Application: Harshil Patel (VG4BA3XSGG)"
DEFAULT_ARCH="x86_64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_build() {
    echo -e "${PURPLE}🔨 $1${NC}"
}

print_header() {
    echo ""
    echo "======================================================="
    echo "🏗️  OTTOMAT3D Complete Build & Sign Script"
    echo "======================================================="
    echo ""
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "terminal_wrapper.sh" ]]; then
        log_error "terminal_wrapper.sh not found. Make sure you're in the project root directory."
        exit 1
    fi
    
    # Check if spec file exists
    local spec_file="OTTOMAT3D-${1}.spec"
    if [[ ! -f "$spec_file" ]]; then
        log_error "Spec file not found: $spec_file"
        exit 1
    fi
    
    # Check if PyInstaller is available
    if ! command -v pyinstaller &> /dev/null; then
        log_error "PyInstaller not found. Make sure it's installed: pip install pyinstaller"
        exit 1
    fi
    
    # Check if codesign is available
    if ! command -v codesign &> /dev/null; then
        log_error "codesign command not found. Are you on macOS?"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

clean_previous_build() {
    log_info "Cleaning previous build artifacts..."
    
    # Remove build and dist directories
    rm -rf build/ 2>/dev/null || true
    rm -rf dist/ 2>/dev/null || true
    
    # Remove config file and logs directory to clean development artifacts
    log_info "Removing development artifacts (config.txt and logs)..."
    rm -f config.txt 2>/dev/null || true
    rm -rf src/logs/ 2>/dev/null || true
    
    # Also clean any config files that might be in other locations
    find . -name "config.txt" -not -path "./build/*" -not -path "./dist/*" -delete 2>/dev/null || true
    find . -name "*.log" -not -path "./build/*" -not -path "./dist/*" -delete 2>/dev/null || true
    find . -type d -name "logs" -not -path "./build" -not -path "./dist" -exec rm -rf {} + 2>/dev/null || true
    
    # Force a small delay to ensure file system operations complete
    sleep 1
    
    log_success "Build artifacts and development files cleaned"
}

prepare_cross_arch_packages() {
    local arch="$1"
    local site_packages="/Users/harshilpatel/Desktop/Projects/MCP/ottostudio/ottomat3d-beta-test/src/_internal/python-3.13-mac/lib/python3.13/site-packages"
    
    if [[ "$arch" == "x86_64" ]]; then
        log_info "Preparing packages for x86_64 cross-compilation..."
        
        # Create backup directory
        mkdir -p "$site_packages/.arch_backup"
        
        # List of architecture-specific packages that need replacement
        local arch_packages=("websockets" "PIL" "pillow")
        
        # Move architecture-specific packages to backup (more comprehensive)
        log_info "Backing up ARM64 packages and metadata..."
        for package in "${arch_packages[@]}"; do
            # Backup main package directory
            if [[ -d "$site_packages/$package" ]]; then
                log_info "  Backing up: $package"
                mv "$site_packages/$package" "$site_packages/.arch_backup/" 2>/dev/null || true
            fi
            
            # Backup associated .dist-info directories (more comprehensive pattern)
            for dist_info in "$site_packages/"${package}*".dist-info"; do
                if [[ -d "$dist_info" ]]; then
                    local basename=$(basename "$dist_info")
                    log_info "  Backing up metadata: $basename"
                    mv "$dist_info" "$site_packages/.arch_backup/" 2>/dev/null || true
                fi
            done
            
            # Also handle Pillow's special case (PIL vs pillow naming)
            if [[ "$package" == "pillow" ]]; then
                for pillow_dist in "$site_packages/Pillow-"*.dist-info; do
                    if [[ -d "$pillow_dist" ]]; then
                        local basename=$(basename "$pillow_dist")
                        log_info "  Backing up Pillow metadata: $basename"
                        mv "$pillow_dist" "$site_packages/.arch_backup/" 2>/dev/null || true
                    fi
                done
            fi
        done
        
        # Create temporary directory for x86_64 packages
        local temp_packages=$(mktemp -d)
        log_info "Using temporary directory: $temp_packages"
        
        # Get current versions from backup to match them
        local pillow_version=""
        local websockets_version=""
        
        # Extract versions from backup directory names
        if ls "$site_packages/.arch_backup/pillow-"*.dist-info >/dev/null 2>&1; then
            for dist_info in "$site_packages/.arch_backup/pillow-"*.dist-info; do
                if [[ -d "$dist_info" ]]; then
                    pillow_version=$(basename "$dist_info" | sed 's/pillow-\(.*\)\.dist-info/\1/')
                    log_info "  Found Pillow version: $pillow_version"
                    break
                fi
            done
        fi
        
        if ls "$site_packages/.arch_backup/websockets-"*.dist-info >/dev/null 2>&1; then
            for dist_info in "$site_packages/.arch_backup/websockets-"*.dist-info; do
                if [[ -d "$dist_info" ]]; then
                    websockets_version=$(basename "$dist_info" | sed 's/websockets-\(.*\)\.dist-info/\1/')
                    log_info "  Found websockets version: $websockets_version"
                    break
                fi
            done
        fi
        
        # Install x86_64 compatible versions to temp directory first
        log_info "Downloading x86_64 compatible packages..."
        local pip_packages=()
        
        # Add packages with versions if we found them
        if [[ -n "$pillow_version" ]]; then
            pip_packages+=("pillow==$pillow_version")
        else
            pip_packages+=("pillow")
        fi
        
        if [[ -n "$websockets_version" ]]; then
            pip_packages+=("websockets==$websockets_version")
        else
            pip_packages+=("websockets")
        fi
        
        log_info "Installing: ${pip_packages[*]}"
        
        # Try multiple platform specifications for better compatibility
        local platforms=("macosx_10_9_x86_64" "macosx_11_0_x86_64" "any")
        local install_success=false
        
        for platform in "${platforms[@]}"; do
            log_info "Trying platform: $platform"
            if pip install --target "$temp_packages" --platform "$platform" --only-binary=:all: --no-deps "${pip_packages[@]}" 2>/dev/null; then
                install_success=true
                log_success "Successfully downloaded packages for platform: $platform"
                break
            else
                log_warning "Failed to download for platform: $platform"
            fi
        done
        
        if [[ "$install_success" == true ]]; then
            log_success "x86_64 packages downloaded successfully"
            
            # Verify the downloaded packages contain x86_64 binaries
            log_info "Verifying x86_64 compatibility..."
            local verification_failed=false
            
            # Check for .so files and verify they're x86_64
            while IFS= read -r -d '' so_file; do
                if file "$so_file" | grep -q "arm64\|aarch64"; then
                    log_error "Found ARM64 binary in downloaded package: $(basename "$so_file")"
                    verification_failed=true
                elif file "$so_file" | grep -q "x86_64"; then
                    log_info "  ✅ Verified x86_64: $(basename "$so_file")"
                else
                    log_warning "  ⚠️  Could not verify architecture: $(basename "$so_file")"
                fi
            done < <(find "$temp_packages" -name "*.so" -print0 2>/dev/null)
            
            if [[ "$verification_failed" == true ]]; then
                log_error "Package verification failed - ARM64 binaries found in supposedly x86_64 packages"
                rm -rf "$temp_packages"
                exit 1
            fi
            
            # Move verified packages to site-packages
            log_info "Installing verified x86_64 packages..."
            cp -r "$temp_packages/"* "$site_packages/"
            rm -rf "$temp_packages"
            
            log_success "x86_64 packages installed and verified"
            
            # Verify that bambulabs_api (the critical one) is still there and unmodified
            log_info "Verifying modified bambulabs_api is preserved..."
            if [[ -d "$site_packages/bambulabs_api" ]]; then
                # Check if it has our MQTT fixes by looking for disconnect method in mqtt_client.py
                local mqtt_client_file="$site_packages/bambulabs_api/mqtt_client.py"
                if [[ -f "$mqtt_client_file" ]] && grep -q "def disconnect" "$mqtt_client_file"; then
                    log_success "✅ Modified bambulabs_api with MQTT fixes preserved!"
                else
                    log_warning "⚠️  bambulabs_api exists but may not have MQTT fixes"
                fi
            else
                log_error "❌ Modified bambulabs_api was lost during package replacement!"
                exit 1
            fi
        else
            log_error "Failed to download x86_64 packages with any platform specification"
            rm -rf "$temp_packages"
            exit 1
        fi
    fi
}

restore_packages() {
    local site_packages="/Users/harshilpatel/Desktop/Projects/MCP/ottostudio/ottomat3d-beta-test/src/_internal/python-3.13-mac/lib/python3.13/site-packages"
    
    log_info "Restoring original ARM64 packages..."
    
    if [[ -d "$site_packages/.arch_backup" ]]; then
        # List of packages that were backed up
        local arch_packages=("websockets" "PIL" "pillow")
        
        # Remove downloaded x86_64 packages and their metadata
        log_info "Removing x86_64 packages..."
        for package in "${arch_packages[@]}"; do
            if [[ -d "$site_packages/$package" ]]; then
                log_info "  Removing x86_64: $package"
                rm -rf "$site_packages/$package" 2>/dev/null || true
            fi
            
            # Remove x86_64 .dist-info directories
            for dist_info in "$site_packages/"${package}*".dist-info"; do
                if [[ -d "$dist_info" ]]; then
                    local basename=$(basename "$dist_info")
                    log_info "  Removing x86_64 metadata: $basename"
                    rm -rf "$dist_info" 2>/dev/null || true
                fi
            done
            
            # Handle Pillow's special case
            if [[ "$package" == "pillow" ]]; then
                for pillow_dist in "$site_packages/Pillow-"*.dist-info; do
                    if [[ -d "$pillow_dist" ]]; then
                        local basename=$(basename "$pillow_dist")
                        log_info "  Removing x86_64 Pillow metadata: $basename"
                        rm -rf "$pillow_dist" 2>/dev/null || true
                    fi
                done
            fi
        done
        
        # Restore original ARM64 packages
        log_info "Restoring original ARM64 packages..."
        if ls "$site_packages/.arch_backup/"* >/dev/null 2>&1; then
            mv "$site_packages/.arch_backup/"* "$site_packages/" 2>/dev/null || true
            log_success "Original ARM64 packages restored"
        else
            log_warning "No backup files found to restore"
        fi
        
        # Clean up backup directory
        rmdir "$site_packages/.arch_backup" 2>/dev/null || true
        
        # Verify that bambulabs_api (the important one) is still there
        if [[ -d "$site_packages/bambulabs_api" ]]; then
            log_success "✅ Modified bambulabs_api preserved successfully"
        else
            log_error "❌ Modified bambulabs_api was lost during package restoration!"
        fi
    else
        log_info "No backup directory found - nothing to restore"
    fi
}

run_pyinstaller() {
    local arch="$1"
    local spec_file="OTTOMAT3D-${arch}.spec"
    
    log_build "Building OTTOMAT3D with PyInstaller..."
    log_info "Architecture: $arch"
    log_info "Spec file: $spec_file"
    log_info "Using local site-packages with modified bambulabs_api"
    log_info "Site-packages path: /Users/harshilpatel/Desktop/Projects/MCP/ottostudio/ottomat3d-beta-test/src/_internal/python-3.13-mac/lib/python3.13/site-packages"
    
    # Run PyInstaller - all asyncio imports are configured in the .spec file
    pyinstaller --clean --noconfirm "$spec_file"
    
    log_success "PyInstaller build completed with comprehensive asyncio imports"
}

apply_terminal_wrapper_fix() {
    local app_path="$1"
    local macos_dir="$app_path/Contents/MacOS"
    
    log_info "Applying terminal wrapper fix..."
    
    # Check if app exists
    if [[ ! -d "$app_path" ]]; then
        log_error "App not found: $app_path"
        exit 1
    fi
    
    # Copy the improved terminal wrapper
    log_info "Copying improved terminal wrapper..."
    cp terminal_wrapper.sh "$macos_dir/"
    
    # Create the main executable wrapper
    log_info "Creating main executable wrapper..."
    cat > "$macos_dir/OTTOMAT3D" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
exec "$SCRIPT_DIR/terminal_wrapper.sh"
EOF
    
    # Set executable permissions
    log_info "Setting executable permissions..."
    chmod +x "$macos_dir/OTTOMAT3D"
    chmod +x "$macos_dir/terminal_wrapper.sh"
    chmod +x "$macos_dir/OTTOMAT3D_actual"
    
    # Clean any bundled development files from the app
    log_info "Removing any bundled development artifacts..."
    # Check common locations where PyInstaller might bundle files
    find "$app_path" -name "config.txt" -delete 2>/dev/null || true
    find "$app_path" -name "*.log" -delete 2>/dev/null || true
    find "$app_path" -type d -name "logs" -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Terminal wrapper fix applied and development files cleaned"
}

sign_app_components() {
    local app_path="$1"
    local macos_dir="$app_path/Contents/MacOS"
    
    log_info "Signing app components..."
    
    # Remove any extended attributes that might cause issues
    log_info "Removing extended attributes..."
    xattr -cr "$app_path" 2>/dev/null || true
    
    # Sign individual executables first
    log_info "Signing terminal_wrapper.sh..."
    codesign --force --options runtime --sign "$DEVELOPER_ID" \
        "$macos_dir/terminal_wrapper.sh"
    
    log_info "Signing main executable wrapper..."
    codesign --force --options runtime --sign "$DEVELOPER_ID" \
        "$macos_dir/OTTOMAT3D"
    
    log_info "Signing Python executable..."
    codesign --force --options runtime --sign "$DEVELOPER_ID" \
        "$macos_dir/OTTOMAT3D_actual"
    
    # Sign the entire app bundle
    log_info "Signing entire app bundle..."
    codesign --force --deep --options runtime --sign "$DEVELOPER_ID" \
        "$app_path"
    
    log_success "App signing completed"
}

verify_signing() {
    local app_path="$1"
    
    log_info "Verifying app signature..."
    
    if codesign --verify --verbose "$app_path" 2>&1; then
        log_success "App signature verification passed"
        return 0
    else
        log_error "App signature verification failed"
        return 1
    fi
}

test_app_launch() {
    local app_path="$1"
    
    log_info "Testing app launch..."
    log_warning "The app will open in Terminal. Close it after verifying the loading message works."
    
    # Give user a moment to read the message
    sleep 3
    
    # Launch the app
    open "$app_path"
    
    log_success "App launched successfully"
    
    # Wait for user confirmation
    echo ""
    read -p "Press ENTER after you've verified the app works correctly..."
}

create_distribution_package() {
    local app_path="$1"
    local app_name=$(basename "$app_path" .app)
    local timestamp=$(date +"%Y%m%d-%H%M")
    local zip_name="${app_name}-${timestamp}.zip"
    
    log_info "Creating distribution package..."
    
    cd dist/
    zip -r "$zip_name" "$(basename "$app_path")" > /dev/null
    cd ..
    
    log_success "Distribution package created: dist/$zip_name"
    echo "$zip_name"  # Return the zip name for the summary
}

print_summary() {
    local app_path="$1"
    local zip_name="$2"
    local arch="$3"
    
    echo ""
    echo "======================================================="
    echo "🎉 BUILD & SIGN COMPLETED SUCCESSFULLY!"
    echo "======================================================="
    echo ""
    echo "✅ PyInstaller build completed"
    echo "✅ Terminal wrapper applied with improved loading message"
    echo "✅ File permissions set"
    echo "✅ App components signed"
    echo "✅ Signature verified"
    echo "✅ App tested"
    echo "✅ Distribution package created"
    echo ""
    echo "📋 Build Details:"
    echo "   Architecture: $arch"
    echo "   App: $app_path"
    echo "   Package: dist/$zip_name"
    echo ""
    echo "🚀 Your app is ready for distribution!"
    echo "   Users will see the clean loading message you requested."
    echo ""
}

# Main execution
main() {
    print_header
    
    # Get architecture from command line or use default
    local arch="${1:-$DEFAULT_ARCH}"
    local app_name="OTTOMAT3D-${arch}.app"
    local app_path="dist/$app_name"
    
    log_info "Building architecture: $arch"
    log_info "Target app: $app_path"
    
    # Set up error handling to ensure cleanup
    trap 'restore_packages; exit 1' ERR
    
    # Run all steps
    check_prerequisites "$arch"
    clean_previous_build
    prepare_cross_arch_packages "$arch"
    run_pyinstaller "$arch"
    
    # Always restore packages after build (success or failure)
    restore_packages
    
    apply_terminal_wrapper_fix "$app_path"
    sign_app_components "$app_path"
    
    if verify_signing "$app_path"; then
        test_app_launch "$app_path"
        zip_name=$(create_distribution_package "$app_path")
        print_summary "$app_path" "$zip_name" "$arch"
    else
        log_error "Signing verification failed. Please check your Developer ID certificate."
        exit 1
    fi
}

# Run main function with all arguments
main "$@"