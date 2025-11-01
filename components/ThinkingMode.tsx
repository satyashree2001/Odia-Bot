import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { runComplexQuery, analyzeVideoUrl } from '../services/geminiService';
import { SparklesIcon } from './icons';

interface Turn {
  role: 'user' | 'model';
  text: string;
}

const isValidUrl = (text: string): boolean => {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return false;
    }
    try {
        new URL(text);
        return true;
    } catch (_) {
        return false;
    }
};

const ThinkingMode: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    
    const isVideoUrl = isValidUrl(prompt.trim());
    const currentPrompt = prompt.trim();
    const historyForApi = [...conversation];
    const newUserTurn: Turn = { role: 'user', text: currentPrompt };
    const botPlaceholder: Turn = { role: 'model', text: '' };

    setConversation(prev => [...prev, newUserTurn, botPlaceholder]);
    setPrompt('');

    try {
      const onChunk = (chunk: string) => {
        setConversation(prev => {
            const newConversation = [...prev];
            const lastTurn = newConversation[newConversation.length - 1];
            if (lastTurn && lastTurn.role === 'model') {
                lastTurn.text += chunk;
            }
            return newConversation;
        });
      };

      let finalResponse = '';
      if (isVideoUrl) {
        finalResponse = await analyzeVideoUrl(historyForApi, currentPrompt, onChunk);
      } else {
        finalResponse = await runComplexQuery(historyForApi, currentPrompt, onChunk);
      }
      setConversation(prev => prev.map((turn, index) => 
        index === prev.length - 1 ? { ...turn, text: finalResponse } : turn
      ));
    } catch (error) {
      // Error is streamed into the response by the service
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full flex-grow bg-slate-800/50 rounded-lg shadow-xl overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {conversation.length === 0 && !isLoading && (
            <div className="flex flex-col justify-center items-center h-full text-center text-slate-400">
                <SparklesIcon />
                <p className="mt-2">ଜଟିଳ କାର୍ଯ୍ୟଗୁଡ଼ିକ ପାଇଁ ଏହି ମୋଡ୍ ବ୍ୟବହାର କରନ୍ତୁ।</p>
                <p className="text-sm mt-1">ଆପଣ ବିଶ୍ଳେଷଣ ପାଇଁ ଏକ ଭିଡିଓ URL ମଧ୍ୟ ପେଷ୍ଟ କରିପାରିବେ।</p>
            </div>
        )}
        {conversation.map((turn, index) => (
          <div key={index}>
            <div className={`flex items-end gap-3 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               {turn.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-cyan-400">
                    <SparklesIcon />
                  </div>
                )}
              <div className={`max-w-xl p-4 rounded-2xl shadow-md ${turn.role === 'user' ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-md' : 'bg-slate-700 text-slate-200 rounded-bl-md'}`}>
                <p className="text-[15px] whitespace-pre-wrap" style={{lineHeight: '1.625'}}>{turn.text}</p>
                 {turn.role === 'model' && isLoading && conversation[conversation.length-1] === turn && !turn.text && (
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping ml-2 inline-block"></div>
                )}
              </div>
              {turn.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center font-bold text-white text-lg">
                    ଆ
                  </div>
                )}
            </div>
          </div>
        ))}
         <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-slate-800/70 rounded-b-lg border-t border-slate-700/50">
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ଆପଣଙ୍କର ଜଟିଳ ପ୍ରଶ୍ନ, କାର୍ଯ୍ୟ, କିମ୍ବା ଭିଡିଓ URL ଏଠାରେ ଲେଖନ୍ତୁ..."
            className="w-full bg-slate-700 text-white rounded-lg p-3 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full mt-2 bg-cyan-500 text-white p-3 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <SparklesIcon />
            <span>ବିଶ୍ଳେଷଣ ପାଇଁ ପଠାନ୍ତୁ</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ThinkingMode;
