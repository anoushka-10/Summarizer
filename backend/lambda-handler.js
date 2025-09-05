// backend/lambda-handler.js
import serverlessExpress from '@vendia/serverless-express';
import app from './index.js'; // Your Express app

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ app });


export const handler = async (event, context) => {
  process.env.NODE_ENV = 'lambda';

  // Ensure CORS works in API Gateway
  const result = await serverlessExpressInstance(event, context);
  if (!result.headers['Access-Control-Allow-Origin']) {
    result.headers['Access-Control-Allow-Origin'] = '*';
    result.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    result.headers['Access-Control-Allow-Methods'] = 'OPTIONS,POST,GET';
  }
  return result;
};
