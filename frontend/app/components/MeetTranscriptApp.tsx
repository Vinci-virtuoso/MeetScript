"use client"
import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  MessageCircle, 
  Send, 
  Loader, 
  CheckCircle, 
  AlertCircle,
  Mic,
  Users
} from 'lucide-react';

interface MeetingConfig {
  meetingUrl: string;
  deepgramApiKey: string;
  googleUsername: string;
  googlePassword: string;
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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig>({
    meetingUrl: '',
    deepgramApiKey: '',
    googleUsername: '',
    googlePassword: '',
    duration: 3600
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const statusEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection setup
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
      setIsConnected(true);
      addStatusUpdate('success', 'Connected to server');
    };

    ws.onclose = () => {
      setIsConnected(false);
      addStatusUpdate('error', 'Disconnected from server');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'status_update':
            addStatusUpdate(data.payload.type as StatusUpdate['type'], data.payload.message);
            break;
          case 'transcription_complete':
            addStatusUpdate('success', 'Transcription completed successfully');
            break;
          case 'chat_response':
            const assistantMessage: ChatMessage = {
              id: Date.now().toString(),
              type: 'assistant',
              content: data.payload.response,
              timestamp: new Date()
            };
            setChatMessages(prev => [...prev, assistantMessage]);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      addStatusUpdate('error', 'WebSocket connection error');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

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

  const handleStartMeeting = async () => {
    if (!socket || !meetingConfig.meetingUrl || !meetingConfig.deepgramApiKey) {
      addStatusUpdate('error', 'Please fill in all required fields');
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      addStatusUpdate('error', 'WebSocket connection not ready');
      return;
    }

    setIsProcessing(true);
    addStatusUpdate('info', 'Initiating meeting join and transcription...');

    try {
      const message = {
        type: 'start_transcription',
        payload: meetingConfig
      };
      socket.send(JSON.stringify(message));
    } catch (error) {
      addStatusUpdate('error', `Failed to start transcription: ${error}`);
      setIsProcessing(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;
    if (socket && isConnected) {
      // Send chat query to the MCP server via WebSocket
      socket.send(JSON.stringify({ type: 'chat_query', payload: { query: currentMessage } }));
      // Add the user's message to the chat area immediately
      const newChatMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: currentMessage,
        timestamp: new Date()
      };
      setChatMessages((prev) => [...prev, newChatMessage]);
      setCurrentMessage('');
    } else {
      addStatusUpdate('error', 'Not connected to server');
    }
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
      <div className={`${isSidePanelOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white shadow-lg overflow-hidden`}>
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Meeting Controls</h2>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Username</label>
              <input
                type="email"
                value={meetingConfig.googleUsername}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, googleUsername: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@gmail.com"
                disabled={isProcessing}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Password</label>
              <input
                type="password"
                value={meetingConfig.googlePassword}
                onChange={(e) => setMeetingConfig(prev => ({ ...prev, googlePassword: e.target.value }))}
                className="w-full px-3 py-2 text-black border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your password"
                disabled={isProcessing}
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
              disabled={isProcessing || !isConnected}
              className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center gap-2 transition-colors ${
                isProcessing || !isConnected
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
                  Join Meeting & Extract Transcript
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Status Updates */}
        
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Status Updates</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">MeetScript 2.0</h1>
          </div>
          {/*
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          */}
        </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
          {/* Messages */}
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
                  className={`flex ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
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
                      className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          {/* Chat Input Form */}
          <form onSubmit={handleSendMessage} className="flex items-center p-4 border-t">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              className="flex-grow p-2 border rounded shadow-sm text-black"
            />
            <button
              type="submit"
              className="ml-2 p-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}