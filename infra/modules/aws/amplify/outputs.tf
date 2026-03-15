output "app_id" {
  description = "Amplify app ID"
  value       = aws_amplify_app.main.id
}

output "app_arn" {
  description = "Amplify app ARN"
  value       = aws_amplify_app.main.arn
}

output "default_domain" {
  description = "Default Amplify domain"
  value       = aws_amplify_app.main.default_domain
}

output "branch_name" {
  description = "Branch name"
  value       = aws_amplify_branch.main.branch_name
}

output "branch_url" {
  description = "Branch URL"
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.main.default_domain}"
}

output "custom_domain" {
  description = "Custom domain URL (if configured)"
  value       = var.domain_name != null ? "https://${var.subdomain_prefix != "" ? "${var.subdomain_prefix}." : ""}${var.domain_name}" : null
}

output "domain_association_arn" {
  description = "Domain association ARN"
  value       = var.domain_name != null ? aws_amplify_domain_association.main[0].arn : null
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain for DNS CNAME record"
  value       = var.domain_name != null ? try([for sd in aws_amplify_domain_association.main[0].sub_domain : sd.dns_record if sd.sub_domain_setting[0].prefix == var.subdomain_prefix][0], null) : null
}

output "certificate_verification_dns_record" {
  description = "Certificate verification DNS record"
  value       = var.domain_name != null ? aws_amplify_domain_association.main[0].certificate_verification_dns_record : null
}
