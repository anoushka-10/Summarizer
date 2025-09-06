exports.handler = async (event, context) => {
  // Always log the incoming event first
  console.log('Lambda invoked:', JSON.stringify(event, null, 2));
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  try {
    // CRITICAL: Handle OPTIONS first and return immediately
    if (event.httpMethod === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''  // Empty body for OPTIONS
      };
    }

    // Handle POST /api/summarize
    if (event.httpMethod === 'POST') {
      console.log('Handling POST request to:', event.path);
      
      // Check if it's the summarize endpoint
      if (event.path === '/prod/api/summarize' || event.path === '/api/summarize' || event.path.includes('summarize')) {
        
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        
        if (!GROQ_API_KEY) {
          console.error('GROQ_API_KEY environment variable not set');
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Server configuration error: API key not found' })
          };
        }

        // Parse request body
        let requestBody;
        try {
          requestBody = JSON.parse(event.body || '{}');
        } catch (parseError) {
          console.error('Failed to parse request body:', parseError);
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid JSON in request body' })
          };
        }

        const { transcript, prompt } = requestBody;
        
        // Validate input
        if (!transcript || !prompt) {
          console.error('Missing required fields:', { transcript: !!transcript, prompt: !!prompt });
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
              error: 'Both transcript and prompt are required.',
              received: { transcript: !!transcript, prompt: !!prompt }
            })
          };
        }

        if (transcript.trim().length < 10) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ 
              error: 'Transcript is too short. Please provide a meaningful meeting transcript.'
            })
          };
        }

        console.log('Making request to Groq API...');
        
        // Make API request to Groq
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
                content: 'You are a professional meeting summarizer. Provide clean, direct summaries without introductory phrases like "Here is a summary" or closing remarks.'
              },
              {
                role: 'user',
                content: `Meeting transcript: ${transcript}\n\nFormatting instruction: ${prompt}\n\nProvide the summary now:`
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
            statusCode: response.status === 429 ? 429 : 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
              error: response.status === 429 ? 'Rate limit exceeded. Please try again in a moment.' : 'Failed to generate summary',
              details: response.status === 401 ? 'API authentication failed' : 'Service temporarily unavailable'
            })
          };
        }

        const data = await response.json();
        let summary = data.choices[0]?.message?.content || 'Unable to generate summary.';

        // Clean up summary
        summary = summary
          .replace(/^(Here\s+(is|'s)\s+a?\s*summary.*?:?\s*)/i, '')
          .replace(/^Summary:?\s*/i, '')
          .replace(/(Let me know|Feel free|I hope this helps).*$/i, '')
          .trim();

        console.log('Summary generated successfully');
        
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ summary })
        };
        
      } else {
        // POST to unknown endpoint
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Endpoint not found', path: event.path })
        };
      }
    }

    // Handle GET requests (health check)
    if (event.httpMethod === 'GET') {
      console.log('Handling GET health check');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'AI Meeting Summarizer Lambda is working!',
          timestamp: new Date().toISOString(),
          path: event.path
        })
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed', method: event.httpMethod })
    };

  } catch (error) {
    console.error('Unhandled Lambda error:', error);
    
    // Always return a proper response, even for errors
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Something went wrong processing your request'
      })
    };
  }
};
