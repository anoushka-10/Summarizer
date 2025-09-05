// backend/lambda-handler.js
import serverlessExpress from '@vendia/serverless-express';
import app from './index.js'; // Your Express app

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = async (event, context) => {
  // Set NODE_ENV to lambda so your app doesn't try to call app.listen()
  process.env.NODE_ENV = "lambda";
  
  console.log('Lambda Event:', JSON.stringify(event, null, 2));
  
  try {
    const result = await serverlessExpressInstance(event, context);
    console.log('Lambda Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Lambda Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
