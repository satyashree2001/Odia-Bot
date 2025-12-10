import React from 'react';
import { ChatIcon, SearchIcon, MicrophoneIcon } from './icons';

interface WelcomeProps {
  onDismiss: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onDismiss }) => {
  const features = [
    { name: 'Engaging Conversations', description: 'Chat about anything in natural, spoken Odia.', icon: <ChatIcon /> },
    { name: 'Real-time Information', description: 'Get up-to-date answers with integrated search.', icon: <SearchIcon /> },
    { name: 'Hands-free Voice Chat', description: 'Talk to OdiaBot with a seamless voice experience.', icon: <MicrophoneIcon /> },
  ];

  return (
    <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-3xl w-full text-center transition-all fade-in dark:bg-gray-800 dark:border-gray-700">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 dark:text-gray-100">Welcome to OdiaBot</h1>
        <p className="text-base sm:text-lg text-gray-600 mb-8 dark:text-gray-400">Your intelligent and empathetic Odia AI Assistant</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
          {features.map((feature, index) => (
            <div key={index} className="p-4 rounded-lg">
              <div className="text-indigo-600 w-8 h-8 mb-2 dark:text-indigo-400">{feature.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-1 dark:text-gray-200">{feature.name}</h3>
              <p className="text-gray-600 text-sm dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-opacity text-base sm:text-lg dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Welcome;