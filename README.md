# Outbreak Radar for Kids

子ども感染症レーダー - 保護者が子供の感染症リスクを素早く確認できるアプリ

## Overview

保育園からの通知時に3分以内で登園判断の材料を提供。毎朝10秒で地域の感染症リスクをチェックできます。

## Demo

- **Web版**: https://dev.d10s8fppfqqa4c.amplifyapp.com
- **iOS Development Build**: https://expo.dev/accounts/bonopo/projects/outbreak-radar-for-kids/builds

## Project Structure

```
.
├── mobile/          # React Native app (Expo)
├── backend/         # Lambda function (Nova AI recommendations)
├── infra/           # Terraform (AWS infrastructure)
└── docs/            # Documentation
```

## Quick Start

```bash
# Install dependencies
make install

# Run tests
make test

# Mobile development
make mobile-dev

# Deploy web version
make mobile-deploy
```

## Tech Stack

- **Frontend**: React Native (Expo), TypeScript, Expo Router
- **Backend**: AWS Lambda, Amazon Bedrock (Nova), DynamoDB
- **Infrastructure**: Terraform, AWS Amplify
- **Deployment**: AWS (Lambda, API Gateway, CloudFront, Cognito)

## Development

See individual README files for details:
- [Mobile App](mobile/README.md)
- [Backend](backend/README.md)
- [Infrastructure](infra/README.md)

## Deployment

### Backend Lambda Functions

Backend Lambda functions are automatically deployed via GitHub Actions on push to `main` branch:

- **Nova Recommendations**: Triggers on changes to `backend/**` (excluding outbreak-fetcher)
- **Outbreak Data Fetcher**: Triggers on changes to `backend/lambda/outbreak-fetcher/**`

Deployment uses AWS OIDC authentication and deploys Docker images to ECR, then updates Lambda functions.

See [.github/workflows/deploy-lambda.yml](.github/workflows/deploy-lambda.yml) for details.

## License

MIT
