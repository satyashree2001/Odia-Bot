
import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { runChat, analyzeVideoUrl } from '../services/geminiService';
import { SendIcon, SaveIcon, PaperclipIcon, CloseIcon, DocumentIcon, ThumbsUpIcon, ThumbsDownIcon } from './icons';

interface ChatProps {
  currentUser: string | null;
}

const MAX_FILE_SIZE_MB = 20;

const fileToBase64 = (file: File, onProgress: (progress: number) => void): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      onProgress(100);
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentLoaded = Math.round((event.loaded / event.total) * 100);
        onProgress(percentLoaded);
      }
    };
    reader.onerror = (error) => reject(error);
  });

const isValidUrl = (text: string): boolean => {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return false;
    }
    try {
        new URL(text);
        return true;
    } catch (_) {
        return false;
    }
};

const Chat: React.FC<ChatProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentUser) {
      try {
        const savedMessages = localStorage.getItem(`satyashree_chatHistory_${currentUser}`);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          setMessages([{ id: crypto.randomUUID(), sender: 'bot', text: 'ନମସ୍କାର! ମୁଁ ସତ୍ୟଶ୍ରୀ। ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି? ଆପଣ ଫାଇଲ୍ କିମ୍ବା ଭିଡିଓ ଲିଙ୍କ୍ ମଧ୍ୟ ପେଷ୍ଟ କରିପାରିବେ।'}]);
        }
      } catch (error) {
        console.error("Failed to parse chat history from localStorage", error);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [currentUser]);
  
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      const lastMessage = messages[messages.length-1];
      if(lastMessage.text) {
         localStorage.setItem(`satyashree_chatHistory_${currentUser}`, JSON.stringify(messages));
      }
    }
    scrollToBottom();
  }, [messages, currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFileError(null);
      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`ଫାଇଲ୍ ଆକାର ${MAX_FILE_SIZE_MB}MB ରୁ ଅଧିକ ହେବା ଉଚିତ୍ ନୁହେଁ।`);
        removeFile();
        return;
      }
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) {
        setFilePreview(URL.createObjectURL(selectedFile));
      } else {
        setFilePreview('document');
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleFeedback = (messageId: string, feedback: 'liked' | 'disliked') => {
    setMessages(prevMessages => prevMessages.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !file) || isLoading) return;

    setIsLoading(true);
    setFileError(null);

    const isVideoUrl = !file && isValidUrl(input.trim());

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: input,
      file: file ? {
        name: file.name,
        type: file.type,
        previewUrl: filePreview!,
      } : undefined,
    };
    
    const botMessagePlaceholder: ChatMessage = { id: crypto.randomUUID(), sender: 'bot', text: '' };
    setMessages((prev) => [...prev, userMessage, botMessagePlaceholder]);
    
    let fileData: { data: string; mimeType: string } | undefined = undefined;
    if (file) {
      try {
        const base64Data = await fileToBase64(file, setUploadProgress);
        fileData = { data: base64Data, mimeType: file.type };
      } catch (error) {
        console.error("Error processing file:", error);
        setFileError("ଫାଇଲ୍ ପ୍ରକ୍ରିୟାକରଣ କରିବାରେ ବିଫଳ।");
        setIsLoading(false);
        setMessages(prev => prev.slice(0, -1)); // Remove bot placeholder
        return;
      }
    }
    
    const currentInput = input;
    setInput('');
    removeFile();
    setUploadProgress(0);

    try {
      const onChunk = (chunk: string) => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages.find(m => m.id === botMessagePlaceholder.id);
          if (lastMessage) {
            lastMessage.text += chunk;
          }
          return newMessages;
        });
      };
      
      let finalBotResponse = '';
      if (isVideoUrl) {
          finalBotResponse = await analyzeVideoUrl(currentInput.trim(), onChunk);
      } else {
          finalBotResponse = await runChat(currentInput, onChunk, fileData);
      }
      
      setMessages(prev => prev.map(m => m.id === botMessagePlaceholder.id ? {...m, text: finalBotResponse} : m));

    } catch (error) {
       // Error is streamed into the message box by the service
    } finally {
      setIsLoading(false);
    }
  };

  const renderFilePreview = (file: ChatMessage['file']) => {
    if (!file) return null;
    const { type, previewUrl, name } = file;
    if (type.startsWith('image/')) {
      return <img src={previewUrl} alt={name} className="max-h-60 rounded-lg mt-2" />;
    }
    if (type.startsWith('video/')) {
      return <video src={previewUrl} controls className="max-h-60 rounded-lg mt-2" />;
    }
    return (
      <div className="bg-slate-700/50 p-3 rounded-lg mt-2 text-sm border border-slate-600 flex items-center gap-3">
        <DocumentIcon />
        <p className="font-semibold">{name}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50">
      <div className="flex-grow p-4 sm:p-6 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
               {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-cyan-400 text-lg">
                    ସ
                  </div>
                )}
              <div className={`max-w-md md:max-w-lg p-4 rounded-2xl shadow-md ${msg.sender === 'user' ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-bl-md'}`}>
                {msg.file && renderFilePreview(msg.file)}
                <p className={`text-[15px] ${msg.file ? 'mt-2' : ''}`} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.625' }}>{msg.text}</p>
                {msg.sender === 'bot' && isLoading && messages[messages.length-1].id === msg.id && !msg.text && (
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping ml-2 inline-block"></div>
                )}
              </div>
              {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center font-bold text-white text-lg">
                    ଆ
                  </div>
                )}
            </div>
             {msg.sender === 'bot' && !isLoading && msg.text && (
                <div className="flex gap-2 items-center mt-2 ml-11">
                    <button onClick={() => handleFeedback(msg.id, 'liked')} disabled={!!msg.feedback} className="disabled:opacity-50">
                        <ThumbsUpIcon className={msg.feedback === 'liked' ? 'text-cyan-400' : 'text-slate-500 hover:text-white transition-colors'} />
                    </button>
                    <button onClick={() => handleFeedback(msg.id, 'disliked')} disabled={!!msg.feedback} className="disabled:opacity-50">
                        <ThumbsDownIcon className={msg.feedback === 'disliked' ? 'text-red-400' : 'text-slate-500 hover:text-white transition-colors'} />
                    </button>
                    {msg.feedback && <p className="text-xs text-slate-400">ପ୍ରତିକ୍ରିୟା ପାଇଁ ଧନ୍ୟବାଦ!</p>}
                </div>
            )}
          </div>
        ))}
        {!currentUser && messages.length === 0 && !isLoading && (
          <div className="text-center text-slate-400 mt-8">
            <p className="text-lg">ନମସ୍କାର! ମୁଁ ସତ୍ୟଶ୍ରୀ।</p>
            <p>ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?</p>
            <p className="text-sm mt-4">ଚାଟ୍ ଇତିହାସ ସଞ୍ଚୟ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 backdrop-blur-sm">
        {currentUser && (
            <div className="text-xs text-slate-400 mb-2 flex items-center justify-center gap-1.5">
                <SaveIcon />
                <span>ଆପଣଙ୍କ ଚାଟ୍ ଇତିହାସ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ସଞ୍ଚୟ ହେଉଛି।</span>
            </div>
        )}
        {fileError && <p className="text-red-400 text-sm text-center mb-2">{fileError}</p>}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-2 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full transition-all duration-150" style={{width: `${uploadProgress}%`}}></div>
          </div>
        )}
        {filePreview && (
          <div className="relative mb-3 p-2 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-start gap-3">
              {file?.type.startsWith('image/') ? (
                <img src={filePreview} alt="preview" className="h-16 w-16 object-cover rounded-md" />
              ) : file?.type.startsWith('video/') ? (
                 <video src={filePreview} className="h-16 w-16 object-cover rounded-md" />
              ) : (
                <div className="h-16 w-16 bg-slate-600 rounded-md flex items-center justify-center text-slate-400">
                  <DocumentIcon />
                </div>
              )}
              <div className="text-sm text-slate-300 overflow-hidden flex-grow pt-1">
                <p className="font-semibold truncate">{file?.name}</p>
                <p className="text-xs text-slate-400">{file && (file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={removeFile} className="absolute top-1 right-1 bg-slate-800/50 rounded-full p-1 text-white hover:bg-slate-800">
              <CloseIcon />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 p-3 rounded-full hover:bg-slate-700 hover:text-cyan-400 transition-colors flex-shrink-0"
            disabled={isLoading}
          >
            <PaperclipIcon />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ଏକ ଫାଇଲ୍, ଭିଡିଓ ଲିଙ୍କ୍, କିମ୍ବା ବାର୍ତ୍ତା ଲେଖନ୍ତୁ..."
            className="flex-grow bg-slate-800 text-white placeholder-slate-400 rounded-full py-3 px-5 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
            disabled={isLoading}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,.pdf,.txt,.md,.csv,.json,.xml,.html"
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !file)}
            className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-3 rounded-full hover:opacity-90 disabled:from-slate-600 disabled:to-slate-700 disabled:opacity-70 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
