#!/bin/bash

# Create a simple 1024x1024 icon with ImageMagick or sips (macOS built-in)
# Using sips since it's available on macOS by default

# Create icon.png (1024x1024)
sips -z 1024 1024 -s format png /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/AlertNoteIcon.icns --out assets/images/icon.png 2>/dev/null

# If sips fails, create a simple colored square
if [ ! -f assets/images/icon.png ]; then
  # Create using Python PIL if available
  python3 << 'PYTHON'
from PIL import Image, ImageDraw, ImageFont
import os

# Create icon (1024x1024)
icon = Image.new('RGB', (1024, 1024), color='#4A90E2')
draw = ImageDraw.Draw(icon)

# Draw a simple design
draw.ellipse([256, 256, 768, 768], fill='#FFFFFF', outline='#2E5C8A', width=20)
draw.ellipse([412, 412, 612, 612], fill='#4A90E2')

os.makedirs('assets/images', exist_ok=True)
icon.save('assets/images/icon.png')

# Create splash (1284x2778 for iPhone)
splash = Image.new('RGB', (1284, 2778), color='#FFFFFF')
draw = ImageDraw.Draw(splash)

# Center circle
center_x, center_y = 642, 1389
radius = 200
draw.ellipse([center_x-radius, center_y-radius, center_x+radius, center_y+radius], 
             fill='#4A90E2', outline='#2E5C8A', width=10)

splash.save('assets/images/splash-icon.png')
print("Icons created successfully!")
PYTHON
fi
