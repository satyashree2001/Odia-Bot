import React, { useState, useRef, useEffect } from 'react';
// Fix: Import the 'Conversation' type to resolve type errors.
import { type Conversations, type Conversation } from '../types';
import { PlusIcon, TrashIcon, EditIcon, CheckIcon } from './icons';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversations;
  activeConversationId: string | null;
  onLoad: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onLoad,
  onNew,
  onDelete,
  onRename,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleRenameClick = (id: string, currentTitle: string) => {
    setEditingId(id);
    setRenameValue(currentTitle);
  };

  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) {
      onRename(id, renameValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };
  
  // Fix: Explicitly type 'a' and 'b' to 'Conversation' to resolve type errors.
  const conversationList = Object.values(conversations).sort((a: Conversation, b: Conversation) => {
    const lastMsgA = a.messages[a.messages.length - 1];
    const lastMsgB = b.messages[b.messages.length - 1];
    if (!lastMsgA?.id) return 1;
    if (!lastMsgB?.id) return -1;
    return lastMsgB.id.localeCompare(lastMsgA.id);
  });

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-slate-900/80 backdrop-blur-lg border-r border-slate-700/50 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-cyan-400">ବାର୍ତ୍ତାଳାପ</h2>
            <button
              onClick={onNew}
              className="flex items-center gap-1 text-sm bg-cyan-500/10 text-cyan-300 px-3 py-1.5 rounded-lg hover:bg-cyan-500/20"
            >
              <PlusIcon />
              <span>ନୂଆ</span>
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-2">
            <ul className="space-y-1">
              {conversationList.map(({ id, title }) => (
                <li key={id}>
                  <div
                    className={`group w-full flex items-center p-2 rounded-lg cursor-pointer ${
                      activeConversationId === id
                        ? 'bg-cyan-500/20 text-white'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {editingId === id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(id)}
                        onKeyDown={(e) => handleKeyDown(e, id)}
                        className="flex-grow bg-transparent border-b border-cyan-400 focus:outline-none text-sm"
                      />
                    ) : (
                      <span onClick={() => onLoad(id)} className="flex-grow truncate text-sm">
                        {title}
                      </span>
                    )}
                    <div className="flex items-center ml-2">
                      {editingId === id ? (
                        <button onClick={() => handleRenameSubmit(id)} className="text-green-400 hover:text-green-300">
                          <CheckIcon />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleRenameClick(id, title)} className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditIcon />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`ଆପଣ ନିଶ୍ଚିତ ଯେ ଆପଣ "${title}" ବାର୍ତ୍ତାଳାପ ଡିଲିଟ୍ କରିବାକୁ ଚାହୁଁଛନ୍ତି?`)) {
                                onDelete(id);
                              }
                            }}
                            className="ml-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;