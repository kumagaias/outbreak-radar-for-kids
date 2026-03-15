#!/bin/bash

# Setup script for Git hooks
# This script copies hook scripts from scripts/hooks/ to .git/hooks/

set -e

echo "🔧 Setting up Git hooks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a Git repository root directory"
  exit 1
fi

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
  echo "⚠️  Warning: gitleaks is not installed"
  echo "   Install it with: brew install gitleaks (macOS)"
  echo "   Or visit: https://github.com/gitleaks/gitleaks#installing"
  echo ""
  read -p "Continue without gitleaks? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Copy pre-commit hook
echo "📝 Installing pre-commit hook..."
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "✅ pre-commit hook installed"

# Copy pre-push hook
echo "📝 Installing pre-push hook..."
cp scripts/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
echo "✅ pre-push hook installed"

echo ""
echo "🎉 Git hooks setup complete!"
echo ""
echo "Installed hooks:"
echo "  - pre-commit: Runs backend tests and secret scanning"
echo "  - pre-push: Runs all tests, security checks, and secret scanning"
echo ""
echo "To bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo "For more information, see: docs/HOOKS.md"
