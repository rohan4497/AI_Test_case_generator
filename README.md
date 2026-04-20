# AI Test Case Generator

A full-stack web application that connects to Jira, fetches user stories, and automatically generates structured test cases using Claude (Anthropic).

## Requirements

- Node.js (v18+)
- Python (v3.10+)
- An Anthropic API Key (Claude)
- Jira API Credentials (URL, Email, Token)

## Setup and Running

### 1. Backend (FastAPI)

\`\`\`bash
cd backend
python -m venv venv
# Windows: venv\\Scripts\\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
\`\`\`
The backend will run at \`http://127.0.0.1:8000\`.

Alternatively, with Docker:
\`\`\`bash
cd backend
docker build -t test-case-generator-backend .
docker run -p 8000:8000 test-case-generator-backend
\`\`\`

### 2. Frontend (React + Vite)

\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
The frontend will run at \`http://localhost:5173\`.

## Features
- **Modern Glassmorphic UI**: High-end visual aesthetic out-of-the-box.
- **Jira Integration**: Native Atlassian v3 API support to parse ADF format.
- **LLM Integration**: Streaming-compatible AI service connected to Claude Sonnet (via Anthropic API).
- **Template Engine**: Customize test case generation instructions via YAML templates.
- **Data Export**: Save generated tests directly to `.md`, `.csv`, or copy as TSV for instant pasting.

## Env Variables
In the backend, you can specify `.env` with:
\`\`\`
ANTHROPIC_API_KEY=your_key
\`\`\`
Or simply pass it securely via the frontend session UI.
