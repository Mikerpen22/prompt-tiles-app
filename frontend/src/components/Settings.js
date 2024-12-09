import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { API_BASE_URL } from '../config';

const Settings = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Check if we have a valid session
    const sessionId = sessionStorage.getItem('session_id');
    if (sessionId) {
      setMessage({ text: 'API key is configured', type: 'success' });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/configure-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (response.ok && data.session_id) {
        // Store session ID in sessionStorage
        sessionStorage.setItem('session_id', data.session_id);
        setMessage({ text: 'API key configured successfully!', type: 'success' });
        setApiKey(''); // Clear the API key from memory
        onClose();
      } else {
        setMessage({ text: data.error || 'Failed to configure API key', type: 'error' });
      }
    } catch (error) {
      console.error('Error configuring API key:', error);
      setMessage({ text: 'Failed to configure API key', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6 close-icon" />
          </button>
        </div>

        <div className="mt-2">
          <div className="mb-4">
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700"
            >
              Gemini API Key
            </label>
            <div className="mt-1">
              <input
                type="password"
                name="apiKey"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Enter your API key"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Your Gemini API key is stored securely in your browser's session storage.
              Get your API key from the <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">Google AI Studio</a>.
            </p>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <button
              type="submit"
              disabled={!apiKey}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                !apiKey
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Configure API Key
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
