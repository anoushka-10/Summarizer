import React, { useState } from 'react';
import './App.css';

function App() {
  const [transcript, setTranscript] = useState('');
  const [prompt, setPrompt] = useState('Summarize in bullet points for executives');
  const [summary, setSummary] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // IMPORTANT: Replace this with your deployed backend URL later
  const API_URL = 'http://localhost:3001';

  const cleanSummary = (rawSummary) => {
    // Remove common AI response phrases
    let cleaned = rawSummary
      .replace(/^Here is a summary.*?:\s*/i, '')
      .replace(/^Here's a summary.*?:\s*/i, '')
      .replace(/^Summary:\s*/i, '')
      .replace(/Let me know if.*?$/i, '')
      .replace(/If you need.*?$/i, '')
      .replace(/Please let me know.*?$/i, '')
      .replace(/I hope this helps.*?$/i, '')
      .replace(/Feel free to.*?$/i, '')
      .replace(/\n\s*Let me know.*$/i, '')
      .replace(/\n\s*If you need.*$/i, '')
      .replace(/\n\s*Please let me know.*$/i, '')
      .replace(/\n\s*I hope this helps.*$/i, '')
      .replace(/\n\s*Feel free to.*$/i, '')
      .trim();
    
    return cleaned;
  };

  const handleGenerateSummary = async () => {
    if (!transcript.trim()) {
      setStatusMessage({ text: 'Please paste a transcript first.', type: 'error' });
      return; 
    }
    setIsLoading(true);
    setStatusMessage({ text: 'Generating AI summary...', type: 'loading' });
    setSummary('');

    try {
      const response = await fetch(`${API_URL}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const cleanedSummary = cleanSummary(data.summary);
      setSummary(cleanedSummary);
      setStatusMessage({ text: 'Summary generated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error generating summary:', error);
      setStatusMessage({ text: 'Failed to generate summary. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!summary || !recipients) {
      setStatusMessage({ text: 'Please generate a summary and enter recipients.', type: 'error' });
      return;
    }
    setStatusMessage({ text: 'Sending email...', type: 'loading' });

    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recipients: recipients.split(',').map(email => email.trim()),
          subject: 'Meeting Summary',
          summary: summary 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStatusMessage({ text: data.message || 'Email sent successfully!', type: 'success' });
      setRecipients(''); // Clear the input after sending
    } catch (error) {
      console.error('Error sharing summary:', error);
      setStatusMessage({ text: 'Failed to send email. Please try again.', type: 'error' });
    }
  };

  const handleCopyToClipboard = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setStatusMessage({ text: 'Summary copied to clipboard!', type: 'success' });
      setTimeout(() => setStatusMessage({ text: '', type: '' }), 2000);
    }
  };

  const predefinedPrompts = [
    'Summarize in bullet points for executives',
    'Extract only action items and deadlines',
    'Create a brief overview for team members',
    'Highlight key decisions and next steps',
    'Focus on main discussion points and outcomes'
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTranscript(e.target.result);
        setStatusMessage({ text: 'File uploaded successfully!', type: 'success' });
      };
      reader.readAsText(file);
    } else {
      setStatusMessage({ text: 'Please select a valid .txt file', type: 'error' });
    }
  };

  const getProgressCircleClass = (step) => {
    if (step === 1) {
      return transcript ? 'completed' : 'active';
    } else if (step === 2) {
      return summary ? 'completed' : transcript ? 'active' : 'inactive';
    } else if (step === 3) {
      return summary ? 'active' : 'inactive';
    }
    return 'inactive';
  };

  return (
    <div className="container">
      <div className="main-card">
        {/* Header */}
        <div className="header">
          <h1 className="title">🤖 AI Meeting Summarizer</h1>
          <p className="subtitle">Transform your meeting transcripts into actionable summaries</p>
        </div>

        {/* Progress Steps */}
        <div className="progress-container">
          <div className="progress-steps">
            <div className="progress-step">
              <div className={`progress-circle ${getProgressCircleClass(1)}`}>
                {transcript ? '✓' : '1'}
              </div>
              <span>Input</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className={`progress-circle ${getProgressCircleClass(2)}`}>
                {summary ? '✓' : '2'}
              </div>
              <span>Summarize</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className={`progress-circle ${getProgressCircleClass(3)}`}>
                3
              </div>
              <span>Share</span>
            </div>
          </div>
        </div>

        {/* Section 1: Input */}
        <div className="section">
          <div className="section-header">
            <span>📝</span>
            <h2 className="section-title">Step 1: Input Meeting Transcript (.txt file)</h2>
          </div>
          
          {/* File Upload */}
          <div className="upload-zone">
            <p>📁 Upload a .txt file or paste your transcript below</p>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              style={{ marginTop: '1rem' }}
            />
          </div>

          {/* Transcript Input */}
          <div>
            <label className="label">
              Meeting Transcript
            </label>
            <textarea
              className="textarea"
              rows={10}
              placeholder={`Paste your meeting transcript here...

Example:
Meeting: Weekly Team Standup
Date: January 15, 2024
Attendees: John, Sarah, Mike

John: Let's start with updates...`}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <div className="character-count">
              {transcript.length} characters
            </div>
          </div>

          {/* Prompt Selection */}
          <div>
            <label className="label-large">
              📝 How would you like the summary formatted?
            </label>
            <p className="help-text">Choose a format below or write your own custom instructions:</p>
            <div className="prompt-grid">
              {predefinedPrompts.map((predefinedPrompt, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(predefinedPrompt)}
                  className={`prompt-button ${prompt === predefinedPrompt ? 'active' : ''}`}
                >
                  {predefinedPrompt}
                </button>
              ))}
            </div>
            <label className="label" style={{ marginTop: '1rem' }}>
              💡 Or write your custom instructions:
            </label>
            <input
              type="text"
              className="input"
              placeholder="Example: Focus on technical decisions and timeline updates..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateSummary}
            disabled={isLoading || !transcript.trim()}
            className="primary-button"
          >
            {isLoading ? (
              <>⏳ Generating Summary...</>
            ) : (
              <>✨ Generate AI Summary</>
            )}
          </button>
        </div>

        {/* Section 2: Summary */}
        {summary && (
          <div className="section">
            <div className="section-header">
              <span>✨</span>
              <h2 className="section-title">Step 2: Review & Edit Summary</h2>
              <button
                onClick={handleCopyToClipboard}
                className="secondary-button"
              >
                📋 Copy
              </button>
            </div>
            
            <textarea
              className="textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={12}
              placeholder="Your AI-generated summary will appear here..."
            />
            <div className="character-count">
              {summary.length} characters
            </div>
          </div>
        )}

        {/* Section 3: Share */}
        {summary && (
          <div className="section">
            <div className="section-header">
              <span>📧</span>
              <h2 className="section-title">Step 3: Share Summary via Email</h2>
            </div>
            
            <div>
              <label className="label">
                📬 Email Recipients
              </label>
              <p className="help-text">Enter email addresses separated by commas (e.g., john@company.com, sarah@company.com)</p>
              <input
                type="email"
                className="input"
                placeholder="john@company.com, sarah@company.com, mike@company.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <div className="character-count">
                {recipients ? recipients.split(',').filter(email => email.trim()).length : 0} recipient{recipients && recipients.split(',').filter(email => email.trim()).length !== 1 ? 's' : ''} entered
              </div>
            </div>
            
            <button
              onClick={handleShare}
              disabled={!recipients.trim() || !summary.trim()}
              className={`primary-button ${(!recipients.trim() || !summary.trim()) ? '' : 'green'}`}
            >
              📨 Send Summary via Email
            </button>
          </div>
        )}

        {/* Status Messages */}
        {statusMessage.text && (
          <div className="section">
            <div className={`status-message ${statusMessage.type}`}>
              {statusMessage.type === 'success' && '✅'}
              {statusMessage.type === 'error' && '❌'}
              {statusMessage.type === 'loading' && '⏳'}
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <p>🚀 AI-Powered Meeting Summarization • Built with Grok</p>
        </div>
      </div>
    </div>
  );
}

export default App;
