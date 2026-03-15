/**
 * Generate favicon.png from favicon.svg
 * 
 * This script converts the SVG favicon to PNG format for web compatibility.
 * 
 * Usage:
 *   node generate-favicon.js
 * 
 * Requirements:
 *   npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Read SVG file
const svgPath = path.join(__dirname, 'assets', 'images', 'favicon.svg');
const pngPath = path.join(__dirname, 'assets', 'images', 'favicon.png');

const svgContent = fs.readFileSync(svgPath, 'utf8');

// For now, just copy the SVG as-is
// In production, you would use a library like 'sharp' to convert SVG to PNG
console.log('SVG favicon created at:', svgPath);
console.log('To generate PNG, install sharp: npm install sharp');
console.log('Then use sharp to convert SVG to PNG');

// Simple PNG generation using sharp (if installed)
try {
  const sharp = require('sharp');
  
  sharp(svgPath)
    .resize(64, 64)
    .png()
    .toFile(pngPath)
    .then(() => {
      console.log('✅ PNG favicon generated at:', pngPath);
    })
    .catch(err => {
      console.error('Error generating PNG:', err);
      console.log('💡 Tip: Install sharp with: npm install sharp');
    });
} catch (err) {
  console.log('ℹ️  Sharp not installed. SVG favicon will be used.');
  console.log('   To generate PNG, run: npm install sharp && node generate-favicon.js');
}
