import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2, Trash2, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';
import { AlertModal } from './AlertModal';

const FloatingChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissions, setPermissions] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check permissions on mount
  useEffect(() => {
    if (user && isOpen) {
      checkPermissions();
    }
  }, [user, isOpen]);

  const checkPermissions = async () => {
    try {
      const response = await api.get('/api/chatbot/permissions');
      const perms = response.data.permissions;
      setPermissions(perms);

      // Add welcome message if permissions are already set
      if (perms.enabled && messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: `Hi ${user.username}! 👋 I'm your AI assistant. I can help you query your data, trigger scraping tasks, analyze results, and much more. What would you like to do today?`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    }
  };

  const handlePermissionGrant = async (fullAccess) => {
    try {
      await api.post('/api/chatbot/permissions', { fullAccess });
      setPermissions({ enabled: true, fullAccess });
      setShowPermissionModal(false);
      
      toast.success(
        fullAccess 
          ? 'Full access granted! I can now help you with all tasks.' 
          : 'Read-only access granted. I can query data but won\'t make changes.'
      );

      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: `Hi ${user.username}! 👋 I'm your AI assistant with ${fullAccess ? 'full access' : 'read-only access'} to your data. I can help you query your data, ${fullAccess ? 'trigger scraping tasks, ' : ''}analyze results, and much more. What would you like to do today?`,
        timestamp: new Date()
      }]);
    } catch (error) {
      toast.error('Failed to set permissions');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Check if permissions are set, if not show modal
    if (!permissions?.enabled) {
      setShowPermissionModal(true);
      return;
    }

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await api.post('/api/chatbot/chat', {
        message: inputMessage,
        conversationHistory
      });

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        toolsUsed: response.data.toolsUsed,
        toolResults: response.data.toolResults,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to get response from assistant');
      
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: `Chat cleared! How can I help you today?`,
      timestamp: new Date()
    }]);
    setShowClearModal(false);
    toast.success('Chat history cleared');
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 z-50 group"
          data-testid="open-chatbot-button"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat with AI Assistant
          </div>
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col border border-gray-200 dark:border-gray-700 ${
            isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
          }`}
          data-testid="chatbot-widget"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">AI Assistant</h3>
                <p className="text-xs text-white/80">
                  {permissions?.fullAccess ? 'Full Access' : 'Read-Only'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white/80 hover:text-white transition-colors p-1"
                data-testid="minimize-chatbot-button"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowClearModal(true)}
                className="text-white/80 hover:text-white transition-colors p-1"
                title="Clear chat"
                data-testid="clear-chat-button"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white transition-colors p-1"
                data-testid="close-chatbot-button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`chat-message-${msg.role}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                          : msg.isError
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.toolsUsed && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs opacity-70">🔧 Used tools to fetch data</p>
                        </div>
                      )}
                      <p className="text-xs opacity-60 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-700 rounded-2xl px-4 py-3 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-end gap-2">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    disabled={isLoading || !permissions?.enabled}
                    className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 min-h-[40px] max-h-[120px]"
                    rows={1}
                    data-testid="chat-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim() || !permissions?.enabled}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl p-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="send-message-button"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Permission Modal */}
      <AlertModal
        open={showPermissionModal}
        onOpenChange={setShowPermissionModal}
        title="🤖 AI Assistant Permissions"
        description={
          <div className="space-y-4">
            <p>The AI assistant can help you manage your scraping tasks and analyze data.</p>
            <div className="space-y-2">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <h4 className="font-medium text-sm mb-1">📖 Read-Only Access</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  View data, query runs, and get insights (no modifications)
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-700">
                <h4 className="font-medium text-sm mb-1">🔓 Full Access (Agentic Mode)</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Create tasks, update runs, execute actions, and make autonomous decisions
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You can change this later in settings.
            </p>
          </div>
        }
        onConfirm={() => handlePermissionGrant(true)}
        onCancel={() => handlePermissionGrant(false)}
        confirmText="Grant Full Access"
        cancelText="Read-Only Access"
      />

      {/* Clear Chat Modal */}
      <AlertModal
        open={showClearModal}
        onOpenChange={setShowClearModal}
        title="Clear Chat History?"
        description="This will remove all messages from the current conversation. This action cannot be undone."
        onConfirm={clearChat}
        confirmText="Clear Chat"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
};

export default FloatingChatWidget;
