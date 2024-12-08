import React, { useState, useRef, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import 'highlight.js/styles/github-dark.css';

const ChatModal = ({ isOpen, onClose, prompt }) => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [chatId, setChatId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
      
      // Load most recent chat if it exists
      const loadRecentChat = async () => {
        try {
          const response = await fetch(`http://127.0.0.1:5001/chats/${prompt.id}`);
          if (response.ok) {
            const chats = await response.json();
            if (chats.length > 0) {
              const recentChat = chats[0];
              setChatId(recentChat.id);
              setMessages(recentChat.messages);
              setIsFirstMessage(false);
            }
          }
        } catch (error) {
          console.error('Error loading chat history:', error);
        }
      };
      
      loadRecentChat();
    }
  }, [isOpen, prompt.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const sessionId = sessionStorage.getItem('session_id');
      if (!sessionId) {
        throw new Error('Please configure your API key in settings');
      }

      const response = await fetch('http://127.0.0.1:5001/chat/stream', {
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
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem('session_id');
          throw new Error('Session expired. Please reconfigure your API key in settings');
        }
        throw new Error('Failed to get response from AI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const text = line.slice(6);
            aiResponse += text;
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.content = aiResponse;
              } else {
                newMessages.push({ role: 'assistant', content: aiResponse });
              }
              return newMessages;
            });
          }
        }
      }
      
      // Set isFirstMessage to false after first successful message
      if (isFirstMessage) {
        setIsFirstMessage(false);
        
        // Get the new chat ID
        const chatsResponse = await fetch(`http://127.0.0.1:5001/chats/${prompt.id}`);
        if (chatsResponse.ok) {
          const chats = await chatsResponse.json();
          if (chats.length > 0) {
            setChatId(chats[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your request.' 
      }]);
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

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black opacity-30" />
        
        <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-800">{prompt.title}</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 
                transition-all duration-300 hover:shadow-md hover:scale-110"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Prompt Display */}
          <div className="p-6 bg-gray-50 border-b">
            <h3 className="font-medium text-gray-700">Prompt Template:</h3>
            <p className="mt-1 text-gray-600">{prompt.content}</p>
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-3xl p-4 rounded-2xl shadow-md transition-all duration-300 hover:shadow-lg
                    ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      className="prose max-w-none"
                      components={{
                        code({node, inline, className, children, ...props}) {
                          return (
                            <code
                              className={`${className} rounded-xl bg-gray-800 text-gray-100 p-1`}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-4 rounded-2xl shadow-md animate-pulse">
                  <div className="h-4 w-20 bg-gray-300 rounded-xl" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t">
            <form onSubmit={handleSubmit} className="flex space-x-4">
              <textarea
                ref={textareaRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  transition-all duration-300 hover:border-blue-400 hover:shadow-md"
              />
              <button
                type="submit"
                disabled={isLoading || !currentMessage.trim()}
                className={`px-6 py-2 rounded-xl text-white font-medium
                  transition-all duration-300 hover:shadow-md hover:scale-105
                  ${
                    isLoading || !currentMessage.trim()
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ChatModal;
