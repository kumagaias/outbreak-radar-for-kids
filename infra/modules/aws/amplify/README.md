# AWS Amplify Terraform Module

Terraform module for deploying web applications to AWS Amplify with custom domain support.

## Features

- Amplify app and branch configuration
- Custom domain with SSL/TLS certificate
- Automatic builds on git push
- SPA routing support
- Environment variables management

## Usage

```hcl
module "amplify" {
  source = "../../modules/aws/amplify"
  
  app_name       = "my-app-prod"
  repository_url = "https://github.com/username/repo"
  branch_name    = "main"
  
  # Build specification
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
  EOT
  
  # Custom domain
  domain_name          = "example.com"
  subdomain_prefix     = "app"
  enable_auto_sub_domain = false
  
  # SPA routing
  custom_rules = [
    {
      source = "/<*>"
      target = "/index.html"
      status = "200"
    }
  ]
  
  tags = {
    Environment = "prod"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| app_name | Name of the Amplify application | string | - | yes |
| repository_url | GitHub repository URL | string | - | yes |
| branch_name | Git branch name to deploy | string | "main" | no |
| build_spec | Build specification | string | null | no |
| domain_name | Custom domain name | string | null | no |
| subdomain_prefix | Subdomain prefix | string | "" | no |
| custom_rules | Custom rewrite/redirect rules | list(object) | [] | no |

## Outputs

| Name | Description |
|------|-------------|
| app_id | Amplify app ID |
| default_domain | Default Amplify domain |
| branch_url | Branch URL |
| custom_domain | Custom domain URL (if configured) |

## Custom Domain Setup

When using a custom domain with Route53:

1. Amplify automatically creates DNS records in Route53
2. SSL/TLS certificate is issued via AWS Certificate Manager
3. Certificate validation happens automatically
4. Domain becomes available after ~5-10 minutes

Example: `outbreak-radar-for-kids.kumagaias.com`

## Notes

- Repository must be connected to Amplify (requires GitHub OAuth)
- Custom domain requires Route53 hosted zone
- SSL certificate is automatically managed
