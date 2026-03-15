# Terraform Backend Bootstrap

This directory contains the bootstrap configuration to create the S3 bucket for Terraform state storage.

## Purpose

Solves the "chicken and egg" problem: Terraform needs an S3 bucket to store state, but we need Terraform to create the bucket.

## Usage

### 1. Deploy S3 Backend Infrastructure

```bash
cd infra/environments/dev/backend-bootstrap
terraform init
terraform plan
terraform apply
```

This creates:
- S3 bucket: `outbreak-radar-terraform-state-dev`
- Versioning enabled
- Server-side encryption (AES256)
- Public access blocked

### 2. Migrate Main Configuration to S3 Backend

After the S3 bucket is created, add backend configuration to `infra/environments/dev/main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket = "outbreak-radar-terraform-state-dev"
    key    = "dev/terraform.tfstate"
    region = "ap-northeast-1"
  }
}
```

Then migrate the state:

```bash
cd infra/environments/dev
terraform init -migrate-state
```

### 3. Clean Up Bootstrap

After migration is complete, the bootstrap directory can be removed or kept for reference.

## Notes

- S3 provides built-in state locking (no DynamoDB needed)
- State file is encrypted at rest with AES256
- Versioning allows state recovery if needed
- Bootstrap uses local state (one-time operation)
