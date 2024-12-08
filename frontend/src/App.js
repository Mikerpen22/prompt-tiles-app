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

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    if (!error.response) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
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
      const response = await fetch(`${API_BASE_URL}/prompts`);
      if (!response.ok) {
        throw new Error('Failed to fetch prompts');
      }
      const data = await response.json();
      
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
      if (selectedCategory) {
        setPrompts(data.filter(p => p.category && p.category.toLowerCase() === selectedCategory.toLowerCase()));
      } else {
        setPrompts(data);
      }
      setError(null);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setError('Error connecting to server. Please make sure the backend is running.');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Prompt Tiles</h1>
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
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
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={() => setIsCreatePromptOpen(true)}
              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Create new prompt"
            >
              <PlusIcon className="h-6 w-6" />
            </motion.button>
            <motion.button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Settings"
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </motion.button>
          </div>
        </div>

        {/* Prompts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="prompt-card group bg-white rounded-lg shadow-sm p-6 
                     hover:shadow-xl hover:bg-gradient-to-br 
                     hover:from-white hover:to-indigo-50
                     border border-transparent hover:border-indigo-100
                     cursor-pointer relative
                     opacity-0 animate-fadeIn"
              onClick={(e) => {
                if (!e.target.closest('button')) {
                  handleChat(prompt);
                }
              }}
              style={{
                animation: 'fadeIn 0.3s ease-out forwards'
              }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold text-gray-900 
                             group-hover:text-indigo-600 transition-colors duration-300
                             select-none">
                    {prompt.title}
                  </h2>
                  {prompt.category && (
                    <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5
                               bg-gradient-to-r from-indigo-50 to-purple-50
                               text-indigo-600 rounded-full select-none
                               border border-indigo-100/50">
                      {prompt.category}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 
                            transition-opacity duration-200">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleChat(prompt)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Chat with this prompt"
                  >
                    <ChatBubbleLeftIcon className="h-5 w-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setEditingPrompt(prompt);
                      setIsEditPromptOpen(true);
                    }}
                    className="text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Edit prompt"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete prompt"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
              <p className="text-gray-600 group-hover:text-gray-700 
                        transition-colors duration-300
                        select-none">
                {prompt.content}
              </p>
            </div>
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
  );
}

export default App;
