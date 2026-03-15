# EventBridge Scheduler Module Outputs

output "rule_id" {
  description = "ID of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.schedule.id
}

output "rule_arn" {
  description = "ARN of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.schedule.arn
}

output "rule_name" {
  description = "Name of the EventBridge rule"
  value       = aws_cloudwatch_event_rule.schedule.name
}

output "target_id" {
  description = "ID of the EventBridge target"
  value       = aws_cloudwatch_event_target.lambda.target_id
}
