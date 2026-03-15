#!/bin/bash
set -e

# Build Lambda deployment package with production dependencies only
echo "Building Lambda deployment package..."

# Create temporary build directory
BUILD_DIR=$(mktemp -d)
echo "Using build directory: $BUILD_DIR"

# Copy source files
cp index.js "$BUILD_DIR/"
cp -r lib "$BUILD_DIR/"
cp package.json "$BUILD_DIR/"
cp package-lock.json "$BUILD_DIR/"

# Install production dependencies only
cd "$BUILD_DIR"
npm ci --production --silent

# Create ZIP file
cd "$BUILD_DIR"
zip -r lambda.zip . -x "*.git*" > /dev/null

# Move ZIP to infra module
mv lambda.zip ../infra/modules/aws/lambda/lambda_function.zip

echo "Lambda package created: infra/modules/aws/lambda/lambda_function.zip"
echo "Package size: $(du -h ../infra/modules/aws/lambda/lambda_function.zip | cut -f1)"

# Cleanup
cd ..
rm -rf "$BUILD_DIR"
