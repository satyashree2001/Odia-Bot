import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserIcon, LogoutIcon, MenuIcon, ChatIcon, SearchIcon, MicrophoneIcon, SunIcon, MoonIcon, OdiaBotIcon } from './components/icons';
import Chat from './components/Chat';
import AuthModal from './components/AuthModal';
import Welcome from './components/Welcome';
import HistorySidebar from './components/HistorySidebar';
import Search from './components/Search';
import VoiceChat from './components/VoiceChat';

import { type ChatMessage, type Conversations, type Conversation } from './types';
import { runChat, generateTitleForChat } from './services/geminiService';

const odiaMotivationalQuotes = [
  "ସଫଳତା ପାଇଁ କୌଣସି ସର୍ଟକଟ୍ ନାହିଁ, କେବଳ କଠିନ ପରିଶ୍ରମ ହିଁ ଏକମାତ୍ର ରାସ୍ତା।",
  "ଯେଉଁମାନେ ଚେଷ୍ଟା କରନ୍ତି, ସେମାନେ କେବେ ହାରନ୍ତି ନାହିଁ।",
  "ନିଜ ଉପରେ ବିଶ୍ୱାସ ରଖ, ତୁମେ ଯାହା ଚାହିଁବ ତାହା କରିପାରିବ।",
  "ଆଜିର ସଂଘର୍ଷ କାଲିର ଶକ୍ତି।",
  "ସ୍ୱପ୍ନ ସେୟା ନୁହେଁ ଯାହା ଆମେ ଶୋଇଲା ବେଳେ ଦେଖୁ, ସ୍ୱପ୍ନ ସେୟା ଯାହା ଆମକୁ ଶୋଇବାକୁ ଦିଏ ନାହିଁ।"
];

const getInitialMessage = (): ChatMessage => {
  const randomQuote = odiaMotivationalQuotes[Math.floor(Math.random() * odiaMotivationalQuotes.length)];
  return {
    id: crypto.randomUUID(),
    sender: 'bot',
    text: `"${randomQuote}"\n\nନମସ୍କାର! ମୁଁ ଓଡ଼ିଆବଟ୍ (OdiaBot)। ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?`,
  };
};

type Mode = 'chat' | 'search' | 'voice';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!sessionStorage.getItem('odiabot_welcome_seen'));
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>('chat');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  // Chat State
  const [conversations, setConversations] = useState<Conversations>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('odiabot_theme') as Theme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    }
  }, []);
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('odiabot_theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };


  // Load user and conversations
  useEffect(() => {
    const savedUser = localStorage.getItem('odiabot_currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
      loadConversations(savedUser);
    } else {
      handleNewChat(); // Start an anonymous chat
    }
  }, []);
  
  const loadConversations = (user: string) => {
    const savedConversations = localStorage.getItem(`odiabot_conversations_${user}`);
    const savedActiveId = localStorage.getItem(`odiabot_activeConversationId_${user}`);
    
    if (savedConversations) {
      try {
        const parsedConversations = JSON.parse(savedConversations);
        if (Object.keys(parsedConversations).length > 0) {
            setConversations(parsedConversations);
            if (savedActiveId && parsedConversations[savedActiveId]) {
              setActiveConversationId(savedActiveId);
            } else {
              const firstConvId = Object.keys(parsedConversations)[0];
              setActiveConversationId(firstConvId);
            }
        } else {
             handleNewChat(user);
        }
      } catch (e) {
        handleNewChat(user);
      }
    } else {
      handleNewChat(user);
    }
  };
  
  // Save conversations
  useEffect(() => {
    if (currentUser && Object.keys(conversations).length > 0) {
      localStorage.setItem(`odiabot_conversations_${currentUser}`, JSON.stringify(conversations));
      if (activeConversationId) {
        localStorage.setItem(`odiabot_activeConversationId_${currentUser}`, activeConversationId);
      }
    } else if (currentUser && Object.keys(conversations).length === 0) {
      // If all conversations are deleted, remove the item from local storage
      localStorage.removeItem(`odiabot_conversations_${currentUser}`);
      localStorage.removeItem(`odiabot_activeConversationId_${currentUser}`);
    }
  }, [conversations, activeConversationId, currentUser]);


  const handleNewChat = useCallback((user: string | null = currentUser) => {
    const newId = `conv_${crypto.randomUUID()}`;
    const newConversation: Conversation = {
      id: newId,
      title: 'ନୂଆ ବାର୍ତ୍ତାଳାପ',
      messages: [getInitialMessage()],
    };
    setConversations(prev => ({ ...prev, [newId]: newConversation }));
    setActiveConversationId(newId);
    if(isHistorySidebarOpen) setIsHistorySidebarOpen(false);
    setActiveMode('chat');
  }, [currentUser, isHistorySidebarOpen]);

  const handleLoadConversation = (id: string) => {
    if (conversations[id]) {
      setActiveConversationId(id);
      setActiveMode('chat');
      setIsHistorySidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    if (!currentUser) return;
  
    const newConversations = { ...conversations };
    delete newConversations[id];
  
    if (activeConversationId !== id) {
      setConversations(newConversations);
      return;
    }
  
    const remainingIds = Object.keys(newConversations);
    if (remainingIds.length > 0) {
      const sortedIds = Object.values(newConversations)
        .sort((a: Conversation, b: Conversation) =>
          (b.messages.slice(-1)[0]?.id || '').localeCompare(a.messages.slice(-1)[0]?.id || '')
        )
        .map((c: Conversation) => c.id);
      
      setActiveConversationId(sortedIds[0]);
      setConversations(newConversations);
    } else {
      handleNewChat();
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    if (conversations[id]) {
      setConversations(prev => ({
        ...prev,
        [id]: { ...prev[id], title: newTitle },
      }));
    }
  };

  const handleSendMessage = async (prompt: string, file?: { data: string; mimeType: string, name: string, previewUrl: string }) => {
    if (!activeConversationId || !conversations[activeConversationId]) return;

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: prompt,
      file: file ? { name: file.name, type: file.mimeType, previewUrl: file.previewUrl } : undefined,
    };
    
    const botMessagePlaceholder: ChatMessage = { id: crypto.randomUUID(), sender: 'bot', text: '' };
    
    const isNewConversation = conversations[activeConversationId]?.messages.length === 1;

    if (isNewConversation && currentUser) {
        generateTitleForChat(prompt).then(title => {
            handleRenameConversation(activeConversationId, title);
        });
    }
    
    const historyForApi = [...conversations[activeConversationId].messages];

    setConversations(prev => ({
        ...prev,
        [activeConversationId]: {
            ...prev[activeConversationId],
            messages: [...prev[activeConversationId].messages, userMessage, botMessagePlaceholder],
        },
    }));

    try {
      const onChunk = (payload: { chunk: string; mode?: 'fast' | 'expert' }) => {
        setConversations(prev => {
            if (!activeConversationId) return prev;
            const currentConv = prev[activeConversationId];
            if (!currentConv) return prev;
            const currentMessages = currentConv.messages;
            const lastMessage = currentMessages[currentMessages.length - 1];
            if(lastMessage?.id === botMessagePlaceholder.id){
                const updatedLastMessage = { 
                    ...lastMessage, 
                    text: lastMessage.text + payload.chunk,
                    mode: payload.mode || lastMessage.mode,
                };
                return {
                    ...prev,
                    [activeConversationId]: {
                        ...currentConv,
                        messages: [...currentMessages.slice(0, -1), updatedLastMessage]
                    }
                }
            }
            return prev;
        });
      };
      
      const filePayload = file ? { data: file.data, mimeType: file.mimeType } : undefined;
      const result = await runChat(historyForApi, prompt, onChunk, filePayload, abortControllerRef.current.signal);

      if (result.groundingChunks && result.groundingChunks.length > 0) {
        setConversations(prev => {
          if (!activeConversationId) return prev;
          const currentConv = prev[activeConversationId];
          if (!currentConv) return prev;
          
          const currentMessages = [...currentConv.messages];
          const lastMessage = currentMessages[currentMessages.length - 1];

          if (lastMessage && lastMessage.sender === 'bot') {
              const updatedLastMessage = {
                  ...lastMessage,
                  groundingChunks: result.groundingChunks,
              };
              return {
                  ...prev,
                  [activeConversationId]: {
                      ...currentConv,
                      messages: [...currentMessages.slice(0, -1), updatedLastMessage]
                  }
              };
          }
          return prev;
        });
      }

    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleDismissWelcome = () => {
    sessionStorage.setItem('odiabot_welcome_seen', 'true');
    setShowWelcome(false);
  };

  const signIn = (username: string) => {
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      localStorage.setItem('odiabot_currentUser', trimmedUsername);
      setCurrentUser(trimmedUsername);
      setIsAuthModalOpen(false);
      loadConversations(trimmedUsername);
    }
  };

  const signOut = () => {
    localStorage.removeItem('odiabot_currentUser');
    setCurrentUser(null);
    setConversations({});
    setActiveConversationId(null);
    handleNewChat(null);
  };

  const activeMessages = activeConversationId ? conversations[activeConversationId]?.messages : [];

  const modes = {
    chat: { name: 'ଗପସପ (Chat)', icon: <ChatIcon /> },
    search: { name: 'ଖୋଜ (Search)', icon: <SearchIcon /> },
    voice: { name: 'ଭଏସ୍ (Voice)', icon: <MicrophoneIcon /> },
  };

  const renderActiveMode = () => {
    switch (activeMode) {
      case 'chat':
        return <Chat 
                  key={activeConversationId} 
                  messages={activeMessages || [getInitialMessage()]}
                  isLoading={isGenerating}
                  onSendMessage={handleSendMessage}
                  onStopGeneration={handleStopGeneration}
               />;
      case 'search':
        return <Search />;
      case 'voice':
        return <VoiceChat />;
      default:
        return null;
    }
  }

  return (
    <>
      {showWelcome && <Welcome onDismiss={handleDismissWelcome} />}
      {currentUser && 
        <HistorySidebar
            isOpen={isHistorySidebarOpen}
            onClose={() => setIsHistorySidebarOpen(false)}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onLoad={handleLoadConversation}
            onNew={handleNewChat}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
        />
      }
      <div className={`h-full bg-gray-50 text-gray-800 flex flex-col font-sans dark:bg-gray-900 dark:text-gray-200 ${showWelcome ? 'hidden' : ''}`}>
        <header className="flex-shrink-0 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="container mx-auto flex justify-between items-center h-16 px-4">
            <div className="flex items-center gap-2">
                {currentUser && (
                    <button onClick={() => setIsHistorySidebarOpen(true)} className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700">
                        <MenuIcon />
                    </button>
                )}
            </div>

            <div className="relative">
                <button onClick={() => setIsModeDropdownOpen(prev => !prev)} className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    <OdiaBotIcon className="h-6 w-6" />
                    <span>OdiaBot</span>
                    <span className="text-gray-500 text-sm dark:text-gray-400">({modes[activeMode].name})</span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isModeDropdownOpen && (
                    <div className="absolute top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 dark:bg-gray-700 dark:border-gray-600">
                        {(Object.keys(modes) as Mode[]).map(modeId => (
                            <button
                                key={modeId}
                                onClick={() => {
                                    setActiveMode(modeId);
                                    setIsModeDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                {React.cloneElement(modes[modeId].icon, { className: 'h-5 w-5' })}
                                <span>{modes[modeId].name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
               <button onClick={handleThemeToggle} className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700">
                  {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
              {currentUser ? (
                  <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <div className="w-8 h-8"><UserIcon /></div>
                          <span className="font-medium hidden sm:inline">{currentUser}</span>
                      </div>
                      <button onClick={signOut} title="Sign Out" className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700">
                          <LogoutIcon />
                      </button>
                  </div>
              ) : (
                  <button onClick={() => setIsAuthModalOpen(true)} className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600">
                      Sign In
                  </button>
              )}
            </div>
          </div>
        </header>
        
        <main className="flex-1 w-full h-full overflow-hidden">
           {renderActiveMode()}
        </main>
      </div>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSignIn={signIn} />
    </>
  );
};

export default App;