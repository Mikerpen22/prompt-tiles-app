import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/solid';

const API_BASE_URL = 'http://127.0.0.1:5001';

const Settings = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    // Check if we have a valid session
    const sessionId = sessionStorage.getItem('session_id');
    if (sessionId) {
      setMessage({ text: 'API key is configured', type: 'success' });
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/settings/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store session ID in sessionStorage (more secure than localStorage)
        sessionStorage.setItem('session_id', data.session_id);
        setMessage({ text: 'API key saved successfully!', type: 'success' });
        setApiKey(''); // Clear the API key from memory
        setTimeout(() => onClose(), 1500);
      } else {
        setMessage({ text: data.error || 'Failed to save API key', type: 'error' });
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      setMessage({ 
        text: 'Error connecting to server. Please make sure the backend is running.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50" />

        <div className="relative bg-white w-full max-w-md mx-4 p-6 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Gemini API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                  transition-all duration-300"
                placeholder="Enter your API key"
              />
              <p className="mt-1 text-sm text-gray-500">
                Your API key is encrypted and stored securely on the server.
              </p>
            </div>

            {message.text && (
              <div
                className={`p-3 rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md
                         hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                         focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !apiKey}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md
                         hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2
                         focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
