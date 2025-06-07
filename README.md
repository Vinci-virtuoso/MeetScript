# MeetScript AI 2.0

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
- **Dockerized Environment**: Runs in isolated containers with virtual display (Xvfb) and audio processing (FFmpeg)
- **WebSocket Communication**: Real-time frontend updates with dynamic status reporting
- **Session Persistence**: Handles Google account authentication with persistent browser profiles
- **Resource Management**: Efficient management of browser contexts and audio streams
- **Scalable Architecture**: Designed to handle multiple concurrent meeting recordings

## 🏗️ Architecture

The system consists of several integrated components:

1. **Meeting Automation** (`script.py`): Selenium-based Google Meet automation
2. **Real-time Transcription** (`realtime_stream.py`): Deepgram integration for live transcription
3. **MCP Server** (`server.py`): FastMCP server providing tool endpoints
4. **MCP Client** (`client.py`): OpenAI-integrated client for AI interactions
5. **Docker Environment**: Containerized execution with virtual display and audio

## 📋 Prerequisites

Before using MeetScript AI, ensure you have the following:

### Required Software
- Docker and Docker Compose
- Python 3.8+ (for local development)
- Microsoft Edge WebDriver (automatically handled in Docker)

### API Keys & Credentials
- **Google Account**: Valid Gmail credentials for meeting access
- **Deepgram API Key**: For real-time transcription services
- **OpenAI API Key**: For AI-powered querying functionality

## 🛠️ Installation

### Docker Deployment (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd meetscript-ai
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables in `.env`:**
   ```bash
   MEET_URL=https://meet.google.com/your-meeting-id
   GOOGLE_USERNAME=your-email@gmail.com
   GOOGLE_PASSWORD=your-password
   DEEPGRAM_API_KEY=your-deepgram-api-key
   OPENAI_API_KEY=your-openai-api-key
   MCP_SERVER_HOST=0.0.0.0
   MCP_SERVER_PORT=8000
   GROUNDX_API_KEY=your-groundx-api-key
   ```

4. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

### Local Development Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Microsoft Edge WebDriver:**
   - Download from [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)
   - Ensure the driver is in your system PATH

3. **Set up virtual display (Linux/macOS):**
   ```bash
   # Install Xvfb
   sudo apt-get install xvfb  # Ubuntu/Debian
   # or
   brew install xvfb  # macOS with Homebrew
   ```

## 🚀 Usage

### Quick Start with Docker

1. **Start the services:**
   ```bash
   docker-compose up
   ```

2. **The system will automatically:**
   - Join the specified Google Meet
   - Start real-time transcription
   - Provide MCP tools at `http://localhost:8000/sse`

### Manual Operation

1. **Start the MCP server:**
   ```bash
   python server.py
   ```

2. **Run meeting automation:**
   ```bash
   python script.py
   ```

3. **Use MCP client for AI queries:**
   ```bash
   python client.py http://localhost:8000/sse
   ```

### Available MCP Tools

The system provides the following MCP tools:

- **`echo_tool`**: Test connectivity and server status
- **`join_google_meet_tool`**: Automate Google Meet joining process
- **`transcribe_google_meet_tool`**: Full meeting transcription with real-time processing
- **`search_doc_for_rag_context`**: Using the available transcript file as RAG context to query for meeting context

### Example Queries

Once connected to the MCP client, you can ask:

```
"Join the meeting at https://meet.google.com/abc-defg-hij"
"Start transcribing the current meeting for 2 hours"
"What were the main discussion points from the last meeting?"
"Show me all action items mentioned in today's meeting"
```

### Audio Configuration

The system automatically configures audio capture through:
- **Virtual Audio Sink**: PulseAudio null sink for audio routing
- **Sample Rate**: 16kHz for optimal Deepgram processing
- **Format**: 16-bit PCM for high-quality transcription

### Browser Configuration

Selenium WebDriver is configured with:
- Persistent user profiles for session management
- Disabled media permissions prompts
- Optimized for headless operation in Docker

## 📊 Output Formats

### Transcription Output
- **Real-time**: Live text streaming during meetings
- **Timestamped**: Precise timing information for each utterance
- **Speaker Diarization**: Identification of different speakers
- **Multiple Formats**: Text, VTT, and SRT subtitle formats

### Storage
- **Audio**: Raw meeting recordings in WAV format
- **Transcripts**: Structured text files with timestamps

