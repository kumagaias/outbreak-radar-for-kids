# Git Hooks

This project uses Git hooks to ensure code quality and security before commits and pushes.

## Available Hooks

### Pre-commit Hook

Runs automatically before every commit to ensure code quality.

**Checks:**
- Backend unit tests (90%+ coverage required)
- Secret scanning with gitleaks

**Location:** `.git/hooks/pre-commit`

### Pre-push Hook

Runs automatically before every push to prevent broken code from being pushed.

**Checks:**
- Unit tests (mobile + backend)
- Security checks (npm audit)
- Secret scanning with gitleaks

**Location:** `.git/hooks/pre-push`

## Setup

### Automatic Setup (Recommended)

Run the setup script to install all hooks:

```bash
./scripts/setup-hooks.sh
```

This will:
1. Copy hook scripts from `scripts/hooks/` to `.git/hooks/`
2. Make them executable
3. Verify gitleaks is installed

### Manual Setup

If you prefer to set up hooks manually:

```bash
# Copy pre-commit hook
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Copy pre-push hook
cp scripts/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Requirements

### Gitleaks

Gitleaks is required for secret scanning. Install it before using the hooks:

**macOS:**
```bash
brew install gitleaks
```

**Linux:**
```bash
# Download from GitHub releases
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**Windows:**
```bash
# Using Scoop
scoop install gitleaks
```

For other installation methods, see: https://github.com/gitleaks/gitleaks#installing

## Bypassing Hooks

In rare cases where you need to bypass hooks (not recommended):

```bash
# Skip pre-commit hook
git commit --no-verify -m "message"

# Skip pre-push hook
git push --no-verify
```

**Warning:** Only bypass hooks when absolutely necessary, as they protect code quality and security.

## Troubleshooting

### Hook not running

Check if the hook is executable:
```bash
ls -la .git/hooks/pre-commit
ls -la .git/hooks/pre-push
```

If not executable, run:
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push
```

### Gitleaks not found

Verify gitleaks is installed:
```bash
gitleaks version
```

If not installed, follow the installation instructions above.

### Tests failing

Run tests manually to see detailed output:
```bash
# Backend tests
cd backend && npm test

# Mobile tests
cd mobile && npm test

# All tests
make test-unit
```

### False positive in gitleaks

If gitleaks detects a false positive, you can add it to `.gitleaksignore`:

```bash
echo "path/to/file:line_number" >> .gitleaksignore
```

**Note:** Use this sparingly and only for confirmed false positives.

## Hook Behavior

### Pre-commit

- Runs backend tests only (faster feedback)
- Scans staged files for secrets
- Blocks commit if any check fails

### Pre-push

- Runs all tests (mobile + backend)
- Runs security audit (npm audit)
- Scans for secrets
- Blocks push if any check fails

## Customization

To modify hook behavior, edit the scripts in `scripts/hooks/` and run `./scripts/setup-hooks.sh` again.

## CI/CD Integration

These hooks mirror the checks run in CI/CD pipelines, ensuring local validation before pushing to remote.
