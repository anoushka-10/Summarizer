// EMERGENCY HANDLER - NO IMPORTS AT ALL
exports.handler = async (event, context) => {
  console.log('Lambda invoked:', JSON.stringify(event, null, 2));
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    // Handle OPTIONS
    if (event.httpMethod === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'CORS preflight OK' })
      };
    }

    // Handle POST /api/summarize with native fetch
    if (event.httpMethod === 'POST' && (event.path === '/api/summarize' || event.path.includes('summarize'))) {
      console.log('Handling POST /api/summarize');
      
      const GROQ_API_KEY = process.env.GROQ_API_KEY;
      
      if (!GROQ_API_KEY) {
        console.error('GROQ_API_KEY not found');
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'GROQ_API_KEY not configured' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { transcript, prompt } = body;
      
      if (!transcript || !prompt) {
        console.error('Missing transcript or prompt');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing transcript or prompt' })
        };
      }

      console.log('Making request to Groq API');
      
      // Use native fetch API (available in Node.js 18+)
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
              content: 'You are a professional meeting summarizer. Provide clean, direct summaries without introductory phrases.'
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
        const errorText = await response.text();
        console.error('Groq API error:', response.status, errorText);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: `Groq API error: ${response.status}`,
            details: errorText
          })
        };
      }

      const data = await response.json();
      let summary = data.choices[0]?.message?.content || 'Unable to generate summary.';

      // Clean up summary
      summary = summary
        .replace(/^(Here\s+(is|'s)\s+a?\s*summary.*?:?\s*)/i, '')
        .replace(/^Summary:?\s*/i, '')
        .trim();

      console.log('Summary generated successfully');
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary })
      };
    }

    // Health check
    if (event.httpMethod === 'GET') {
      console.log('Handling GET health check');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'AI Meeting Summarizer is working!',
          timestamp: new Date().toISOString(),
          path: event.path,
          method: event.httpMethod
        })
      };
    }

    // Default
    console.log('Route not found:', event.httpMethod, event.path);
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
