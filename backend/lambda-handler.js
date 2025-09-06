import serverlessExpress from '@vendia/serverless-express';
import app from './index.js';

// Create serverless Express handler
const serverlessExpressInstance = serverlessExpress({ 
  app,
  binaryMimeTypes: []
});

export const handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS immediately
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'CORS OK' })
    };
  }

  // Handle POST /api/summarize
  if (event.httpMethod === 'POST' && event.path === '/api/summarize') {
    try {
      // Get Groq API key from environment
      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      
      if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not found');
      }

      const body = JSON.parse(event.body || '{}');
      const { transcript, prompt } = body;

      if (!transcript || !prompt) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Both transcript and prompt are required.' 
          })
        };
      }

      // Simple Groq API call without the heavy Express setup
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a professional meeting summarizer. Provide clean, direct summaries.'
            },
            {
              role: 'user',
              content: `Meeting transcript: ${transcript}\n\nFormatting instruction: ${prompt}`
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || 'Unable to generate summary.';

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary })
      };

    } catch (error) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to generate summary',
          details: error.message 
        })
      };
    }
  }

  // Health check
  if (event.httpMethod === 'GET' && event.path === '/api') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'AI Meeting Summarizer is running!',
        status: 'healthy' 
      })
    };
  }

  // Default response
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' })
  };
};
