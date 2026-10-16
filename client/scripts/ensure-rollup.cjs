// client/scripts/ensure-rollup.cjs
// Ensures Linux native binaries for Rollup and esbuild are installed before building on Linux x64 hosts (e.g. Render).
// Resolves npm bug #4828: https://github.com/npm/cli/issues/4828

const { execSync } = require('child_process');

if (process.platform === 'linux' && process.arch === 'x64') {
  // 1. Ensure @rollup/rollup-linux-x64-gnu
  let rollupOk = false;
  try {
    require.resolve('@rollup/rollup-linux-x64-gnu');
    rollupOk = true;
  } catch (err) {
    rollupOk = false;
  }

  if (rollupOk) {
    console.log('✅ [prebuild] @rollup/rollup-linux-x64-gnu is already installed and verified.');
  } else {
    let rollupVersion = '4.64.3';
    try {
      const rollupPkg = require('rollup/package.json');
      if (rollupPkg && rollupPkg.version) {
        rollupVersion = rollupPkg.version;
      }
    } catch (e) {}

    console.log(`⚠️ [prebuild] Linux x64 detected but @rollup/rollup-linux-x64-gnu is missing.`);
    console.log(`📦 [prebuild] Installing @rollup/rollup-linux-x64-gnu@${rollupVersion}...`);
    try {
      execSync(`npm install --no-save @rollup/rollup-linux-x64-gnu@${rollupVersion}`, {
        stdio: 'inherit',
      });
      console.log('✅ [prebuild] Successfully installed @rollup/rollup-linux-x64-gnu.');
    } catch (installErr) {
      console.error('❌ [prebuild] Failed to install @rollup/rollup-linux-x64-gnu:', installErr.message);
    }
  }

  // 2. Ensure @esbuild/linux-x64
  let esbuildOk = false;
  try {
    require.resolve('@esbuild/linux-x64');
    esbuildOk = true;
  } catch (err) {
    esbuildOk = false;
  }

  if (esbuildOk) {
    console.log('✅ [prebuild] @esbuild/linux-x64 is already installed and verified.');
  } else {
    let esbuildVersion = '0.25.12';
    try {
      const esbuildPkg = require('esbuild/package.json');
      if (esbuildPkg && esbuildPkg.version) {
        esbuildVersion = esbuildPkg.version;
      }
    } catch (e) {}

    console.log(`⚠️ [prebuild] Linux x64 detected but @esbuild/linux-x64 is missing.`);
    console.log(`📦 [prebuild] Installing @esbuild/linux-x64@${esbuildVersion}...`);
    try {
      execSync(`npm install --no-save @esbuild/linux-x64@${esbuildVersion}`, {
        stdio: 'inherit',
      });
      console.log('✅ [prebuild] Successfully installed @esbuild/linux-x64.');
    } catch (installErr) {
      console.error('❌ [prebuild] Failed to install @esbuild/linux-x64:', installErr.message);
    }
  }
} else {
  // Non-Linux or non-x64 platforms (e.g. Windows development machines) do not need Linux binaries.
}
