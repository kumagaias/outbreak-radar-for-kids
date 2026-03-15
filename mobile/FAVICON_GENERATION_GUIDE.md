# Favicon Generation Guide

## Method 1: Browser-based Generation (Recommended)

1. Open `mobile/create-favicon-png.html` in your browser
2. You'll see two previews (32x32 and 64x64)
3. Click "Download favicon.png (32x32)" button
4. Save the downloaded file as `favicon.png`
5. Move `favicon.png` to `mobile/assets/images/` directory

## Method 2: Using Node.js (Alternative)

If you prefer to use Node.js with the sharp library:

```bash
cd mobile
npm install sharp
node generate-favicon.js
```

This will generate `mobile/assets/images/favicon.png` automatically.

## Verification

After generating the favicon:

1. Check that `mobile/assets/images/favicon.png` exists
2. Run `npx expo export --platform web` to rebuild
3. Check the browser tab to see the new favicon

## Current Status

- ✅ SVG designs created (`favicon.svg`, `favicon-simple.svg`)
- ✅ HTML generation tool created (`create-favicon-png.html`)
- ✅ Node.js generation script created (`generate-favicon.js`)
- ⏳ PNG file needs to be generated
- ⏳ Changes need to be committed (waiting for user approval)

## Design

The favicon features:
- Blue gradient shield (protection theme)
- Radar waves (outbreak monitoring)
- White medical cross (healthcare)
- Yellow pulse dot (active monitoring)
