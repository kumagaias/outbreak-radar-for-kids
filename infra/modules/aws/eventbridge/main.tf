# EventBridge Scheduler for Background Batch Processing
# This module creates an EventBridge rule to trigger Lambda functions on a schedule

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# EventBridge Rule for scheduled execution
resource "aws_cloudwatch_event_rule" "schedule" {
  name                = var.rule_name
  description         = var.description
  schedule_expression = var.schedule_expression
  state               = var.is_enabled ? "ENABLED" : "DISABLED"

  tags = merge(
    var.tags,
    {
      Name = var.rule_name
    }
  )
}

# EventBridge Target - Lambda Function
resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "${var.rule_name}-target"
  arn       = var.target_lambda_arn

  # Optional: Add input transformer if needed
  dynamic "input_transformer" {
    for_each = var.input_transformer != null ? [var.input_transformer] : []
    content {
      input_paths    = input_transformer.value.input_paths
      input_template = input_transformer.value.input_template
    }
  }

  # Retry policy for failed invocations
  retry_policy {
    maximum_retry_attempts       = var.maximum_retry_attempts
    maximum_event_age_in_seconds = 3600 # 1 hour
  }

  # Dead letter queue for failed events (optional)
  dynamic "dead_letter_config" {
    for_each = var.dead_letter_queue_arn != null ? [1] : []
    content {
      arn = var.dead_letter_queue_arn
    }
  }
}

# Lambda permission to allow EventBridge to invoke the function
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge-${var.rule_name}"
  action        = "lambda:InvokeFunction"
  function_name = var.target_lambda_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}
