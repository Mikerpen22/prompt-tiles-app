import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';

function CreatePromptModal({ isOpen, onClose, onCreatePrompt }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreatePrompt({ title, content, category });
    setTitle('');
    setContent('');
    setCategory('General');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    setCategory('General');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Prompt</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              rows="4"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm p-2
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md
                       hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                       focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2
                       focus:ring-indigo-500"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePromptModal;
