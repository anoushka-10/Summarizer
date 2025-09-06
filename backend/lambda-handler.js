import serverlessExpress from '@vendia/serverless-express';
import app from './index.js';

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ 
  app,
  binaryMimeTypes: []
});

export const handler = async (event, context) => {
  console.log('=== LAMBDA START ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
    'Content-Type': 'application/json'
  };

  // Extract HTTP method from different possible locations
  const httpMethod = event.httpMethod || 
                    event.requestContext?.http?.method || 
                    event.requestContext?.httpMethod ||
                    (event.requestContext && event.requestContext.method);
                    
  console.log('HTTP Method detected:', httpMethod);
  
  // Handle OPTIONS immediately
  if (httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }
  
  // For non-OPTIONS requests, dynamically import and use serverless-express
  try {
    console.log('Loading Express app for non-OPTIONS request...');
    
    const { default: serverlessExpress } = await import('@vendia/serverless-express');
    const { default: app } = await import('./index.js');
    
    const serverlessExpressInstance = serverlessExpress({ app });
    const result = await serverlessExpressInstance(event, context);
    
    // Add CORS headers to the response
    if (!result.headers) result.headers = {};
    Object.assign(result.headers, corsHeaders);
    
    console.log('Express app handled request successfully');
    return result;
    
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
