terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source to get existing hosted zone
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# CNAME record for custom subdomain pointing to Amplify CloudFront distribution
resource "aws_route53_record" "amplify_subdomain" {
  count = var.subdomain_prefix != "" ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain_prefix}.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.amplify_cloudfront_domain]
}

# Optional: Certificate validation record (if needed)
resource "aws_route53_record" "cert_validation" {
  count = var.certificate_validation_record != null ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.certificate_validation_record.name
  type    = var.certificate_validation_record.type
  ttl     = 300
  records = [var.certificate_validation_record.value]
}
