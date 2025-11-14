
import React from 'react';
import { ChatIcon, SearchIcon, MicrophoneIcon } from './icons';

interface WelcomeProps {
  onDismiss: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onDismiss }) => {
  const features = [
    { name: 'ବାର୍ତ୍ତାଳାପ ଏବଂ ଫାଇଲ୍ ବିଶ୍ଳେଷଣ', icon: <ChatIcon /> },
    { name: 'ଖୋଜ ଏବଂ ବିଶ୍ଳେଷଣ', icon: <SearchIcon /> },
    { name: 'ଭଏସ୍ ଚାଟ୍', icon: <MicrophoneIcon /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex justify-center items-center p-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl shadow-2xl p-8 max-w-2xl w-full text-center transform transition-all animate-fade-in-up">
        <h1 className="text-4xl font-bold text-cyan-400 mb-2">ସତ୍ୟଶ୍ରୀ ଆପଣଙ୍କୁ ସ୍ଵାଗତ ଜଣାଉଛି</h1>
        <p className="text-lg text-slate-300 mb-8">ଆପଣଙ୍କ ଓଡ଼ିଆ AI ସହାୟକ</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
          {features.map((feature, index) => (
            <div key={index} className="bg-slate-700/50 p-4 rounded-lg flex items-center gap-3">
              <div className="text-cyan-400">{feature.icon}</div>
              <span className="text-slate-200 text-sm">{feature.name}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity text-lg"
        >
          ଆରମ୍ଭ କରନ୍ତୁ
        </button>
      </div>
       <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Welcome;