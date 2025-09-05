import serverlessExpress from '@vendia/serverless-express';
import app from './index.js';

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ 
  app,
  // Optional: Configure binary media types if needed
  binaryMimeTypes: []
});

export const handler = async (event, context) => {
  // Set environment for Lambda
  process.env.NODE_ENV = 'lambda';
  
  try {
    // Handle the request
    const result = await serverlessExpressInstance(event, context);
    
    // Ensure CORS headers are present (backup - your Express app should handle this)
    if (!result.headers) {
      result.headers = {};
    }
    
    // Only add CORS headers if not already present
    if (!result.headers['Access-Control-Allow-Origin']) {
      result.headers['Access-Control-Allow-Origin'] = 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com';
      result.headers['Access-Control-Allow-Headers'] = 'Content-Type';
      result.headers['Access-Control-Allow-Methods'] = 'OPTIONS,POST,GET';
    }
    
    return result;
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    // Return a proper error response with CORS headers
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
