import serverlessExpress from '@vendia/serverless-express';
import app from './index.js';

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ 
  app,
  binaryMimeTypes: []
});

export const handler = async (event, context) => {
  // HANDLE OPTIONS REQUESTS IMMEDIATELY - BEFORE EXPRESS APP
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ message: 'CORS preflight handled' })
    };
  }

  // Set environment for Lambda
  process.env.NODE_ENV = 'lambda';
  
  try {
    // Handle non-OPTIONS requests with Express
    const result = await serverlessExpressInstance(event, context);
    
    // Ensure CORS headers are present
    if (!result.headers) {
      result.headers = {};
    }
    
    if (!result.headers['Access-Control-Allow-Origin']) {
      result.headers['Access-Control-Allow-Origin'] = 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com';
      result.headers['Access-Control-Allow-Headers'] = 'Content-Type';
      result.headers['Access-Control-Allow-Methods'] = 'OPTIONS,POST,GET';
    }
    
    return result;
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
