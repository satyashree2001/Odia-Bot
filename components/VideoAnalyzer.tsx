import React from 'react';
import { useState } from 'react';
import { analyzeVideoUrl } from '../services/geminiService';
import { SendIcon } from './icons';

const VideoAnalyzer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    setError(null);
    try {
      new URL(url);
    } catch (_) {
      setError("ଦୟାକରି ଏକ ବୈଧ URL ପ୍ରବେଶ କରନ୍ତୁ।");
      return;
    }

    setIsLoading(true);
    setSummary('');

    try {
      const onChunk = (chunk: string) => {
        setSummary(prev => (prev || '') + chunk);
      };
      await analyzeVideoUrl(url, onChunk);
    } catch (error) {
       // Error is streamed into the summary box by the service
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-800/50 rounded-lg shadow-xl">
      <div className="flex-grow p-4 overflow-y-auto">
        {summary === null && !isLoading && !error && (
           <div className="flex flex-col justify-center items-center h-full text-center text-slate-400">
             <h2 className="text-2xl font-bold text-cyan-400 mb-2">ଭିଡିଓ ବିଶ୍ଳେଷଣ</h2>
             <p>ଏକ ଭିଡିଓ ଲିଙ୍କ୍ ପେଷ୍ଟ୍ କରନ୍ତୁ ଏବଂ ସତ୍ୟଶ୍ରୀ ଏହାର ଏକ ସାରାଂଶ ପ୍ରଦାନ କରିବ।</p>
             <p className="text-sm mt-1">(Paste a video link and Satyashree will provide a summary)</p>
           </div>
        )}
        {isLoading && summary === '' && (
            <div className="flex flex-col justify-center items-center h-full text-center text-slate-300">
                <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-cyan-500"></div>
                <p className="mt-4">ଭିଡିଓ ବିଶ୍ଳେଷଣ କରୁଛି...</p>
                <p className="text-sm text-slate-400">ଏଥିରେ କିଛି ସମୟ ଲାଗିପାରେ।</p>
            </div>
        )}
        {summary !== null && (
          <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-700">
            <h3 className="font-bold text-cyan-400 mb-3 text-lg">ସାରାଂଶ:</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
            {isLoading && (
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping ml-2 inline-block"></div>
            )}
          </div>
        )}
         {error && (
            <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">
                <p>{error}</p>
            </div>
        )}
      </div>
      <div className="p-4 bg-slate-800/70 rounded-b-lg">
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ଏଠାରେ ଭିଡିଓ URL ପେଷ୍ଟ୍ କରନ୍ତୁ..."
            className="flex-grow bg-slate-700 text-white rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="bg-cyan-500 text-white p-3 rounded-full hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
};

export default VideoAnalyzer;
