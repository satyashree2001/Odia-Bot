import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (username: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSignIn }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSignIn(username);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50 p-4 dark:bg-black/60"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm relative dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2 dark:text-gray-100">Sign In</h2>
        <p className="text-center text-gray-600 mb-6 dark:text-gray-400">
          ଚାଟ୍ ଇତିହାସ ସଞ୍ଚୟ କରିବାକୁ ଏକ ୟୁଜର୍ ନେମ୍ ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2 dark:text-gray-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username..."
              className="w-full bg-gray-100 text-gray-800 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gray-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-900 disabled:bg-gray-300 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:disabled:bg-gray-500"
            disabled={!username.trim()}
          >
            Sign In
          </button>
        </form>
        <button 
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
    </div>
  );
};

export default AuthModal;