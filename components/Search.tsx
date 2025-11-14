
import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type GroundingChunk } from '../types';
import { runSearch } from '../services/geminiService';
import { SendIcon, LinkIcon, MapPinIcon, QuoteIcon, SearchIcon, UserIcon, MindIcon } from './icons';

const searchSuggestions = [
  'ଓଡ଼ିଶାରେ ଆଜିର ପାଣିପାଗ କିପରି ଅଛି?',
  'ଭାରତର ପ୍ରଧାନମନ୍ତ୍ରୀ କିଏ?',
  'ଓଡ଼ିଆ ସାହିତ୍ୟର ଇତିହାସ',
  'କୋଣାର୍କ ମନ୍ଦିର କିଏ ତିଆରି କରିଥିଲେ?',
  'ପଖାଳ ଦିବସ କେବେ ପାଳନ କରାଯାଏ?',
  'ଓଡ଼ିଶାର ପ୍ରମୁଖ ପର୍ବପର୍ବାଣି କଣ?',
  'ଜଗନ୍ନାଥ ପୁରୀ ମନ୍ଦିରର ରହସ୍ୟ',
  'ଚନ୍ଦ୍ରଯାନ-୩ ମିଶନ ବିଷୟରେ କୁହନ୍ତୁ',
];

interface Turn {
  role: 'user' | 'model';
  text: string;
  chunks?: GroundingChunk[];
}

type LocationStatus = 'loading' | 'success' | 'denied' | 'unavailable' | 'timeout';

const Search: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);


  useEffect(() => {
     if (!navigator.geolocation) {
        setLocationStatus('unavailable');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('success');
      },
      (error) => {
        console.warn(`Geolocation error: ${error.message}`);
        switch(error.code) {
            case error.PERMISSION_DENIED:
                setLocationStatus('denied');
                break;
            case error.POSITION_UNAVAILABLE:
                setLocationStatus('unavailable');
                break;
            case error.TIMEOUT:
                setLocationStatus('timeout');
                break;
            default:
                setLocationStatus('unavailable');
                break;
        }
      }
    );

    const getShuffledSuggestions = (arr: string[], num: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, num);
    };
    setSuggestions(getShuffledSuggestions(searchSuggestions, 4));
  }, []);

  const handleSearch = async (currentPrompt: string) => {
    if (!currentPrompt.trim() || isLoading) return;

    setIsLoading(true);
    
    const historyForApi = conversation.map(({ role, text }) => ({ role, text }));
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
      
      const result = await runSearch(historyForApi, currentPrompt, onChunk, location ?? undefined);

      setConversation(prev => {
          const newConversation = [...prev];
          const lastTurn = newConversation[newConversation.length - 1];
          if (lastTurn && lastTurn.role === 'model') {
            lastTurn.text = result.text;
            lastTurn.chunks = result.groundingChunks;
          }
          return newConversation;
      });

    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(prompt);
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  const renderLocationStatus = () => {
    switch (locationStatus) {
      case 'denied':
        return (
          <p className="text-xs text-amber-400/90 text-center mt-2">
            ସ୍ଥାନୀୟ ଫଳାଫଳ ପାଇଁ, ଦୟାକରି ଆପଣଙ୍କ ବ୍ରାଉଜର୍ ସେଟିଂସରେ ସ୍ଥାନ ଅନୁମତି ସକ୍ଷମ କରନ୍ତୁ।
          </p>
        );
      case 'unavailable':
      case 'timeout':
        return (
          <p className="text-xs text-slate-400 text-center mt-2">
            ସ୍ଥାନ ସୂଚନା ପାଇବାରେ ବିଫଳ। ସ୍ଥାନୀୟ ଫଳାଫଳ ପ୍ରଭାବିତ ହୋଇପାରେ।
          </p>
        );
      case 'loading':
      case 'success':
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50">
      <div className="flex-grow p-4 sm:p-6 overflow-y-auto space-y-4">
        {conversation.length === 0 && (
           <div className="flex flex-col justify-center items-center h-full text-center text-slate-400">
             <SearchIcon />
             <p className="text-lg mt-2">ବାସ୍ତବ-ସମୟ ତଥ୍ୟ, ଜଟିଳ ବିଶ୍ଳେଷଣ, ଏବଂ ଅଧିକ ପାଆନ୍ତୁ।</p>
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
        {conversation.map((turn, index) => (
          <div key={index}>
            <div className={`flex items-end gap-3 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               {turn.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center text-cyan-400">
                    <SearchIcon />
                  </div>
                )}
              <div className={`max-w-xl p-4 rounded-2xl shadow-md ${turn.role === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white' : 'bg-slate-800 text-slate-200'}`}>
                {turn.role === 'model' && isLoading && index === conversation.length - 1 && !turn.text ? (
                     <div className="flex items-center justify-center p-2">
                        <MindIcon className="h-8 w-8 text-cyan-400 sparkle-animation" />
                    </div>
                ) : (
                    <p className="text-[15px] whitespace-pre-wrap" style={{lineHeight: '1.625'}}>{turn.text}</p>
                )}
              </div>
              {turn.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center font-bold text-white text-lg">
                    <UserIcon />
                  </div>
                )}
            </div>
            {turn.role === 'model' && turn.chunks && turn.chunks.length > 0 && (
              <div className="ml-11 mt-3 max-w-xl">
                <h3 className="font-semibold text-cyan-400 mb-2 text-sm">ଉତ୍ସଗୁଡ଼ିକ (Sources):</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {turn.chunks.map((chunk, index) => {
                    const source = chunk.web || chunk.maps;
                    if (!source) return null;
                    const isWeb = !!chunk.web;
                    
                    return (
                      <div key={`${isWeb ? 'web' : 'map'}-${index}`} className="block p-3 rounded-xl border border-slate-700 bg-slate-800/50 transition-colors hover:bg-slate-800">
                        <a href={source.uri} target="_blank" rel="noopener noreferrer">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="flex-shrink-0 text-cyan-400">{isWeb ? <LinkIcon /> : <MapPinIcon />}</div>
                            <h4 className="font-bold text-sm text-cyan-300 line-clamp-1">{source.title || 'Untitled Source'}</h4>
                          </div>
                          <p className="text-xs text-slate-400 break-all opacity-75 line-clamp-1">{source.uri}</p>
                        </a>
                        {chunk.maps?.placeAnswerSources?.reviewSnippets?.map((snippet, sIndex) => (
                          <div key={`snippet-${index}-${sIndex}`} className="mt-2 pt-2 border-t border-slate-700/50">
                            <a href={snippet.uri} target="_blank" rel="noopener noreferrer" className="block p-1 rounded-lg hover:bg-slate-700/50">
                                <h5 className="font-semibold text-xs text-slate-300">{snippet.title}</h5>
                                <p className="text-xs text-slate-400 italic mt-1">"{snippet.snippet}"</p>
                            </a>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
         <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ କିମ୍ବା ବିଶ୍ଳେଷଣ ପାଇଁ URL ପେଷ୍ଟ କରନ୍ତୁ..."
            className="flex-grow bg-slate-800 text-white placeholder-slate-400 rounded-2xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition resize-none"
            rows={1}
            style={{ maxHeight: '120px' }}
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
         {renderLocationStatus()}
      </div>
    </div>
  );
};

export default Search;
