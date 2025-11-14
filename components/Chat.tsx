

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { SendIcon, PaperclipIcon, CloseIcon, DocumentIcon, ThumbsUpIcon, ThumbsDownIcon, CopyIcon, CheckIcon, MicrophoneIcon, SpeakerIcon, PlusIcon } from './icons';

interface ChatProps {
  messages: ChatMessage[];
  currentUser: string | null;
  isLoading: boolean;
  onSendMessage: (prompt: string, file?: { data: string; mimeType: string; name: string; previewUrl: string }) => Promise<void>;
  onNewChat: () => void;
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

const Chat: React.FC<ChatProps> = ({ messages, currentUser, isLoading, onSendMessage, onNewChat }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'liked' | 'disliked'>>({});


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  const isSpeechRecognitionSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    if (!isSpeechRecognitionSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'or-IN';
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      setInput(finalTranscript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    }
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [isSpeechRecognitionSupported]);

  // Speech synthesis cleanup
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported) window.speechSynthesis.cancel();
    };
  }, [isSpeechSynthesisSupported]);
  
  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      recognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  };

  const handleSpeak = (textToSpeak: string, messageId: string) => {
    if (!isSpeechSynthesisSupported) return;
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'or-IN';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      setSpeakingMessageId(null);
    };
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };
  
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
      setFilePreview(selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/') ? URL.createObjectURL(selectedFile) : 'document');
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleFeedback = (messageId: string, feedback: 'liked' | 'disliked') => {
    setFeedbackMap(prev => ({...prev, [messageId]: feedback}));
  };
  
  const handleCopy = (textToCopy: string, messageId: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !file) || isLoading) return;

    if (isRecording) recognitionRef.current?.stop();
    if (speakingMessageId) window.speechSynthesis.cancel();
    
    setFileError(null);

    let filePayload: { data: string; mimeType: string, name: string, previewUrl: string } | undefined = undefined;
    if (file && filePreview) {
      try {
        const base64Data = await fileToBase64(file, setUploadProgress);
        filePayload = { data: base64Data, mimeType: file.type, name: file.name, previewUrl: filePreview };
      } catch (error) {
        console.error("Error processing file:", error);
        setFileError("ଫାଇଲ୍ ପ୍ରକ୍ରିୟାକରଣ କରିବାରେ ବିଫଳ।");
        return;
      }
    }
    
    const currentInput = input;
    setInput('');
    removeFile();
    setUploadProgress(0);

    await onSendMessage(currentInput, filePayload);
  };

  const renderFilePreview = (file: ChatMessage['file']) => {
    if (!file) return null;
    const { type, previewUrl, name } = file;
    if (type.startsWith('image/')) return <img src={previewUrl} alt={name} className="max-h-60 rounded-lg mt-2" />;
    if (type.startsWith('video/')) return <video src={previewUrl} controls className="max-h-60 rounded-lg mt-2" />;
    return (
      <div className="bg-slate-700/50 p-3 rounded-lg mt-2 text-sm border border-slate-600 flex items-center gap-3">
        <DocumentIcon />
        <p className="font-semibold">{name}</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50">
        <div className="p-3 border-b border-slate-700/50 flex justify-between items-center flex-shrink-0">
          <h2 className="font-bold text-lg text-slate-200">ଗପସପ (Chat)</h2>
          {currentUser && (
            <button
              onClick={onNewChat}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Start new chat"
            >
              <PlusIcon />
              <span className="hidden sm:inline">ନୂଆ ଚାଟ୍</span>
            </button>
          )}
        </div>
        <div className="flex-grow p-4 sm:p-6 space-y-4 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.sender === 'bot' && msg.mode && msg.text && (
                <div className="flex justify-start ml-11 mb-1">
                  <span className="text-xs text-cyan-400 opacity-80 px-2 py-0.5 bg-slate-700/60 rounded-md font-medium">
                    {msg.mode === 'fast' ? '⚡️ Fast Mode' : '🧠 Expert Mode'}
                  </span>
                </div>
              )}
              <div className={`flex items-end gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center font-bold text-cyan-400 text-lg">ସ</div>}
                <div className={`max-w-md md:max-w-lg p-4 rounded-2xl shadow-md ${msg.sender === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white' : 'bg-slate-800 text-slate-200'}`}>
                  {msg.file && renderFilePreview(msg.file)}
                  <div className={`text-[15px] ${msg.file ? 'mt-2' : ''}`} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.625' }}>
                    {msg.text}
                    {msg.sender === 'bot' && isLoading && messages[messages.length-1].id === msg.id && <span className="blinking-cursor"></span>}
                  </div>
                </div>
                {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center font-bold text-white text-lg">{currentUser ? currentUser.charAt(0).toUpperCase() : 'ଆ'}</div>}
              </div>
              {msg.sender === 'bot' && !isLoading && msg.text && (
                  <div className="flex gap-2 items-center mt-2 ml-11">
                      <button onClick={() => handleFeedback(msg.id, 'liked')} disabled={!!feedbackMap[msg.id]} className="disabled:opacity-50"><ThumbsUpIcon className={feedbackMap[msg.id] === 'liked' ? 'text-cyan-400' : 'text-slate-500 hover:text-white'}/></button>
                      <button onClick={() => handleFeedback(msg.id, 'disliked')} disabled={!!feedbackMap[msg.id]} className="disabled:opacity-50"><ThumbsDownIcon className={feedbackMap[msg.id] === 'disliked' ? 'text-red-400' : 'text-slate-500 hover:text-white'}/></button>
                      {isSpeechSynthesisSupported && <button onClick={() => handleSpeak(msg.text, msg.id)}><SpeakerIcon className={speakingMessageId === msg.id ? 'text-cyan-400 animate-pulse' : 'text-slate-500 hover:text-white'}/></button>}
                      <button onClick={() => handleCopy(msg.text, msg.id)} disabled={copiedMessageId === msg.id} className="flex items-center">{copiedMessageId === msg.id ? <><CheckIcon className="text-green-400" /><span className="text-xs text-green-400 ml-1">Copied!</span></> : <CopyIcon className="text-slate-500 hover:text-white"/>}</button>
                      {feedbackMap[msg.id] && <p className="text-xs text-slate-400">ପ୍ରତିକ୍ରିୟା ପାଇଁ ଧନ୍ୟବାଦ!</p>}
                  </div>
              )}
            </div>
          ))}
          {!currentUser && messages.length > 0 && messages.every(m => m.sender === 'bot') && !isLoading && (
            <div className="text-center text-slate-400 mt-8"><p className="text-sm mt-4">ଚାଟ୍ ଇତିହାସ ସଞ୍ଚୟ କରିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।</p></div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 backdrop-blur-sm">
          {fileError && <p className="text-red-400 text-sm text-center mb-2">{fileError}</p>}
          {uploadProgress > 0 && uploadProgress < 100 && <div className="mb-2 h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${uploadProgress}%`}}></div></div>}
          {filePreview && (
            <div className="relative mb-3 p-2 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-start gap-3">
                {file?.type.startsWith('image/') ? <img src={filePreview} alt="preview" className="h-16 w-16 object-cover rounded-md" /> : file?.type.startsWith('video/') ? <video src={filePreview} className="h-16 w-16 object-cover rounded-md" /> : <div className="h-16 w-16 bg-slate-600 rounded-md flex items-center justify-center"><DocumentIcon /></div>}
                <div className="text-sm flex-grow pt-1 overflow-hidden"><p className="font-semibold truncate">{file?.name}</p><p className="text-xs text-slate-400">{file && (file.size / 1024 / 1024).toFixed(2)} MB</p></div>
              </div>
              <button onClick={removeFile} className="absolute top-1 right-1 bg-slate-800/50 rounded-full p-1 text-white hover:bg-slate-800"><CloseIcon /></button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center">
              <div className="flex-grow flex items-center bg-slate-800 rounded-full focus-within:ring-2 focus-within:ring-cyan-400 transition">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 p-3 rounded-full hover:text-cyan-400 ml-1" disabled={isLoading}><PaperclipIcon /></button>
                  {isSpeechRecognitionSupported && <button type="button" onClick={handleToggleRecording} className={`text-slate-400 p-3 rounded-full ${isRecording ? 'bg-red-500/20 text-red-400 animate-pulse' : ''}`} disabled={isLoading}><MicrophoneIcon /></button>}
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ଏକ ଫାଇଲ୍, ଭିଡିଓ ଲିଙ୍କ୍, କିମ୍ବା ବାର୍ତ୍ତା ଲେଖନ୍ତୁ..." className="flex-grow bg-transparent text-white placeholder-slate-400 py-3 px-2 focus:outline-none" disabled={isLoading}/>
                  <button type="submit" disabled={isLoading || (!input.trim() && !file)} className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-3 rounded-full hover:opacity-90 disabled:from-slate-600 disabled:opacity-70 disabled:cursor-not-allowed mr-1"><SendIcon /></button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,.pdf,.txt,.md,.csv,.json,.xml,.html"/>
          </form>
        </div>
    </div>
  );
};

export default Chat;