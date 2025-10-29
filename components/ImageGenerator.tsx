
import React from 'react';
import { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { CameraIcon } from './icons';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setImageUrl(null);
    setError(null);

    try {
      const base64Image = await generateImage(prompt);
      setImageUrl(`data:image/png;base64,${base64Image}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full flex-grow bg-slate-800/50 rounded-lg shadow-xl overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto flex justify-center items-center">
        {isLoading ? (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-500 mx-auto"></div>
            <p className="mt-4 text-slate-300">ଚିତ୍ର ସୃଷ୍ଟି କରୁଛି...</p>
          </div>
        ) : error ? (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
                <p><strong>ତ୍ରୁଟି</strong></p>
                <p>{error}</p>
            </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Generated image" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
        ) : (
           <div className="text-center text-slate-400">
                <CameraIcon />
                <h2 className="text-2xl mt-2">ଚିତ୍ର ସୃଷ୍ଟି</h2>
                <p>ଏକ ଚିତ୍ର ସୃଷ୍ଟି କରିବାକୁ ନିମ୍ନରେ ଏକ ପ୍ରମ୍ପ୍ଟ୍ ଲେଖନ୍ତୁ।</p>
            </div>
        )}
      </div>
      <div className="p-4 bg-slate-800/70 rounded-b-lg">
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ଯେପରି: ଏକ ନୀଳ ଘୋଡା ଚନ୍ଦ୍ରରେ ଦୌଡୁଛି..."
            className="w-full bg-slate-700 text-white rounded-lg p-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full mt-2 bg-cyan-500 text-white p-3 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <CameraIcon />
            <span>ଚିତ୍ର ସୃଷ୍ଟି କରନ୍ତୁ</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImageGenerator;
