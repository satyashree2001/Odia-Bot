
import React from 'react';
import { useState } from 'react';
import { runComplexQuery } from '../services/geminiService';
import { SparklesIcon } from './icons';

const ThinkingMode: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');

    try {
      const onChunk = (chunk: string) => {
        setResponse(prev => (prev || '') + chunk);
      };
      const finalResponse = await runComplexQuery(prompt, onChunk);
      setResponse(finalResponse);
    } catch (error) {
      // Error is streamed into the response by the service
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full flex-grow bg-slate-800/50 rounded-lg shadow-xl overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto">
        {response === null && !isLoading && (
            <div className="flex justify-center items-center h-full text-slate-400">
                <p>ଜଟିଳ କାର୍ଯ୍ୟଗୁଡ଼ିକ ପାଇଁ ଏହି ମୋଡ୍ ବ୍ୟବହାର କରନ୍ତୁ।</p>
            </div>
        )}
        {response !== null && (
          <div className="bg-slate-700 p-4 rounded-lg">
            <p className="whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </div>
      <div className="p-4 bg-slate-800/70 rounded-b-lg">
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ଆପଣଙ୍କର ଜଟିଳ ପ୍ରଶ୍ନ କିମ୍ବା କାର୍ଯ୍ୟ ଏଠାରେ ଲେଖନ୍ତୁ..."
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