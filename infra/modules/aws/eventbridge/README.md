# EventBridge Scheduler Module

This Terraform module creates an Amazon EventBridge rule to trigger AWS Lambda functions on a schedule.

## Features

- Scheduled Lambda invocation using cron or rate expressions
- Configurable retry policy for failed invocations
- Optional dead letter queue for failed events
- Optional input transformation for event payloads
- Automatic Lambda permission configuration

## Usage

### Weekly Schedule (Aligned with CDC Friday Updates)

```hcl
module "outbreak_data_fetcher_schedule" {
  source = "../../modules/aws/eventbridge"

  rule_name           = "outbreak-data-fetcher-weekly"
  description         = "Triggers outbreak data fetcher Lambda every Friday at 12:00 UTC"
  schedule_expression = "cron(0 12 ? * FRI *)"
  
  target_lambda_arn           = module.outbreak_fetcher_lambda.lambda_arn
  target_lambda_function_name = module.outbreak_fetcher_lambda.lambda_name

  tags = {
    Environment = "dev"
    Purpose     = "outbreak-data-fetching"
  }
}
```

### Rate-Based Schedule

```hcl
module "batch_processor_schedule" {
  source = "../../modules/aws/eventbridge"

  rule_name           = "batch-processor-daily"
  description         = "Triggers batch processor Lambda every 24 hours"
  schedule_expression = "rate(1 day)"
  
  target_lambda_arn           = module.batch_processor_lambda.lambda_arn
  target_lambda_function_name = module.batch_processor_lambda.lambda_name

  maximum_retry_attempts = 3
  
  tags = {
    Environment = "dev"
  }
}
```

## Schedule Expression Formats

### Cron Expressions

Format: `cron(Minutes Hours Day-of-month Month Day-of-week Year)`

Examples:
- `cron(0 12 ? * FRI *)` - Every Friday at 12:00 UTC
- `cron(0 9 * * ? *)` - Every day at 9:00 AM UTC
- `cron(0 0 1 * ? *)` - First day of every month at midnight UTC

### Rate Expressions

Format: `rate(value unit)`

Examples:
- `rate(1 day)` - Every 24 hours
- `rate(7 days)` - Every 7 days
- `rate(1 hour)` - Every hour

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| rule_name | Name of the EventBridge rule | string | - | yes |
| description | Description of the EventBridge rule | string | "Scheduled event rule" | no |
| schedule_expression | Schedule expression (rate or cron) | string | - | yes |
| is_enabled | Whether the rule is enabled | bool | true | no |
| target_lambda_arn | ARN of the Lambda function to invoke | string | - | yes |
| target_lambda_function_name | Name of the Lambda function | string | - | yes |
| input_transformer | Input transformer configuration | object | null | no |
| maximum_event_age | Maximum age of event in seconds | number | 86400 | no |
| maximum_retry_attempts | Maximum retry attempts | number | 2 | no |
| dead_letter_queue_arn | ARN of DLQ (SQS or SNS) | string | null | no |
| tags | Tags to apply to resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| rule_id | ID of the EventBridge rule |
| rule_arn | ARN of the EventBridge rule |
| rule_name | Name of the EventBridge rule |
| target_id | ID of the EventBridge target |

## Requirements

- Terraform >= 1.0
- AWS Provider ~> 5.0

## Notes

- The module automatically creates the Lambda permission to allow EventBridge invocation
- For production use, consider adding a dead letter queue for failed events
- EventBridge uses UTC timezone for cron expressions
- CDC updates outbreak data every Friday, so align schedules accordingly
