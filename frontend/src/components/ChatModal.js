import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon, ClipboardIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';
import 'highlight.js/styles/github-dark.css';

const ChatModal = ({ isOpen, onClose, prompt }) => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [chatId, setChatId] = useState(null);
  const [copied, setCopied] = useState(false);
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

  const handleCopyResponse = useCallback((message) => {
    if (message) {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
        <div className="relative mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-semibold">Chat</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="h-[60vh] overflow-y-auto p-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  msg.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  <div className="relative group">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyResponse(msg.content)}
                        className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ClipboardIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
