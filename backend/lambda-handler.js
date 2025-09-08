import Groq from 'groq-sdk';
import nodemailer from 'nodemailer';

// Global variables to be reused across warm invocations
let groqClient;
let emailTransporter;
let secretsInitialized = false;

// Function to safely initialize secrets and clients once per container
async function initializeSecrets() {
  if (secretsInitialized) {
    return;
  }

  try {
    console.log('Initializing clients from Lambda environment variables...');
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not found in environment variables.');
    }

    groqClient = new Groq({ apiKey: GROQ_API_KEY });
    console.log('Groq client created successfully.');

    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
      });
      console.log('Email transporter created successfully.');
    } else {
      console.log('Email credentials not found. Email functionality will be disabled.');
    }

    secretsInitialized = true;
    console.log('All necessary environment variables loaded.');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    throw error;
  }
}

// Main Lambda handler function
export const handler = async (event) => {
  const allowedOrigins = [
    'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
    'http://meeting-ai-frontend-anoushka.s3-website-ap-south-1.amazonaws.com'
  ];

  const requestOrigin = event.headers.origin || event.headers.Origin;

  let originHeader = ''; 
  if (allowedOrigins.includes(requestOrigin)) {
    originHeader = requestOrigin;
  } else {
    originHeader = 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com';
  }

  console.log('Lambda invoked with event:', JSON.stringify(event, null, 2));

  const corsHeaders = {
    'Access-Control-Allow-Origin': originHeader,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Step 1: Handle OPTIONS preflight request immediately
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    const optionsHeaders = {
      'Access-Control-Allow-Origin': 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    };
    return {
      statusCode: 200,
      headers: optionsHeaders,
      body: ''
    };
  }

  try {
    await initializeSecrets();
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Server initialization failed. Please check environment variables.' })
    };
  }

  let requestBody = {};
  if (event.httpMethod === 'POST' && event.body) {
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Invalid JSON in request body:', parseError);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON in request body.' })
      };
    }
  }

  const path = event.path.endsWith('/') ? event.path.slice(0, -1) : event.path;
  const endpoint = path.split('/').pop();

  switch (endpoint) {
    case 'summarize':
      return handleSummarize(requestBody, corsHeaders);
    case 'send-email':
      return handleSendEmail(requestBody, corsHeaders);
    case 'api':
      return handleHealthCheck(corsHeaders);
    default:
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Endpoint not found.' })
      };
  }
};

async function handleSummarize(requestBody, headers) {
  try {
    const { transcript, prompt } = requestBody;
    if (!transcript || !prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Both transcript and prompt are required.' }) };
    }
    if (transcript.trim().length < 10) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Transcript is too short. Please provide a meaningful meeting transcript.' }) };
    }
    const chatCompletion = await groqClient.chat.completions.create({
      messages: [{ role: 'system', content: `You are a professional meeting summarizer. Your task is to create clean, direct summaries without any introductory phrases, explanations, or closing remarks. IMPORTANT RULES: - Start directly with the summary content - Do NOT begin with phrases like "Here is a summary", "Here's a summary", "Summary:", etc. - Do NOT end with phrases like "Let me know if you need anything", "I hope this helps", etc. - Focus only on the meeting content - Be concise and professional - Follow the user's formatting instructions exactly` }, { role: 'user', content: `Meeting transcript: ${transcript}\n\nFormatting instruction: ${prompt}\n\nProvide the summary now:` }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3, max_tokens: 2000,
    });
    let summary = chatCompletion.choices[0]?.message?.content || 'Unable to generate summary.';
    summary = summary.replace(/^(Here\s+(is|'s)\s+a?\s*summary.*?:?\s*)/i, '').replace(/^Summary:?\s*/i, '').replace(/(Let me know|Feel free|I hope this helps|Please let me know).*$/i, '').trim();
    console.log('Summary generated successfully.');
    return { statusCode: 200, headers, body: JSON.stringify({ summary }) };
  } catch (error) {
    console.error('Error in handleSummarize:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate summary.' }) };
  }
}

async function handleSendEmail(requestBody, headers) {
  try {
    if (!emailTransporter) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured.' }) };
    }
    const { summary, recipients, subject } = requestBody;
    if (!summary || !recipients) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Summary and recipients are required.' }) };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const recipientList = Array.isArray(recipients) ? recipients.map(email => email.trim()).filter(email => emailRegex.test(email)) : recipients.split(',').map(email => email.trim()).filter(email => emailRegex.test(email));
    if (recipientList.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid recipient email addresses provided.' }) };
    }
    const emailSubject = subject || 'Meeting Summary';
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🤖 Meeting Summary</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Generated by AI Meeting Summarizer</p>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #667eea;">
                  <pre style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap; line-height: 1.6; margin: 0; color: #333; font-size: 14px;">${summary}</pre>
              </div>
              <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d;">
                      This summary was automatically generated using AI technology.<br>
                      <span style="color: #495057; font-weight: 500;">AI Meeting Summarizer</span>
                  </p>
              </div>
          </div>
      </div>
    `;
    const mailOptions = { from: `"AI Meeting Summarizer" <${process.env.GMAIL_USER}>`, to: recipientList.join(', '), subject: emailSubject, html: emailHtml };
    await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully.');
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Email sent successfully.' }) };
  } catch (error) {
    console.error('Error in handleSendEmail:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email.' }) };
  }
}

function handleHealthCheck(headers) {
  console.log('Handling health check.');
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'AI Meeting Summarizer Backend is running!', status: 'healthy', timestamp: new Date().toISOString() })
  };
}
