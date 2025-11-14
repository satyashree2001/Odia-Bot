

import React, { useState, useEffect, useCallback } from 'react';
import { UserIcon, LogoutIcon, MenuIcon } from './components/icons';
import Chat from './components/Chat';
import AuthModal from './components/AuthModal';
import Welcome from './components/Welcome';
import HistorySidebar from './components/HistorySidebar';
import { type ChatMessage, type Conversations, type Conversation } from './types';
import { runChat, generateTitleForChat } from './services/geminiService';

const getInitialMessage = (): ChatMessage => ({
  id: crypto.randomUUID(),
  sender: 'bot',
  text: 'ନମସ୍କାର! ମୁଁ ସତ୍ୟଶ୍ରୀ। ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?',
});

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!sessionStorage.getItem('satyashree_welcome_seen'));
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);

  // Chat State
  const [conversations, setConversations] = useState<Conversations>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load user and conversations
  useEffect(() => {
    const savedUser = localStorage.getItem('satyashree_currentUser');
    if (savedUser) {
      setCurrentUser(savedUser);
      loadConversations(savedUser);
    } else {
      handleNewChat(); // Start an anonymous chat
    }
  }, []);
  
  const loadConversations = (user: string) => {
    const savedConversations = localStorage.getItem(`satyashree_conversations_${user}`);
    const savedActiveId = localStorage.getItem(`satyashree_activeConversationId_${user}`);
    
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
      localStorage.setItem(`satyashree_conversations_${currentUser}`, JSON.stringify(conversations));
      if (activeConversationId) {
        localStorage.setItem(`satyashree_activeConversationId_${currentUser}`, activeConversationId);
      }
    } else if (currentUser && Object.keys(conversations).length === 0) {
      // If all conversations are deleted, remove the item from local storage
      localStorage.removeItem(`satyashree_conversations_${currentUser}`);
      localStorage.removeItem(`satyashree_activeConversationId_${currentUser}`);
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
  }, [currentUser, isHistorySidebarOpen]);

  const handleLoadConversation = (id: string) => {
    if (conversations[id]) {
      setActiveConversationId(id);
      setIsHistorySidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    if (!currentUser) return;
  
    const newConversations = { ...conversations };
    delete newConversations[id];
  
    // Case 1: Deleting a conversation that is NOT active.
    if (activeConversationId !== id) {
      setConversations(newConversations);
      return;
    }
  
    // Case 2: Deleting the ACTIVE conversation.
    const remainingIds = Object.keys(newConversations);
    if (remainingIds.length > 0) {
      // If there are other conversations, make the most recent one active.
      const sortedIds = Object.values(newConversations)
        .sort((a: Conversation, b: Conversation) =>
          (b.messages.slice(-1)[0]?.id || '').localeCompare(a.messages.slice(-1)[0]?.id || '')
        )
        .map((c: Conversation) => c.id);
      
      setActiveConversationId(sortedIds[0]);
      setConversations(newConversations);
    } else {
      // Case 3: Deleting the VERY LAST conversation.
      // `handleNewChat` will create a new conversation and set it as active.
      // It also updates the `conversations` state, so we don't call `setConversations` here.
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
      const result = await runChat(historyForApi, prompt, onChunk, filePayload);

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
    }
  };

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
      loadConversations(trimmedUsername);
    }
  };

  const signOut = () => {
    localStorage.removeItem('satyashree_currentUser');
    setCurrentUser(null);
    setConversations({});
    setActiveConversationId(null);
    handleNewChat(null);
  };

  const activeMessages = activeConversationId ? conversations[activeConversationId]?.messages : [];

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
      <div className={`h-full bg-transparent text-slate-100 flex flex-col font-sans ${showWelcome ? 'hidden' : ''}`}>
        <header className="bg-slate-800/50 backdrop-blur-sm shadow-lg p-4 sticky top-0 z-20 border-b border-slate-700/50">
          <div className="container mx-auto flex justify-between items-center">
             <div className="flex items-center gap-2">
                {currentUser && (
                    <button onClick={() => setIsHistorySidebarOpen(true)} className="p-2 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50">
                        <MenuIcon />
                    </button>
                )}
                <h1 className="text-2xl font-bold text-cyan-400">Satyashree (ସତ୍ୟଶ୍ରୀ)</h1>
            </div>

            <div className="flex items-center gap-4">
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
           <div className="fade-in flex-grow flex flex-col">
            <Chat 
                key={activeConversationId} 
                messages={activeMessages || [getInitialMessage()]}
                currentUser={currentUser}
                isLoading={isGenerating}
                onSendMessage={handleSendMessage}
                onNewChat={handleNewChat}
            />
          </div>
        </main>
      </div>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSignIn={signIn} />
    </>
  );
};

export default App;