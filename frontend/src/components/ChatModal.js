import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon, ClipboardIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import 'highlight.js/styles/github-dark.css';
import { API_BASE_URL } from '../config';
import { motion } from 'framer-motion';

const ChatModal = ({ isOpen, onClose, prompt }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [chatId, setChatId] = useState(null);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Reset state when modal is opened
    if (isOpen) {
      setIsFirstMessage(true);
      setMessages([]);
      setChatId(null);
      setError(null);
      
      // Load most recent chat if it exists
      const loadRecentChat = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/chats/${prompt.id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-ID': sessionStorage.getItem('session_id')
            }
          });
          if (!response.ok) {
            if (response.status === 401) {
              sessionStorage.removeItem('session_id');
              throw new Error('Session expired. Please reconfigure your API key in settings');
            }
            throw new Error('Failed to load chat history');
          }
          const chats = await response.json();
          if (chats.length > 0) {
            const recentChat = chats[0];
            setChatId(recentChat.id);
            setMessages(recentChat.messages);
            setIsFirstMessage(false);
          }
        } catch (error) {
          console.error('Error loading chat history:', error);
          if (error.message.includes('Session expired')) {
            setError('Session expired. Please reconfigure your API key in settings');
            sessionStorage.removeItem('session_id');
          } else {
            setError('Failed to load chat history');
          }
        }
      };
      
      loadRecentChat();
    }
  }, [isOpen, prompt.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) {
        throw new Error('Please configure your API key in settings');
      }

      console.log('Sending chat request:', {
        prompt: isFirstMessage ? prompt.content : '',
        message: userMessage,
        prompt_id: prompt.id,
        chat_id: chatId
      });

      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({
          prompt: isFirstMessage ? prompt.content : '',
          message: userMessage,
          prompt_id: prompt.id,
          chat_id: chatId
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('session_id');
          throw new Error('Session expired. Please reconfigure your API key in settings');
        }
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error('Server error details:', errorData);
          throw new Error(errorData.error || errorData.details || 'Failed to get response from AI');
        } catch (e) {
          console.error('Error parsing error response:', e);
          throw new Error(`Server error (${response.status}): Failed to get response from AI`);
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        console.log('Received chunk:', chunk);
        const lines = chunk.split('\n');

        lines.forEach(line => {
          if (line.trim() === '') return;
          try {
            console.log('Processing line:', line);
            const data = JSON.parse(line);
            console.log('Parsed data:', data);

            if (data.content) {
              aiResponse += data.content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === 'assistant') {
                  lastMessage.content = aiResponse;
                } else {
                  newMessages.push({ role: 'assistant', content: aiResponse });
                }
                return newMessages;
              });
            }
            if (data.error) {
              console.error('Stream error:', data.error);
              console.error('Error details:', data.details);
              throw new Error(data.error);
            }
            if (data.chat_id && isFirstMessage) {
              setChatId(data.chat_id);
              setIsFirstMessage(false);
            }
          } catch (e) {
            console.error('Error parsing stream data:', e);
            console.error('Problematic line:', line);
            if (e.message) {
              setError(e.message);
              setMessages(prev => [...prev, { role: 'error', content: e.message }]);
            }
          }
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError(error.message || 'Failed to get response from AI');
      setMessages(prev => [...prev, { role: 'error', content: error.message || 'Failed to get response from AI' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center p-0">
        <div className="fixed inset-0 bg-black bg-opacity-30 transition-opacity" onClick={onClose} />
        
        <motion.div 
          className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-4/5 md:w-3/4 lg:w-2/3 xl:w-1/2 bg-white rounded-t-xl sm:rounded-xl shadow-xl overflow-hidden"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 sm:px-6 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 line-clamp-1">
              {prompt.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="h-6 w-6 close-icon" />
            </button>
          </div>

          {/* Chat Messages */}
          <div 
            ref={messagesEndRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-[60vh] sm:min-h-0 sm:max-h-[60vh]"
          >
            {/* System Message */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600">{prompt.content}</p>
            </div>

            {/* Chat Messages */}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`group relative flex ${
                  msg.role === 'assistant' ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2 ${
                    msg.role === 'assistant'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm sm:text-base">{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full shadow-sm"
                    >
                      <ClipboardIcon className="h-4 w-4 copy-icon" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="sticky bottom-0 bg-white border-t border-gray-200 p-4"
          >
            <div className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 min-w-0 rounded-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 text-sm sm:text-base"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`flex items-center justify-center rounded-full w-10 h-10 ${
                  !input.trim() || isLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <PaperAirplaneIcon className="h-5 w-5 send-icon" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ChatModal;
