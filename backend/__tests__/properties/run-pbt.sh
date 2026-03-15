#!/bin/bash
# PBT Test Runner Script
# Executes property-based tests in categories: Critical, Standard, Extended

set -e

echo "=========================================="
echo "Running Backend Property-Based Tests"
echo "=========================================="
echo ""

# Critical tests (run every commit, ~55s)
echo "📋 Running Critical Tests (~55s)..."
npm test -- __tests__/properties/critical.properties.test.js --silent
echo "✅ Critical tests passed"
echo ""

# Standard tests (run daily, ~30s)
echo "📋 Running Standard Tests (~30s)..."
npm test -- __tests__/properties/standard.properties.test.js --silent
echo "✅ Standard tests passed"
echo ""

# Extended tests (run pre-deploy, ~85s)
echo "📋 Running Extended Tests (~85s)..."
npm test -- __tests__/properties/extended.properties.test.js --silent
echo "✅ Extended tests passed"
echo ""

echo "=========================================="
echo "✅ All PBT tests passed!"
echo "=========================================="
