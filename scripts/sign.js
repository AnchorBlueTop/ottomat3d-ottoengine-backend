#!/usr/bin/env node

/**
 * Code Signing Script for OttoStudio Electron App
 * Signs the packaged app with Developer ID certificate
 * Based on the signing process from the beta script
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
// TODO: Set your Developer ID certificate identity here
const DEVELOPER_ID = 'YOUR_DEVELOPER_ID_HERE';
const APP_PATH = path.join(__dirname, '../out/OttoStudio-darwin-arm64/OttoStudio.app');
const ENTITLEMENTS_PATH = path.join(__dirname, 'entitlements.plist');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
};

function log(message, color = colors.blue) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printHeader() {
  console.log('\n=======================================================');
  console.log('🔐 OttoStudio Code Signing Script');
  console.log('=======================================================\n');
}

function checkPrerequisites() {
  log('Checking prerequisites...');

  // Check if app exists
  if (!fs.existsSync(APP_PATH)) {
    logError(`App not found: ${APP_PATH}`);
    logWarning('Run "npm run package" first to create the app bundle');
    process.exit(1);
  }

  // Check if codesign is available
  try {
    execSync('which codesign', { stdio: 'ignore' });
  } catch (error) {
    logError('codesign command not found. Are you on macOS?');
    process.exit(1);
  }

  // Check if the certificate is available
  try {
    execSync(`security find-identity -v -p codesigning | grep -q "${DEVELOPER_ID}"`, {
      stdio: 'ignore',
      shell: '/bin/bash',
    });
  } catch (error) {
    logError(`Certificate not found: ${DEVELOPER_ID}`);
    logWarning('Make sure your Developer ID certificate is installed in Keychain');
    process.exit(1);
  }

  logSuccess('Prerequisites check passed');
}

function removeExtendedAttributes() {
  log('Removing extended attributes...');
  try {
    execSync(`xattr -cr "${APP_PATH}"`, { stdio: 'inherit' });
    logSuccess('Extended attributes removed');
  } catch (error) {
    logWarning('Failed to remove extended attributes (this might be okay)');
  }
}

function signDylibs() {
  log('Signing dynamic libraries (.dylib files)...');

  const frameworksPath = path.join(APP_PATH, 'Contents/Frameworks');

  if (!fs.existsSync(frameworksPath)) {
    logWarning('Frameworks directory not found, skipping...');
    return;
  }

  try {
    // Find and sign all .dylib files recursively
    const dylibFiles = execSync(
      `find "${frameworksPath}" -name "*.dylib" -type f`,
      { encoding: 'utf8' }
    )
      .split('\n')
      .filter((f) => f.trim());

    if (dylibFiles.length > 0) {
      dylibFiles.forEach((dylibPath) => {
        const dylibName = path.basename(dylibPath);
        log(`  Signing ${dylibName}...`);
        try {
          execSync(`codesign --force --sign "${DEVELOPER_ID}" --entitlements "${ENTITLEMENTS_PATH}" "${dylibPath}"`, {
            stdio: 'pipe',
          });
        } catch (err) {
          logWarning(`  Could not sign ${dylibName}: ${err.message}`);
        }
      });
      logSuccess(`Signed ${dylibFiles.length} dylib files`);
    } else {
      log('  No dylib files found');
    }
  } catch (error) {
    logWarning(`Error finding dylib files: ${error.message}`);
  }
}

function signFrameworks() {
  log('Signing frameworks and helper apps...');

  const frameworksPath = path.join(APP_PATH, 'Contents/Frameworks');

  if (!fs.existsSync(frameworksPath)) {
    logWarning('Frameworks directory not found, skipping...');
    return;
  }

  try {
    // Sign all .framework bundles
    const frameworks = fs.readdirSync(frameworksPath).filter((f) => f.endsWith('.framework'));
    frameworks.forEach((framework) => {
      const frameworkPath = path.join(frameworksPath, framework);
      log(`  Signing ${framework}...`);
      execSync(`codesign --force --deep --options runtime --sign "${DEVELOPER_ID}" --entitlements "${ENTITLEMENTS_PATH}" "${frameworkPath}"`, {
        stdio: 'pipe',
      });
    });

    // Sign all helper apps
    const helpers = fs.readdirSync(frameworksPath).filter((f) => f.endsWith('.app'));
    helpers.forEach((helper) => {
      const helperPath = path.join(frameworksPath, helper);
      log(`  Signing ${helper}...`);
      execSync(`codesign --force --deep --options runtime --sign "${DEVELOPER_ID}" --entitlements "${ENTITLEMENTS_PATH}" "${helperPath}"`, {
        stdio: 'pipe',
      });
    });

    logSuccess('Frameworks and helpers signed');
  } catch (error) {
    logError(`Failed to sign frameworks: ${error.message}`);
    process.exit(1);
  }
}

function signMainExecutable() {
  log('Signing main executable...');

  const executablePath = path.join(APP_PATH, 'Contents/MacOS/Ottostudio');

  if (!fs.existsSync(executablePath)) {
    logError(`Main executable not found: ${executablePath}`);
    process.exit(1);
  }

  try {
    execSync(`codesign --force --options runtime --sign "${DEVELOPER_ID}" --entitlements "${ENTITLEMENTS_PATH}" "${executablePath}"`, {
      stdio: 'pipe',
    });
    logSuccess('Main executable signed');
  } catch (error) {
    logError(`Failed to sign main executable: ${error.message}`);
    process.exit(1);
  }
}

function signAppBundle() {
  log('Signing entire app bundle...');

  try {
    execSync(`codesign --force --deep --options runtime --sign "${DEVELOPER_ID}" --entitlements "${ENTITLEMENTS_PATH}" "${APP_PATH}"`, {
      stdio: 'pipe',
    });
    logSuccess('App bundle signed');
  } catch (error) {
    logError(`Failed to sign app bundle: ${error.message}`);
    process.exit(1);
  }
}

function verifySignature() {
  log('Verifying signature...');

  try {
    const output = execSync(`codesign --verify --verbose "${APP_PATH}"`, {
      encoding: 'utf8',
      stderr: 'pipe',
    });
    logSuccess('Signature verification passed');
    return true;
  } catch (error) {
    logError('Signature verification failed');
    logError(error.message);
    return false;
  }
}

function displaySignatureInfo() {
  log('Signature information:');
  try {
    const output = execSync(`codesign --display --verbose=2 "${APP_PATH}"`, {
      encoding: 'utf8',
      stderr: 'pipe',
    });
    console.log(output);
  } catch (error) {
    console.log(error.stderr || error.message);
  }
}

function printSummary() {
  console.log('\n=======================================================');
  console.log('🎉 CODE SIGNING COMPLETED SUCCESSFULLY!');
  console.log('=======================================================\n');
  console.log('✅ Extended attributes removed');
  console.log('✅ Dynamic libraries signed');
  console.log('✅ Frameworks signed');
  console.log('✅ Main executable signed');
  console.log('✅ App bundle signed');
  console.log('✅ Signature verified\n');
  console.log('📋 Details:');
  console.log(`   App: ${APP_PATH}`);
  console.log(`   Certificate: ${DEVELOPER_ID}\n`);
  console.log('🚀 Your app should now open with double-click!\n');
  console.log('💡 To test: open the .app file or run:');
  console.log(`   open "${APP_PATH}"\n`);
}

// Main execution
function main() {
  printHeader();

  try {
    checkPrerequisites();
    removeExtendedAttributes();
    signDylibs();
    signFrameworks();
    signMainExecutable();
    signAppBundle();

    if (verifySignature()) {
      displaySignatureInfo();
      printSummary();
    } else {
      logError('Signing verification failed. Please check your Developer ID certificate.');
      process.exit(1);
    }
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
