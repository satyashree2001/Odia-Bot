import React, { useState, useRef, useEffect } from 'react';
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
        className={`fixed inset-0 bg-black/40 z-30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-[#202123] text-gray-200 border-r border-white/10 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">History</h2>
            <button
              onClick={onNew}
              className="flex items-center gap-2 text-sm border border-white/20 text-white px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              <PlusIcon />
              <span>New Chat</span>
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-2">
            <ul className="space-y-1">
              {conversationList.map(({ id, title }) => (
                <li key={id}>
                  <div
                    className={`group w-full flex items-center p-2.5 rounded-lg cursor-pointer ${
                      activeConversationId === id
                        ? 'bg-[#343541]'
                        : 'hover:bg-[#2A2B32]'
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
                        className="flex-grow bg-transparent border-b border-blue-400 focus:outline-none text-sm"
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
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRenameClick(id, title)} className="text-gray-400 hover:text-white">
                            <EditIcon />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
                                onDelete(id);
                              }
                            }}
                            className="ml-2 text-gray-400 hover:text-red-400"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
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
