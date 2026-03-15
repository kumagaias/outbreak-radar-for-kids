output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "hosted_zone_name_servers" {
  description = "Route 53 hosted zone name servers"
  value       = data.aws_route53_zone.main.name_servers
}

output "subdomain_fqdn" {
  description = "Fully qualified domain name of the subdomain"
  value       = var.subdomain_prefix != "" ? "${var.subdomain_prefix}.${var.domain_name}" : null
}

output "subdomain_record_name" {
  description = "DNS record name for the subdomain"
  value       = var.subdomain_prefix != "" ? aws_route53_record.amplify_subdomain[0].name : null
}
