
import React, { useState, useEffect } from 'react';
import { ChatIcon, SearchIcon, MicrophoneIcon, SparklesIcon, CameraIcon, UserIcon, LogoutIcon } from './components/icons';
import Chat from './components/Chat';
import Search from './components/Search';
import VoiceChat from './components/VoiceChat';
import ThinkingMode from './components/ThinkingMode';
import ImageGenerator from './components/ImageGenerator';
import AuthModal from './components/AuthModal';
import Welcome from './components/Welcome';

type Tab = 'chat' | 'search' | 'voice' | 'thinking' | 'imageGeneration';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!sessionStorage.getItem('satyashree_welcome_seen'));

  useEffect(() => {
    const savedUser = localStorage.getItem('satyashree_currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
    }
  }, []);

  const handleDismissWelcome = () => {
    sessionStorage.setItem('satyashree_welcome_seen', 'true');
    setShowWelcome(false);
  };

  const signIn = (username: string) => {
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      localStorage.setItem('satyashree_currentUser', trimmedUsername);
      setCurrentUser(trimmedUsername);
      setIsAuthModalOpen(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('satyashree_currentUser');
    setCurrentUser(null);
  };


  const tabs: { id: Tab; name: string; icon: React.ReactNode }[] = [
    { id: 'chat', name: 'ଗପସପ', icon: <ChatIcon /> },
    { id: 'search', name: 'ଖୋଜନ୍ତୁ', icon: <SearchIcon /> },
    { id: 'imageGeneration', name: 'ଚିତ୍ର ସୃଷ୍ଟି', icon: <CameraIcon /> },
    { id: 'voice', name: 'କଥାବାର୍ତ୍ତା', icon: <MicrophoneIcon /> },
    { id: 'thinking', name: 'ଗଭୀର ଚିନ୍ତା', icon: <SparklesIcon /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <Chat currentUser={currentUser} />;
      case 'search':
        return <Search />;
      case 'imageGeneration':
        return <ImageGenerator />;
      case 'voice':
        return <VoiceChat />;
      case 'thinking':
        return <ThinkingMode />;
      default:
        return <Chat currentUser={currentUser} />;
    }
  };

  return (
    <>
      {showWelcome && <Welcome onDismiss={handleDismissWelcome} />}
      <div className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans ${showWelcome ? 'hidden' : ''}`}>
        <header className="bg-slate-800/50 backdrop-blur-sm shadow-lg p-4 sticky top-0 z-10">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-cyan-400">Satyashree (ସତ୍ୟଶ୍ରୀ)</h1>
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex flex-wrap justify-center gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                      activeTab === tab.id
                        ? 'bg-cyan-500 text-white shadow-md'
                        : 'hover:bg-slate-700'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
              {currentUser ? (
                  <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-cyan-400">
                          <UserIcon />
                          <span className="font-medium hidden sm:inline">{currentUser}</span>
                      </div>
                      <button onClick={signOut} className="flex items-center gap-1 text-sm text-slate-300 hover:text-white bg-slate-700 px-3 py-2 rounded-lg">
                          <LogoutIcon />
                          <span className="hidden sm:inline">Sign Out</span>
                      </button>
                  </div>
              ) : (
                  <button onClick={() => setIsAuthModalOpen(true)} className="bg-cyan-500 text-white text-sm px-3 py-2 rounded-lg hover:bg-cyan-600 transition-colors">
                      Sign In to Save Chat
                  </button>
              )}
            </div>
          </div>
        </header>
        
        <main className="flex-grow container mx-auto p-4 flex flex-col">
          {renderContent()}
        </main>

        <nav className="md:hidden bg-slate-800 p-2 grid grid-cols-5 gap-1 sticky bottom-0 z-10">
          {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center p-1 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-white'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  {tab.icon}
                  <span className="text-xs text-center mt-1">{tab.name}</span>
                </button>
              ))}
        </nav>
      </div>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSignIn={signIn} />
    </>
  );
};

export default App;
