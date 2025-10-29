
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-sm m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-center text-cyan-400 mb-4">Sign In</h2>
        <p className="text-center text-slate-300 mb-6">
          ଚାଟ୍ ଇତିହାସ ସଞ୍ଚୟ କରିବାକୁ ଏକ ୟୁଜର୍ ନେମ୍ ସହିତ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-slate-400 text-sm font-bold mb-2">
              ୟୁଜର୍ ନେମ୍
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ଆପଣଙ୍କ ୟୁଜର୍ ନେମ୍..."
              className="w-full bg-slate-700 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 transition-colors"
            disabled={!username.trim()}
          >
            Sign In
          </button>
        </form>
        <button 
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-white"
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
