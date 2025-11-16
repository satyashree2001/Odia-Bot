import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type GroundingChunk } from '../types';
import { runSearch } from '../services/geminiService';
import { SendIcon, LinkIcon, MapPinIcon, SearchIcon, UserIcon, SatyashreeIcon, StopIcon } from './icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const searchSuggestions = [
  'ଓଡ଼ିଶାରେ ଆଜିର ପାଣିପାଗ କିପରି ଅଛି?',
  'ଭାରତର ପ୍ରଧାନମନ୍ତ୍ରୀ କିଏ?',
  'ଓଡ଼ିଆ ସାହିତ୍ୟର ଇତିହାସ',
  'କୋଣାର୍କ ମନ୍ଦିର କିଏ ତିଆରି କରିଥିଲେ?',
];

interface Turn {
  role: 'user' | 'model';
  text: string;
  chunks?: GroundingChunk[];
}

const Search: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [prompt]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.warn(`Geolocation error: ${error.message}`)
    );

    const getShuffledSuggestions = (arr: string[], num: number) => {
      return [...arr].sort(() => 0.5 - Math.random()).slice(0, num);
    };
    setSuggestions(getShuffledSuggestions(searchSuggestions, 4));
  }, []);

  const handleSearch = async (currentPrompt: string) => {
    if (!currentPrompt.trim() || isLoading) return;
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    
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
            if (lastTurn?.role === 'model') lastTurn.text += chunk;
            return newConversation;
        });
      };
      
      const result = await runSearch(historyForApi, currentPrompt, onChunk, location ?? undefined, abortControllerRef.current.signal);

      setConversation(prev => {
          const newConversation = [...prev];
          const lastTurn = newConversation[newConversation.length - 1];
          if (lastTurn?.role === 'model') {
            lastTurn.text = result.text;
            lastTurn.chunks = result.groundingChunks;
          }
          return newConversation;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(prompt);
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  const MarkdownComponents = {
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
        a: ({ node, ...props }) => <a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer" {...props} />,
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto px-4 pt-8 pb-32">
        {conversation.length === 0 && (
           <div className="flex flex-col justify-center items-center h-full text-center text-gray-600 dark:text-gray-400">
             <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4 dark:bg-gray-700"><SatyashreeIcon className="h-10 w-10"/></div>
             <p className="text-2xl font-medium text-gray-800 dark:text-gray-200">Satyashree Search</p>
             <p className="mt-1">ବାସ୍ତବ-ସମୟ ତଥ୍ୟ, ଜଟିଳ ବିଶ୍ଳେଷଣ, ଏବଂ ଅଧିକ ପାଆନ୍ତୁ।</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="bg-white text-left text-gray-700 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
                    >
                        {s}
                    </button>
                ))}
             </div>
           </div>
        )}

        <div className="space-y-6">
            {conversation.map((turn, index) => (
              <div key={index}>
                <div className={`w-full flex items-start gap-4 fade-in ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {turn.role === 'model' && (
                    <div className="flex-shrink-0 w-8 h-8">
                      <SatyashreeIcon />
                    </div>
                  )}
                    
                  <div className={`max-w-xl p-4 rounded-xl shadow-sm text-gray-800 leading-relaxed bg-white border border-gray-200 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600`}>
                      {isLoading && index === conversation.length - 1 ? (
                          <div className="typing-indicator"><span></span><span></span><span></span></div>
                      ) : (
                          <div className="text-base space-y-2">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                  {turn.text}
                              </ReactMarkdown>
                          </div>
                      )}
                  </div>

                  {turn.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8">
                      <UserIcon />
                    </div>
                  )}
                </div>

                {turn.role === 'model' && turn.chunks && turn.chunks.length > 0 && (
                  <div className="max-w-xl mt-3 ml-12">
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm dark:text-gray-300">Sources:</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {turn.chunks.map((chunk, index) => {
                        const source = chunk.web || chunk.maps;
                        if (!source) return null;
                        return (
                          <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 text-blue-500 pt-0.5">{chunk.web ? <LinkIcon /> : <MapPinIcon />}</div>
                              <div className="overflow-hidden">
                                <h4 className="font-semibold text-xs text-blue-600 dark:text-blue-400 truncate">{source.title || 'Untitled Source'}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{source.uri}</p>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50/80 backdrop-blur-md dark:bg-gray-900/80">
        <div className="max-w-4xl mx-auto px-4 py-3">
            <form onSubmit={handleSubmit} className="flex items-center bg-white border border-gray-300 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:focus-within:ring-blue-500">
                <textarea 
                    ref={textareaRef}
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                    placeholder="ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ..." 
                    className="flex-grow bg-transparent text-gray-800 placeholder-gray-500 py-3 px-4 focus:outline-none transition resize-none dark:text-gray-200 dark:placeholder-gray-400" 
                    disabled={isLoading}
                    rows={1}
                    style={{ maxHeight: '200px' }}
                />
                <div className="p-2">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      aria-label="Stop generation"
                    >
                      <StopIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!prompt.trim()}
                      className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-gray-200 dark:text-gray-800 dark:hover:bg-gray-300 dark:disabled:bg-gray-500"
                      aria-label="Send message"
                    >
                      <SendIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
            </form>
            <p className="text-xs text-center text-gray-500 mt-2 dark:text-gray-400">Satyashree can make mistakes. Consider checking important information.</p>
        </div>
      </div>
    </div>
  );
};

export default Search;