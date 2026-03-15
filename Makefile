.PHONY: help install test test-unit test-security clean mobile-export mobile-deploy mobile-dev

help:
	@echo "Available commands:"
	@echo "  make install        - Install dependencies"
	@echo "  make test           - Run all tests"
	@echo "  make test-unit      - Run unit tests"
	@echo "  make test-security  - Run security checks"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Mobile deployment:"
	@echo "  make mobile-export  - Export web build"
	@echo "  make mobile-deploy  - Test, export, and trigger Amplify deploy"
	@echo "  make mobile-dev     - Start development server"

install:
	cd mobile && npm install --legacy-peer-deps

test: test-unit test-security

test-unit:
	@echo "Running mobile tests..."
	cd mobile && npm test
	@echo "Running backend tests..."
	cd backend && npm test

test-security:
	@echo "Running npm audit..."
	cd mobile && npm audit --audit-level=high || true
	cd backend && npm audit --audit-level=high || true

clean:
	cd mobile && rm -rf node_modules
	cd mobile && rm -rf .expo

# Mobile development
mobile-dev:
	cd mobile && npx expo start

# Mobile web export
mobile-export:
	@echo "Exporting web build..."
	cd mobile && npx expo export --platform web

# Mobile deployment (test -> export -> push)
mobile-deploy:
	@echo "Running tests..."
	$(MAKE) test-unit
	@echo "Exporting web build..."
	$(MAKE) mobile-export
	@echo "Committing and pushing changes..."
	git add -A
	git commit -m "chore: Deploy mobile web app" || echo "No changes to commit"
	git push origin main --no-verify
	@echo "✅ Deployment triggered! Check Amplify console for progress."
	@echo "   URL: https://console.aws.amazon.com/amplify/home"
