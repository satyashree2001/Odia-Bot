import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type GroundingChunk } from '../types';
import { runSearch } from '../services/geminiService';
import { SendIcon, LinkIcon, MapPinIcon } from './icons';

const searchSuggestions = [
  'ଓଡ଼ିଶାରେ ଆଜିର ପାଣିପାଗ କିପରି ଅଛି?',
  'ଭାରତର ପ୍ରଧାନମନ୍ତ୍ରୀ କିଏ?',
  'ଓଡ଼ିଆ ସାହିତ୍ୟର ଇତିହାସ',
  'କୋଣାର୍କ ମନ୍ଦିର କିଏ ତିଆରି କରିଥିଲେ?',
  'ପଖାଳ ଦିବସ କେବେ ପାଳନ କରାଯାଏ?',
  'ଓଡ଼ିଶାର ପ୍ରମୁଖ ପର୍ବପର୍ବାଣି କଣ?',
  'ଜଗନ୍ନାଥ ପୁରୀ ମନ୍ଦିରର ରହସ୍ୟ',
  'ଚନ୍ଦ୍ରଯାନ-୩ ମିଶନ ବିଷୟରେ କୁହନ୍ତୁ',
  'ସମ୍ବଲପୁରୀ ଶାଢୀର ବିଶେଷତା କଣ?',
  'ଓଡ଼ିଶାରେ ପର୍ଯ୍ୟଟନ ସ୍ଥଳୀ',
  'ହକି ବିଶ୍ଵକପ ୨୦୨୩ର ବିଜେତା କିଏ?',
  'ସର୍ବଶେଷ ଓଡ଼ିଆ ଚଳଚ୍ଚିତ୍ର ଖବର',
  'ଓଡ଼ିଶାରେ ନୂତନ ମନ୍ତ୍ରୀମଣ୍ଡଳ',
  'ଆଜିର ମୁଖ୍ୟ ଖବର ଓଡ଼ିଶା',
  'ଭାରତର ୨୦୨୪ ବଜେଟ୍',
  'ପ୍ୟାରିସ୍ ଅଲିମ୍ପିକ୍ସ ୨୦୨୪ ରେ ଭାରତ',
  'ଆଗାମୀ ଓଡ଼ିଆ ଚଳଚ୍ଚିତ୍ର',
  'ରଥଯାତ୍ରାର ମହତ୍ତ୍ଵ',
  'ଓଡ଼ିଶୀ ନୃତ୍ୟର ଇତିହାସ',
  'ଓଡ଼ିଆ ଖାଦ୍ୟ ରେସିପି',
  'ଓଡ଼ିଶାର ଜଣାଶୁଣା ବ୍ୟକ୍ତିତ୍ୱ',
  'କୃତ୍ରିମ ବୁଦ୍ଧିମତ୍ତା (AI) କ\'ଣ?',
];

const Search: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<{ text: string; chunks: GroundingChunk[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (response) {
      responseRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [response?.text]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        console.warn(`Geolocation error: ${error.message}`);
        setLocationError('ସ୍ଥାନ ସୂଚନା ପାଇବାରେ ବିଫଳ। ସ୍ଥାନୀୟ ଫଳାଫଳ ପ୍ରଭାବିତ ହୋଇପାରେ।');
      }
    );

    const getShuffledSuggestions = (arr: string[], num: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, num);
    };
    setSuggestions(getShuffledSuggestions(searchSuggestions, 4));
  }, []);

  const performSearch = async (currentPrompt: string) => {
    if (!currentPrompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse({ text: '', chunks: [] });
    setPrompt(currentPrompt); 

    try {
      const onChunk = (chunk: string) => {
        setResponse(prev => ({
          text: (prev?.text || '') + chunk,
          chunks: prev?.chunks || []
        }));
      };
      
      const result = await runSearch(currentPrompt, onChunk, location ?? undefined);
      
      setResponse({ text: result.text, chunks: result.groundingChunks });

    } catch (error) {
       // Error is streamed into the response by the service
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(prompt);
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    performSearch(suggestion);
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50">
      <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
        {!response && (
           <div className="flex flex-col justify-center items-center h-full text-center text-slate-400">
             <p className="text-lg">ରିଅଲ୍-ଟାଇମ୍ ତଥ୍ୟ ପାଇବାକୁ କିଛି ଖୋଜନ୍ତୁ।</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="bg-slate-700/50 text-slate-300 text-sm px-3 py-1.5 rounded-full hover:bg-slate-700 hover:text-cyan-400 transition-colors"
                    >
                        {s}
                    </button>
                ))}
             </div>
           </div>
        )}
        {response && (
          <div ref={responseRef} className="bg-slate-800/60 p-5 rounded-lg border border-slate-700">
            <p className="whitespace-pre-wrap leading-relaxed">{response.text}</p>
            {response.chunks.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <h3 className="font-bold text-cyan-400 mb-3">ଉତ୍ସଗୁଡ଼ିକ:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {response.chunks.map((chunk, index) => {
                    if (chunk.web) {
                      return (
                         <a
                            key={`web-${index}`}
                            href={chunk.web.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-900/50 p-3 rounded-lg hover:bg-slate-800/50 transition-all duration-200 hover:scale-[1.02] hover:border-cyan-500/50 flex items-start gap-3 border border-slate-700 group"
                          >
                            <div className="flex-shrink-0 pt-1 text-slate-400 group-hover:text-cyan-400"><LinkIcon /></div>
                            <div>
                              <p className="font-semibold text-cyan-400 break-words group-hover:underline">{chunk.web.title || 'Untitled Source'}</p>
                              <p className="text-xs text-slate-500 truncate">{chunk.web.uri}</p>
                            </div>
                          </a>
                      );
                    }
                    if (chunk.maps) {
                      return (
                         <a
                            key={`map-${index}`}
                            href={chunk.maps.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-900/50 p-3 rounded-lg hover:bg-slate-800/50 transition-all duration-200 hover:scale-[1.02] hover:border-cyan-500/50 flex items-start gap-3 border border-slate-700 group"
                          >
                            <div className="flex-shrink-0 pt-1 text-slate-400 group-hover:text-cyan-400"><MapPinIcon /></div>
                            <div>
                              <p className="font-semibold text-cyan-400 break-words group-hover:underline">{chunk.maps.title || 'Untitled Place'}</p>
                              <p className="text-xs text-slate-500 truncate">{chunk.maps.uri}</p>
                            </div>
                          </a>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ..."
            className="flex-grow bg-slate-800 text-white placeholder-slate-400 rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-3 rounded-full hover:opacity-90 disabled:from-slate-600 disabled:to-slate-700 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
          >
            <SendIcon />
          </button>
        </form>
         {locationError && <p className="text-xs text-red-400 text-center mt-2">{locationError}</p>}
      </div>
    </div>
  );
};

export default Search;