/**
 * AWS Amplify Configuration for Nova AI Recommendations MVP
 * 
 * This file contains AWS service endpoints and configuration for the mobile app.
 * Values are from Terraform deployment outputs (infra/environments/dev/).
 * 
 * Environment: dev
 * Last Updated: 2026-03-14
 */

const awsconfig = {
  // AWS Cognito Identity Pool for unauthenticated access
  Auth: {
    identityPoolId: 'ap-northeast-1:b2ab64de-0f7c-49dd-94ae-6a6df79273a3',
    region: 'ap-northeast-1',
    // Unauthenticated access enabled for MVP
    // Users get temporary AWS credentials without sign-in
    mandatorySignIn: false
  },
  
  // API Gateway endpoints
  API: {
    endpoints: [
      {
        name: 'NovaRecommendationsAPI',
        endpoint: 'https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev',
        region: 'ap-northeast-1',
        // Use IAM authentication (AWS Signature Version 4)
        // Amplify automatically signs requests with temporary credentials
        custom_header: async () => {
          return {
            'Content-Type': 'application/json'
          };
        }
      }
    ]
  }
};

export default awsconfig;
