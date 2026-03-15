output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "lambda_errors_alarm_arn" {
  description = "Lambda errors alarm ARN"
  value       = aws_cloudwatch_metric_alarm.lambda_errors.arn
}

output "lambda_duration_alarm_arn" {
  description = "Lambda duration alarm ARN"
  value       = aws_cloudwatch_metric_alarm.lambda_duration.arn
}
