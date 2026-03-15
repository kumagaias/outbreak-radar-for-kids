# SSM Parameter Store Module

This module creates AWS Systems Manager Parameter Store parameters for storing Nova AI system prompts with versioning support.

## Features

- Stores Japanese and English system prompts
- Supports versioning via path format (`/prompts/v1/ja`, `/prompts/v1/en`)
- Enables A/B testing and prompt iteration post-MVP
- Provides secure access without additional cost
- Supports prompt version logging for correlation with user feedback

## Usage

```hcl
module "ssm_prompts" {
  source = "../../modules/aws/ssm-parameter"

  prompt_ja_path    = "/prompts/v1/ja"
  prompt_en_path    = "/prompts/v1/en"
  prompt_ja_content = file("${path.module}/../../modules/aws/ssm-parameter/prompts/ja.txt")
  prompt_en_content = file("${path.module}/../../modules/aws/ssm-parameter/prompts/en.txt")

  tags = {
    Environment = "dev"
    Project     = "outbreak-radar"
  }
}
```

## Prompt Template Variables

The prompt templates use the following placeholders that should be replaced at runtime by the Lambda function:

- `{{ageRange}}` - Child age range (0-1, 2-3, 4-6, 7+)
- `{{geographicArea}}` - Geographic area (prefecture/state level)
- `{{diseaseNames}}` - Current outbreak disease names
- `{{riskLevel}}` - Risk level (high, medium, low)

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| prompt_ja_path | Parameter Store path for Japanese prompt | string | `/prompts/v1/ja` | no |
| prompt_en_path | Parameter Store path for English prompt | string | `/prompts/v1/en` | no |
| prompt_ja_content | Japanese system prompt content | string | n/a | yes |
| prompt_en_content | English system prompt content | string | n/a | yes |
| tags | Tags to apply to all resources | map(string) | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| prompt_ja_arn | ARN of the Japanese prompt parameter |
| prompt_en_arn | ARN of the English prompt parameter |
| prompt_ja_name | Name of the Japanese prompt parameter |
| prompt_en_name | Name of the English prompt parameter |
| prompt_ja_version | Version of the Japanese prompt parameter |
| prompt_en_version | Version of the English prompt parameter |

## IAM Permissions

Lambda functions need the following IAM permissions to read these parameters:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/prompts/v1/*"
      ]
    }
  ]
}
```

## Versioning Strategy

- Current version: `v1` (path: `/prompts/v1/ja`, `/prompts/v1/en`)
- Future versions: Create new paths like `/prompts/v2/ja`, `/prompts/v2/en`
- Lambda environment variable points to parameter path for easy version switching
- Enables A/B testing by deploying different Lambda versions with different parameter paths

## Cost

AWS Systems Manager Parameter Store Standard tier is free for up to 10,000 parameters. This module creates 2 parameters (Japanese and English), well within the free tier.

## Requirements

| Name | Version |
|------|---------|
| terraform | ~> 1.0 |
| aws | ~> 5.0 |
