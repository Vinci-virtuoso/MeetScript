"use client"
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  MessageCircle, 
  Send, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  Users,
  Upload
} from 'lucide-react';

interface MeetingConfig {
  meetingUrl: string;
  deepgramApiKey: string;
  googleUsername: string;
  googlePassword: string;
  openaiApiKey: string;
  groundXApiKey: string;
  duration: number;
}

interface StatusUpdate {
  type: 'info' | 'success' | 'error' | 'progress';
  message: string;
  timestamp: Date;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function MeetTranscriptApp() {
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [data, setData] = useState(null);
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig>({
    meetingUrl: '',
    deepgramApiKey: '',
    googleUsername: 'badbunnyvinc@gmail.com',
    googlePassword: 'Iaminevitable',
    openaiApiKey: '',
    groundXApiKey: '',
    duration: 3600
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const statusEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll for chat and status updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    statusEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [statusUpdates]);

  const addStatusUpdate = (type: StatusUpdate['type'], message: string) => {
    const update: StatusUpdate = {
      type,
      message,
      timestamp: new Date()
    };
    setStatusUpdates(prev => [...prev, update]);
  };

  // Handler for "Join Meeting & Extract Transcript" button using HTTP fetch to transcribe endpoint
  const handleStartMeeting = async () => {
    if (!meetingConfig.meetingUrl || !meetingConfig.deepgramApiKey) {
      addStatusUpdate('error', 'Please fill in all required fields');
      return;
    }
    setIsProcessing(true);
    addStatusUpdate('info', 'Initiating meeting join and transcription...');
    try {
      const res = await fetch('https://backend-meetscript.onrender.com/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_url: meetingConfig.meetingUrl,
          google_username: meetingConfig.googleUsername,
          google_password: meetingConfig.googlePassword,
          deepgram_api_key: meetingConfig.deepgramApiKey,
          meeting_duration: meetingConfig.duration
        })
      });
      const data = await res.json();
      if (data.success) {
        addStatusUpdate('success', 'Transcription completed successfully');
      } else {
        addStatusUpdate('error', `Transcription failed: ${data.error}`);
      }
    } catch (error) {
      addStatusUpdate('error', `Failed to start transcription: ${error}`);
    }
    setIsProcessing(false);
  };

  // Handler for "Upload" button using HTTP fetch to ingest endpoint
  const handleUploadTranscript = async () => {
    addStatusUpdate("info", "Sending ingest transcript request...");
    try {
      const transcriptPath='transcript.txt';
      const res = await fetch('https://backend-meetscript.onrender.com/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: transcriptPath,
          groundx_api_key: meetingConfig.groundXApiKey // Ensure this is included
        })
      });
      const data = await res.json();
      if (data.success) {
        addStatusUpdate("success", data.message);
      } else {
        addStatusUpdate("error", "Failed to ingest transcript");
      }
    } catch (error) {
      addStatusUpdate("error", `Failed to ingest transcript: ${error}`);
    }
  };

  // Handler for chat send button using HTTP fetch to search endpoint
  const formatSearchResult = (result: any): string => {
    if (result && typeof result === 'object') {
      if (result.summary || result.actionable_items) {
        let output = `Summary: ${result.summary}\n\nActionable Items:\n`;
        result.actionable_items.forEach((item: any, index: number) => {
          output += `\n${index + 1}. Task: ${item.description}\n`;
          output += `   Assignees: ${item.assignees && item.assignees.length > 0 ? item.assignees.join(", ") : "None"}\n`;
          output += `   Dates: ${item.dates && item.dates.length > 0 ? item.dates.join(", ") : "None"}\n`;
        });
        return output;
      }
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;
  
    // Append user message to chat area
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userMessage]);
  
    try {
      const res = await fetch('https://backend-meetscript.onrender.com/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentMessage,
          openai_api_key: meetingConfig.openaiApiKey, // Ensure this is included
          groundx_api_key: meetingConfig.groundXApiKey // Ensure this is included
        })
      });
      const data = await res.json();
  
      // Log the response to verify its content
      console.log('Response from server:', data);
  
      // Format structured response if necessary
      let assistantContent = '';
      if (typeof data.result === 'object') {
        assistantContent = formatSearchResult(data.result);
      } else {
        assistantContent = data.result || 'No response received. Please provide your OpenAI API key';
      }
  
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      addStatusUpdate("error", `Chat query failed: ${error}`);
    }
    setCurrentMessage('');
  };

  const getStatusIcon = (type: StatusUpdate['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'progress': return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Side Panel */}
      <div className="w-80 h-screen bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Meeting Controls</h2>
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          {/* Meeting Configuration Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting URL *</label>
              <input
                type="url"
                value={meetingConfig.meetingUrl}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, meetingUrl: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://meet.google.com/..."
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deepgram API Key *</label>
              <input
                type="password"
                value={meetingConfig.deepgramApiKey}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, deepgramApiKey: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your Deepgram API key"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key *</label>
              <input
                type="password"
                value={meetingConfig.openaiApiKey}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your OpenAI API key"
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GroundX API Key *</label>
              <input
                type="password"
                value={meetingConfig.groundXApiKey}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, groundXApiKey: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your GroundX API key"
                disabled={isProcessing}
              />
            </div>
            <div style={{ display: 'none' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Username</label>
              <input
                type="email"
                value="badbunnyvinc"
                readOnly
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                placeholder="badbunnyvinc@gmail.com"
                disabled
              />
            </div>
            <div style={{ display: 'none' }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Password</label>
              <input
                type="password"
                value="Iaminevitable"
                readOnly
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                placeholder="Iaminevitable"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
              <input
                type="number"
                value={meetingConfig.duration}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, duration: parseInt(e.target.value) || 3600 }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="60"
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={handleStartMeeting}
              disabled={isProcessing}
              className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
                isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Join Meeting &amp; Extract Transcript
                </>
              )}
            </button>
          </div>
        </div>
     {/* Status Updates */}
     <div className="p-6 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {statusUpdates.map((update, index) => (
            <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
              {getStatusIcon(update.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{update.message}</p>
                <p className="text-xs text-gray-500">{update.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          <div ref={statusEndRef} />
        </div>
      </div>
    </div>
    {/* Main Content Area */}
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">MeetScript 2.0</h1>
        </div>
      </div>
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Ask questions about your meeting transcript</p>
              <p className="text-sm mt-2">
                Start a meeting to begin transcription, then ask questions here
              </p>
            </div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <p
                    className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'}`}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center p-2 border-t bg-white">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            className="flex-grow p-2 border rounded shadow-sm text-black"
          />
          <button type="submit" className="ml-2 p-2 bg-blue-600 text-white rounded hover:bg-blue-500">
            <Send className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleUploadTranscript}
            className="ml-2 p-2 bg-blue-200 text-white rounded hover:bg-blue-500"
          >
            <Upload className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  </div>
);
}