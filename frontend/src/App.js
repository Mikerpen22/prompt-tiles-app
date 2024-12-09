import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from './config';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  PlusIcon,
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import CreatePromptModal from './components/CreatePromptModal';
import EditPromptModal from './components/EditPromptModal';
import Settings from './components/Settings';
import ChatModal from './components/ChatModal';
import { useTranslation } from 'react-i18next';
import './i18n';  // Import i18n configuration
import SEO from './components/SEO';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to include session ID
api.interceptors.request.use((config) => {
  const sessionId = sessionStorage.getItem('session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('session_id');
      return Promise.reject(new Error('Session expired. Please configure your API key in settings.'));
    }
    return Promise.reject(error);
  }
);

const categoryVariants = {
  selected: {
    backgroundColor: "rgb(224 231 255)",
    color: "rgb(67 56 202)",
    transition: { duration: 0.2 }
  },
  unselected: {
    backgroundColor: "transparent",
    color: "rgb(75 85 99)",
    transition: { duration: 0.2 }
  }
};

function App() {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState([]);
  const [error, setError] = useState(null);
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState(new Set(['General']));
  const [allPrompts, setAllPrompts] = useState([]);

  const fetchPrompts = useCallback(async () => {
    try {
      console.log('Fetching prompts...'); // Debug log
      console.log('Session ID:', sessionStorage.getItem('session_id')); // Debug log
      const response = await api.get('/prompts');
      const data = response.data;
      
      // Store all prompts
      setAllPrompts(data);
      
      // Update categories
      const newCategories = new Set(['General']);
      data.forEach(prompt => {
        if (prompt.category) {
          newCategories.add(prompt.category);
        }
      });
      setCategories(newCategories);
      
      // Filter prompts if category is selected
      if (selectedCategory && selectedCategory !== 'General') {
        setPrompts(data.filter(prompt => prompt.category === selectedCategory));
      } else {
        setPrompts(data);
      }
      
      setError(null);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setError(error.message || 'Failed to fetch prompts');
      if (error.message.includes('Session expired')) {
        setIsSettingsOpen(true);
      }
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  useEffect(() => {
    if (selectedCategory) {
      setPrompts(allPrompts.filter(p => p.category && p.category.toLowerCase() === selectedCategory.toLowerCase()));
    } else {
      setPrompts(allPrompts);
    }
  }, [selectedCategory, allPrompts]);

  const handleCategoryClick = (category) => {
    setSelectedCategory(prev => prev === category ? '' : category);
  };

  const handleCreatePrompt = async (newPrompt) => {
    try {
      const response = await api.post('/prompts', newPrompt);
      setPrompts(prevPrompts => [response.data, ...prevPrompts]);
      
      // Update categories
      setCategories(prev => {
        const newCategories = new Set(prev);
        if (response.data.category) {
          newCategories.add(response.data.category);
        }
        return newCategories;
      });
      
      setError(null);
      setIsCreatePromptOpen(false);
    } catch (error) {
      setError('Failed to create prompt');
    }
  };

  const handleUpdatePrompt = async (promptId, updatedPrompt) => {
    try {
      const response = await api.put(`/prompts/${promptId}`, updatedPrompt);
      
      // Update prompts list
      setPrompts(prevPrompts => prevPrompts.map(p => p.id === promptId ? response.data : p));
      
      // Update all prompts
      setAllPrompts(prev => prev.map(p => p.id === promptId ? response.data : p));
      
      // Update categories
      setCategories(prev => {
        const newCategories = new Set(prev);
        if (response.data.category) {
          newCategories.add(response.data.category);
        }
        return newCategories;
      });
      
      setError(null);
      setIsEditPromptOpen(false);
      setEditingPrompt(null);
    } catch (error) {
      setError('Failed to update prompt');
    }
  };

  const handleDeletePrompt = async (promptId) => {
    if (!window.confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await api.delete(`/prompts/${promptId}`);
      
      // Remove the prompt from the list
      const updatedPrompts = prompts.filter(p => p.id !== promptId);
      setPrompts(updatedPrompts);
      
      // Update all prompts
      setAllPrompts(prev => prev.filter(p => p.id !== promptId));
      
      // Update categories based on remaining prompts
      const remainingCategories = new Set(['General']);
      updatedPrompts.forEach(prompt => {
        if (prompt.category) {
          remainingCategories.add(prompt.category);
        }
      });
      setCategories(remainingCategories);
      
      setError(null);
    } catch (error) {
      setError('Failed to delete prompt');
    }
  };

  const handleChat = (prompt) => {
    setSelectedPrompt(prompt);
    setIsChatOpen(true);
  };

  const handleChatClick = (prompt) => {
    setSelectedPrompt(prompt);
    setIsChatOpen(true);
  };

  const handleEditClick = (prompt) => {
    setEditingPrompt(prompt);
    setIsEditPromptOpen(true);
  };

  const handleDeleteClick = (prompt) => {
    handleDeletePrompt(prompt.id);
  };

  return (
    <>
      <SEO />
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 sm:mb-0">
              {t('title')}
            </h1>
            <div className="flex space-x-4">
              <motion.a
                href="https://paypal.me/bemypally?country.x=TW&locale.x=en_US"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[#003087] text-white hover:bg-[#003087]/90 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Support via PayPal"
              >
                <img src="/paypal-logo.svg" alt="PayPal" className="w-5 h-5 brightness-200" />
              </motion.a>
              <motion.button
                onClick={() => setIsCreatePromptOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                title="Create new prompt"
              >
                <PlusIcon className="h-6 w-6 nav-icon" />
              </motion.button>
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 text-white shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                title="Settings"
              >
                <Cog6ToothIcon className="h-6 w-6 nav-icon" />
              </motion.button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <motion.button
                onClick={() => handleCategoryClick('')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium`}
                variants={categoryVariants}
                animate={!selectedCategory ? 'selected' : 'unselected'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                All
              </motion.button>
              {Array.from(categories).map(category => (
                <motion.button
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium`}
                  variants={categoryVariants}
                  animate={selectedCategory === category ? 'selected' : 'unselected'}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {category}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Prompt Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {prompts.map((prompt) => (
              <motion.div
                key={prompt.id}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 relative group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ y: -5 }}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 pr-24 line-clamp-2">
                    {prompt.title}
                  </h3>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleChatClick(prompt)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50"
                      title="Chat with this prompt"
                    >
                      <ChatBubbleLeftIcon className="h-5 w-5 action-icon" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEditClick(prompt)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50"
                      title="Edit prompt"
                    >
                      <PencilIcon className="h-5 w-5 action-icon" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteClick(prompt)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                      title="Delete prompt"
                    >
                      <TrashIcon className="h-5 w-5 action-icon" />
                    </motion.button>
                  </div>
                </div>
                <p className="text-gray-600 line-clamp-3 text-sm sm:text-base">
                  {prompt.content}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                    {prompt.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(prompt.created_at).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <style jsx global>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            .prompt-card {
              transition: all 0.3s ease-out;
            }
          `}</style>

          <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          
          <CreatePromptModal
            isOpen={isCreatePromptOpen}
            onClose={() => setIsCreatePromptOpen(false)}
            onCreatePrompt={handleCreatePrompt}
          />

          <EditPromptModal
            isOpen={isEditPromptOpen}
            onClose={() => {
              setIsEditPromptOpen(false);
              setEditingPrompt(null);
            }}
            prompt={editingPrompt}
            onUpdatePrompt={handleUpdatePrompt}
          />

          {selectedPrompt && (
            <ChatModal
              isOpen={isChatOpen}
              onClose={() => {
                setIsChatOpen(false);
                setSelectedPrompt(null);
              }}
              prompt={selectedPrompt}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
