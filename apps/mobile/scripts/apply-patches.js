#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patchesDir = path.join(__dirname, '..', 'patches');
const projectRoot = path.join(__dirname, '..');

if (!fs.existsSync(patchesDir)) {
  console.log('No patches directory found, skipping patch application');
  process.exit(0);
}

const patches = fs.readdirSync(patchesDir).filter(file => file.endsWith('.patch'));

if (patches.length === 0) {
  console.log('No patches found, skipping patch application');
  process.exit(0);
}

console.log(`Found ${patches.length} patch(es) to apply`);

patches.forEach(patchFile => {
  const patchPath = path.join(patchesDir, patchFile);
  console.log(`Applying patch: ${patchFile}`);
  
  // Check if the file to be patched exists
  const targetFile = path.join(projectRoot, 'node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt');
  
  if (!fs.existsSync(targetFile)) {
    console.log(`Target file not found, skipping patch: ${patchFile}`);
    return;
  }
  
  // Check if patch is already applied
  const fileContent = fs.readFileSync(targetFile, 'utf8');
  if (fileContent.includes('requestedPermissions?.contains(permission) ?: false')) {
    console.log(`Patch already applied: ${patchFile}`);
    return;
  }
  
  try {
    // Apply the patch using patch command with the correct strip level
    execSync(`patch -p1 < "${patchPath}"`, { 
      cwd: projectRoot,
      stdio: 'inherit'
    });
    console.log(`Successfully applied patch: ${patchFile}`);
  } catch (error) {
    console.error(`Failed to apply patch: ${patchFile}`);
    console.error('Error:', error.message);
    console.error('This patch is required for Android SDK 35 compatibility');
  }
});

console.log('Patch application complete');