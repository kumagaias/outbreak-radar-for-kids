resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.iam_role_arn
  package_type  = var.image_uri != "" ? "Image" : "Zip"
  
  # Container image configuration
  image_uri     = var.image_uri != "" ? var.image_uri : null
  
  # ZIP configuration (fallback)
  filename         = var.image_uri == "" ? "${path.module}/lambda_function.zip" : null
  handler          = var.image_uri == "" ? var.handler : null
  runtime          = var.image_uri == "" ? var.runtime : null
  source_code_hash = var.image_uri == "" ? filebase64sha256("${path.module}/lambda_function.zip") : null
  
  memory_size = var.memory_size
  timeout     = var.timeout

  environment {
    variables = var.environment_variables
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7

  tags = {
    Environment = var.environment
  }
}

resource "aws_lambda_permission" "api_gateway" {
  count = var.api_gateway_execution_arn != "" ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke-${var.function_name}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# Lambda alias for Provisioned Concurrency
resource "aws_lambda_alias" "live" {
  count = var.enable_provisioned_concurrency ? 1 : 0

  name             = "live"
  description      = "Live alias for Provisioned Concurrency"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version
}

# Provisioned Concurrency for morning peak hours (6:00-9:00 JST)
resource "aws_lambda_provisioned_concurrency_config" "morning_peak" {
  count = var.enable_provisioned_concurrency ? 1 : 0

  function_name                     = aws_lambda_function.this.function_name
  provisioned_concurrent_executions = var.provisioned_concurrency_count
  qualifier                         = aws_lambda_alias.live[0].name

  depends_on = [aws_lambda_alias.live]
}

# Application Auto Scaling target for Provisioned Concurrency
resource "aws_appautoscaling_target" "lambda_provisioned_concurrency" {
  count = var.enable_provisioned_concurrency ? 1 : 0

  max_capacity       = var.provisioned_concurrency_max
  min_capacity       = var.provisioned_concurrency_min
  resource_id        = "function:${aws_lambda_function.this.function_name}:provisioned-concurrency:${aws_lambda_alias.live[0].name}"
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  service_namespace  = "lambda"

  depends_on = [aws_lambda_provisioned_concurrency_config.morning_peak]
}

# Scheduled scaling: Scale UP for morning peak (6:00 AM JST = 21:00 UTC previous day)
resource "aws_appautoscaling_scheduled_action" "morning_peak_scale_up" {
  count = var.enable_provisioned_concurrency ? 1 : 0

  name               = "${var.function_name}-morning-peak-scale-up"
  service_namespace  = aws_appautoscaling_target.lambda_provisioned_concurrency[0].service_namespace
  resource_id        = aws_appautoscaling_target.lambda_provisioned_concurrency[0].resource_id
  scalable_dimension = aws_appautoscaling_target.lambda_provisioned_concurrency[0].scalable_dimension
  schedule           = var.peak_hours_scale_up_cron

  scalable_target_action {
    min_capacity = var.provisioned_concurrency_count
    max_capacity = var.provisioned_concurrency_max
  }
}

# Scheduled scaling: Scale DOWN after morning peak (9:00 AM JST = 00:00 UTC)
resource "aws_appautoscaling_scheduled_action" "morning_peak_scale_down" {
  count = var.enable_provisioned_concurrency ? 1 : 0

  name               = "${var.function_name}-morning-peak-scale-down"
  service_namespace  = aws_appautoscaling_target.lambda_provisioned_concurrency[0].service_namespace
  resource_id        = aws_appautoscaling_target.lambda_provisioned_concurrency[0].resource_id
  scalable_dimension = aws_appautoscaling_target.lambda_provisioned_concurrency[0].scalable_dimension
  schedule           = var.peak_hours_scale_down_cron

  scalable_target_action {
    min_capacity = var.provisioned_concurrency_min
    max_capacity = var.provisioned_concurrency_min
  }
}
