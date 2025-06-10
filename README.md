
MeetScript AI is an intelligent Google Meet recording and transcription service that automates meeting participation, provides real-time transcription with speaker diarization, and enables AI-powered querying of meeting content through a Retrieval-Augmented Generation (RAG) system.

## 🚀 Features

### Core Functionality
- **Automated Meeting Joining**: Programmatically joins scheduled Google Meet sessions using Selenium WebDriver
- **Real-time Audio Capture**: Captures live audio from Google Meet sessions using virtual display technology
- **Live Transcription**: Streams audio to Deepgram for real-time, speaker-diarized transcription
- **Persistent Storage**: Securely stores raw meeting audio recordings and transcription data
- **RAG-based Querying**: Enables users to ask questions about meeting content using AI-powered search
- **MCP Integration**: Provides Model Context Protocol (MCP) tools for seamless AI assistant integration

### Technical Capabilities
- **Dockerized Environment**: Runs in isolated containers with virtual display (Xvfb) and audio processing (PulseAudio)
- **HTTP API**: Real-time frontend updates with dynamic status reporting
- **Session Persistence**: Handles Google account authentication with persistent browser profiles
- **Resource Management**: Efficient management of browser contexts and audio streams

## 🏗️ Architecture

The system consists of several integrated components:

1. **Meeting Automation** (`script.py`): Selenium-based Google Meet automation
2. **Real-time Transcription** (`realtime_stream.py`): Deepgram integration for real-time transcription
3. **MCP Server** (`server.py`): FastMCP server providing tool endpoints
4. **MCP Client** (`client.py`): OpenAI-integrated client for AI interactions
5. **Docker Environment**: Containerized execution with virtual display and audio

## 📋 Prerequisites

### Software Requirements
- **Backend:**
  - Python 3.8+ (for local development)
  - Docker and Docker Compose (for containerization)
- **Frontend:**
  - Node.js (version 14 or later recommended)
  - npm or yarn

### API Keys & Credentials
- **Google Account**: Valid Gmail credentials for meeting access
- **Deepgram API Key**: For real-time transcription services
- **OpenAI API Key**: For AI-powered querying functionality

## 🛠️ Installation

### Backend Installation

#### Docker Deployment (Backend)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create an environment file if needed (e.g., copy from an example):
   ```bash
   cp .env.example .env
   ```
3. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

#### Local Development Setup (Backend)
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Ensure you have the required drivers and system dependencies for Google Meet automation.
3. Run the following modules as needed:
   - **MCP Server:**
     ```bash
     python server.py
     ```
   - **Meeting Automation:**
     ```bash
     python script.py
     ```
   - **Real-time Transcription:**
     ```bash
     python realtime_stream.py
     ```

### Frontend Installation

The frontend is a Next.js application located in the `frontend` directory.

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.
4. To build for production:
   ```bash
   npm run build
   ```
5. To start the production server:
   ```bash
   npm run start
   ```
6. To run lint checks:
   ```bash
   npm run lint
   ```

## 🚀 Usage

### Quick Start with Docker

1. **Backend:**
   - cd backend
   - From the `backend` directory, run:
     ```bash
     docker-compose up
     ```
   This will start the MCP server, meeting automation, and transcription services.
2. **Frontend:**
   - In a separate terminal, from the `frontend` directory, run:
     ```bash
     npm run dev
     ```
   The frontend interface will be available at `http://localhost:3000`.


### Available MCP Tools

The system provides the following MCP tools (accessible via the MCP server):

- **`echo_tool`**: Test connectivity and server status
- **`join_google_meet_tool`**: Automate Google Meet joining process
- **`transcribe_google_meet_tool`**: Full meeting transcription with real-time processing
- **`ingest_document`**: insert the meeting transcript as knowledge base into the RAG
- **`search_doc_for_rag_context`**: Query the meeting transcript for context


### Example Queries

Once the MCP server is running on the backend, you can input thee following on the running frontend localhost:3000:
```
"Join the meeting at https://meet.google.com/abc-defg-hij"
"Start transcribing the current meeting for 2 hours"
"What were the main discussion points from the last meeting?"
"Show me all action items mentioned in today's meeting"
```


With this setup, MeetScript AI provides both a robust backend for meeting automation, transcription, and AI querying, as well as a modern Next.js frontend interface—integrating all components into a comprehensive meeting solution.
``` 
