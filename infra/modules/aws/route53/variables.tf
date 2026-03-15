variable "domain_name" {
  description = "Domain name (e.g., kumagaias.com)"
  type        = string
}

variable "subdomain_prefix" {
  description = "Subdomain prefix (e.g., 'outbreak-radar-for-kids')"
  type        = string
  default     = ""
}

variable "amplify_cloudfront_domain" {
  description = "Amplify CloudFront distribution domain (e.g., d36bphnouivj3t.cloudfront.net)"
  type        = string
}

variable "certificate_validation_record" {
  description = "Certificate validation DNS record (optional)"
  type = object({
    name  = string
    type  = string
    value = string
  })
  default = null
}
