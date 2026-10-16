// client/scripts/ensure-rollup.cjs
// Ensures the Linux native binary for Rollup is installed before building on Linux x64 hosts (e.g. Render).
// Resolves npm bug #4828: https://github.com/npm/cli/issues/4828

const { execSync } = require('child_process');

if (process.platform === 'linux' && process.arch === 'x64') {
  let isAvailable = false;
  try {
    require.resolve('@rollup/rollup-linux-x64-gnu');
    isAvailable = true;
  } catch (err) {
    isAvailable = false;
  }

  if (isAvailable) {
    console.log('✅ [prebuild] @rollup/rollup-linux-x64-gnu is already installed and verified.');
  } else {
    let rollupVersion = '4.64.3';
    try {
      const rollupPkg = require('rollup/package.json');
      if (rollupPkg && rollupPkg.version) {
        rollupVersion = rollupPkg.version;
      }
    } catch (e) {
      // fallback to known default
    }

    console.log(`⚠️ [prebuild] Linux x64 detected but @rollup/rollup-linux-x64-gnu is missing (npm bug #4828).`);
    console.log(`📦 [prebuild] Installing @rollup/rollup-linux-x64-gnu@${rollupVersion} directly...`);
    try {
      execSync(`npm install --no-save @rollup/rollup-linux-x64-gnu@${rollupVersion}`, {
        stdio: 'inherit',
      });
      console.log('✅ [prebuild] Successfully installed @rollup/rollup-linux-x64-gnu.');
    } catch (installErr) {
      console.error('❌ [prebuild] Failed to install @rollup/rollup-linux-x64-gnu:', installErr.message);
    }
  }
} else {
  // Non-Linux or non-x64 platforms (e.g. Windows development machines) do not need the Linux binary.
}
