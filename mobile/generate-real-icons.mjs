import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve('assets');
const CLIENT_PUBLIC_DIR = path.resolve('../client/public');

// 1. Full 1024x1024 App Icon (black squircle with FD)
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="260" fill="#000000" />
  <rect x="8" y="8" width="1008" height="1008" rx="252" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="16" />
  <text x="512" y="550" dominant-baseline="central" text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="430" font-weight="900" letter-spacing="-10">
    <tspan fill="#F07B2A" dx="-4">F</tspan><tspan fill="#FFFFFF" dx="12">D</tspan>
  </text>
</svg>
`;

// 2. Android Adaptive Icon Foreground (1024x1024 transparent, content in 66% safe zone diameter ~660px)
const androidForegroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Centered squircle inside the safe zone (diameter 660px) -->
  <rect x="232" y="232" width="560" height="560" rx="140" fill="#000000" />
  <rect x="236" y="236" width="552" height="552" rx="136" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="8" />
  <text x="512" y="534" dominant-baseline="central" text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="240" font-weight="900" letter-spacing="-6">
    <tspan fill="#F07B2A" dx="-3">F</tspan><tspan fill="#FFFFFF" dx="8">D</tspan>
  </text>
</svg>
`;

// 3. Android Adaptive Icon Background (1024x1024 solid black #000000)
const androidBackgroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#000000" />
</svg>
`;

// 4. Android Adaptive Icon Monochrome (1024x1024 transparent, white silhouette for Android 13 themed icons)
const androidMonochromeSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="232" y="232" width="560" height="560" rx="140" fill="#FFFFFF" />
  <text x="512" y="534" dominant-baseline="central" text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="240" font-weight="900" letter-spacing="-6">
    <tspan fill="#000000" dx="-3">F</tspan><tspan fill="#000000" dx="8">D</tspan>
  </text>
</svg>
`;

// 5. Splash Screen Icon (1024x1024 centered black squircle with FD on transparent)
const splashSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect x="282" y="282" width="460" height="460" rx="115" fill="#000000" />
  <rect x="286" y="286" width="452" height="452" rx="111" fill="none" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="8" />
  <text x="512" y="530" dominant-baseline="central" text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="200" font-weight="900" letter-spacing="-5">
    <tspan fill="#F07B2A" dx="-2">F</tspan><tspan fill="#FFFFFF" dx="6">D</tspan>
  </text>
</svg>
`;

// 6. Favicon (48x48 for crisp browser tabs and bookmarks)
const faviconSvg = `
<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="12" fill="#000000" />
  <text x="24" y="27" dominant-baseline="central" text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="-1">
    <tspan fill="#F07B2A" dx="-1">F</tspan><tspan fill="#FFFFFF" dx="1">D</tspan>
  </text>
</svg>
`;

// 7. Web client favicon.svg
const webFaviconSvg = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#000000" />
  <text x="16" y="18" dominant-baseline="central" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14.5" font-weight="900" letter-spacing="-0.5">
    <tspan fill="#F07B2A">F</tspan><tspan fill="#FFFFFF">D</tspan>
  </text>
</svg>
`;

async function generateAll() {
  console.log('Generating mobile icon assets...');

  // icon.png
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('Generated mobile/assets/icon.png (1024x1024)');

  // android-icon-foreground.png
  await sharp(Buffer.from(androidForegroundSvg)).png().toFile(path.join(ASSETS_DIR, 'android-icon-foreground.png'));
  console.log('Generated mobile/assets/android-icon-foreground.png (1024x1024)');

  // android-icon-background.png
  await sharp(Buffer.from(androidBackgroundSvg)).png().toFile(path.join(ASSETS_DIR, 'android-icon-background.png'));
  console.log('Generated mobile/assets/android-icon-background.png (1024x1024)');

  // android-icon-monochrome.png
  await sharp(Buffer.from(androidMonochromeSvg)).png().toFile(path.join(ASSETS_DIR, 'android-icon-monochrome.png'));
  console.log('Generated mobile/assets/android-icon-monochrome.png (1024x1024)');

  // splash-icon.png
  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
  console.log('Generated mobile/assets/splash-icon.png (1024x1024)');

  // favicon.png (48x48)
  const favPngBuffer = await sharp(Buffer.from(faviconSvg)).png().toBuffer();
  fs.writeFileSync(path.join(ASSETS_DIR, 'favicon.png'), favPngBuffer);
  console.log('Generated mobile/assets/favicon.png (48x48)');

  // public/ folder for Expo Web static serving
  const PUBLIC_DIR = path.resolve('public');
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.png'), favPngBuffer);

  try {
    const { generateFaviconAsync } = await import('@expo/image-utils');
    const icoBuffer = await generateFaviconAsync(favPngBuffer, [16, 32, 48]);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
    console.log('Generated mobile/public/favicon.ico');
  } catch (icoErr) {
    console.warn('Could not generate multi-size ICO:', icoErr.message);
  }

  // Also write client/public/favicon.svg
  fs.writeFileSync(path.join(CLIENT_PUBLIC_DIR, 'favicon.svg'), webFaviconSvg.trim() + '\n', 'utf8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), webFaviconSvg.trim() + '\n', 'utf8');
  console.log('Updated client/public/favicon.svg and mobile/public/favicon.svg');
}

generateAll().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
