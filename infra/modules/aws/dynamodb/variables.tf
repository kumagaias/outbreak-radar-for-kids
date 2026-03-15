variable "environment" {
  description = "Environment name"
  type        = string
}

variable "table_name" {
  description = "DynamoDB table name"
  type        = string
}

variable "hash_key" {
  description = "Hash key attribute name"
  type        = string
}

variable "ttl_enabled" {
  description = "Enable TTL"
  type        = bool
  default     = true
}

variable "ttl_attribute" {
  description = "TTL attribute name"
  type        = string
  default     = "expiration_time"
}

variable "point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "range_key" {
  description = "Range key (sort key) attribute name"
  type        = string
  default     = null
}
