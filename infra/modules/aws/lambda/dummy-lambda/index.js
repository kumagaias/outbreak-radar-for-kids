/**
 * Dummy Lambda function for initial Terraform deployment
 * 
 * This is a placeholder function that will be replaced with the actual
 * Nova recommendations Lambda implementation after infrastructure is deployed.
 * 
 * Purpose: Terraform requires deployable code to create Lambda resource.
 * This avoids the "chicken and egg" problem where we need Lambda to exist
 * before we can deploy the real backend code.
 */

exports.handler = async (event) => {
    console.log('Dummy Lambda invoked:', JSON.stringify(event, null, 2));
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Hello from dummy Lambda! This will be replaced with Nova recommendations API.',
            timestamp: new Date().toISOString(),
            event: event
        }),
    };
};
