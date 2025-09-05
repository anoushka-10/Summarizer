import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import Groq from 'groq-sdk';
import AWS from 'aws-sdk';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = 'http://meeting-ai-frontend-anoushka.s3-website.ap-south-1.amazonaws.com';

let groq;
let transporter;
let secretsLoaded = false;

// --- MIDDLEWARE ---
app.use(express.json({ limit: '10mb' }));

// Handle CORS preflight for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- SECRETS INITIALIZATION ---
async function initializeSecrets() {
  if (secretsLoaded) return;
  
  try {
    // Configure AWS region
    AWS.config.update({ region: 'ap-south-1' });
    
    const secretsManager = new AWS.SecretsManager();
    const secret = await secretsManager.getSecretValue({ SecretId: 'AI-summarizer' }).promise();
    const secrets = JSON.parse(secret.SecretString);

    const GROQ_API_KEY = secrets.GROQ_API_KEY;
    const GMAIL_USER = secrets.GMAIL_USER;
    const GMAIL_APP_PASSWORD = secrets.GMAIL_APP_PASSWORD;

    groq = new Groq({ apiKey: GROQ_API_KEY });
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });

    secretsLoaded = true;
    console.log('Secrets initialized successfully');
  } catch (error) {
    console.error('Failed to initialize secrets:', error);
    throw error;
  }
}

// --- ROUTES ---

// Health check
app.get('/api', (req, res) => {
  res.json({ 
    message: "AI Meeting Summarizer Backend is running!",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// 1. SUMMARIZATION ENDPOINT
app.post('/api/summarize', async (req, res) => {
    try {
        // Initialize secrets first - THIS WAS MISSING!
        await initializeSecrets();
        
        const { transcript, prompt } = req.body;

        // Enhanced validation
        if (!transcript || !prompt) {
            return res.status(400).json({ 
                error: 'Both transcript and prompt are required.',
                received: { transcript: !!transcript, prompt: !!prompt }
            });
        }

        if (transcript.trim().length < 10) {
            return res.status(400).json({ 
                error: 'Transcript is too short. Please provide a meaningful meeting transcript.'
            });
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a professional meeting summarizer. Your task is to create clean, direct summaries without any introductory phrases, explanations, or closing remarks. 

IMPORTANT RULES:
- Start directly with the summary content
- Do NOT begin with phrases like "Here is a summary", "Here's a summary", "Summary:", etc.
- Do NOT end with phrases like "Let me know if you need anything", "I hope this helps", etc.
- Focus only on the meeting content
- Be concise and professional
- Follow the user's formatting instructions exactly`
                },
                {
                    role: 'user',
                    content: `Meeting transcript:
${transcript}

Formatting instruction: ${prompt}

Provide the summary now:`
                }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.3, // Lower temperature for more consistent, focused responses
            max_tokens: 2000, // Reasonable limit
        });

        let summary = chatCompletion.choices[0]?.message?.content || 'Unable to generate summary.';
        
        // Additional cleanup (backup in case AI doesn't follow instructions)
        summary = summary
            .replace(/^(Here\s+(is|'s)\s+a?\s*summary.*?:?\s*)/i, '')
            .replace(/^Summary:?\s*/i, '')
            .replace(/(Let me know|Feel free|I hope this helps|Please let me know).*$/i, '')
            .trim();

        res.json({ summary });

    } catch (error) {
        console.error('Error with Groq API:', error);
        
        // More detailed error handling
        if (error.status === 429) {
            res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
        } else if (error.status === 401) {
            res.status(500).json({ error: 'API authentication failed. Please check server configuration.' });
        } else {
            res.status(500).json({ error: 'Failed to generate summary. Please try again.' });
        }
    }
});

// 2. EMAIL SHARING ENDPOINT (Gmail SMTP)
app.post('/api/send-email', async (req, res) => {
    try {
        // Initialize secrets first - THIS WAS ALSO MISSING!
        await initializeSecrets();
        
        const { summary, recipients, subject } = req.body;

        // Enhanced validation
        if (!summary || !recipients) {
            return res.status(400).json({ 
                error: 'Summary and recipients are required.',
                received: { summary: !!summary, recipients: !!recipients }
            });
        }

        if (summary.trim().length < 10) {
            return res.status(400).json({ 
                error: 'Summary is too short to send via email.'
            });
        }

        // Enhanced email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const recipientList = Array.isArray(recipients) 
            ? recipients.map(email => email.trim()).filter(email => emailRegex.test(email))
            : recipients.split(',').map(email => email.trim()).filter(email => emailRegex.test(email));

        if (recipientList.length === 0) {
            return res.status(400).json({ 
                error: 'No valid recipient email addresses provided. Please check the email format.'
            });
        }

        if (recipientList.length > 10) {
            return res.status(400).json({ 
                error: 'Too many recipients. Maximum 10 recipients allowed per request.'
            });
        }

        // Create a more professional email format
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

        // Send email using Gmail SMTP
        const mailOptions = {
            from: `"AI Meeting Summarizer" <${transporter.options.auth.user}>`,
            to: recipientList.join(', '),
            subject: emailSubject,
            html: emailHtml,
            text: `Meeting Summary:\n\n${summary}\n\n---\nThis summary was automatically generated using AI technology.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        res.json({ 
            message: `Email sent successfully to ${recipientList.length} recipient${recipientList.length > 1 ? 's' : ''}!`,
            recipients: recipientList.length,
            messageId: info.messageId
        });

    } catch (error) {
        console.error('Error sending email:', error);
        
        // Handle specific Gmail errors
        if (error.code === 'EAUTH') {
            res.status(500).json({ 
                error: 'Gmail authentication failed. Please check your email credentials.',
                details: 'Make sure you are using an App Password, not your regular Gmail password.'
            });
        } else if (error.code === 'ENOTFOUND') {
            res.status(500).json({ 
                error: 'Network error. Please check your internet connection.',
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to send email. Please try again later.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// --- START SERVER ---

if (process.env.NODE_ENV !== "lambda") {
    app.listen(PORT, () => {
    console.log(`🚀 AI Meeting Summarizer Backend running on port ${PORT}`);
    console.log(`📝 Summarization endpoint: http://localhost:${PORT}/api/summarize`);
    console.log(`📧 Email endpoint: http://localhost:${PORT}/api/send-email`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api`);
});
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

export default app;
