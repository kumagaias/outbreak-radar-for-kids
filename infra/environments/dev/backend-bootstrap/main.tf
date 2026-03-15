terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      Environment = "dev"
      Project     = "outbreak-radar-for-kids"
      ManagedBy   = "terraform"
      Purpose     = "terraform-backend-bootstrap"
    }
  }
}

# Create S3 backend infrastructure
module "terraform_backend" {
  source = "../../../modules/aws/terraform-backend"

  environment = "dev"
  bucket_name = "outbreak-radar-terraform-state-dev"
}

output "s3_bucket_name" {
  description = "S3 bucket name for Terraform state"
  value       = module.terraform_backend.s3_bucket_name
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN for Terraform state"
  value       = module.terraform_backend.s3_bucket_arn
}
