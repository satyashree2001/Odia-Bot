import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { type ChatMessage } from '../types';
import { SendIcon, PaperclipIcon, CloseIcon, DocumentIcon, ThumbsUpIcon, ThumbsDownIcon, CopyIcon, CheckIcon, SpeakerIcon, PlusIcon, LinkIcon, StopIcon, UserIcon, SatyashreeIcon } from './icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (prompt: string, file?: { data: string; mimeType: string; name: string; previewUrl: string }) => Promise<void>;
  onStopGeneration: () => void;
}

const MAX_FILE_SIZE_MB = 50;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const Chat: React.FC<ChatProps> = ({ messages, isLoading, onSendMessage, onStopGeneration }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'liked' | 'disliked'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const scrollHeight = textareaRef.current.scrollHeight;
        textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported) window.speechSynthesis.cancel();
    };
  }, [isSpeechSynthesisSupported]);
  
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
      setFilePreview(URL.createObjectURL(selectedFile));
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

    if (speakingMessageId) window.speechSynthesis.cancel();
    
    setFileError(null);

    let filePayload: { data: string; mimeType: string, name: string, previewUrl: string } | undefined = undefined;
    if (file && filePreview) {
      try {
        const base64Data = await fileToBase64(file);
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

    await onSendMessage(currentInput, filePayload);
  };

  const renderFilePreview = (file: ChatMessage['file']) => {
    if (!file) return null;
    const { type, previewUrl, name } = file;
    if (type.startsWith('image/')) return <img src={previewUrl} alt={name} className="max-h-60 rounded-lg mb-2" />;
    return (
      <div className="bg-gray-100 p-3 rounded-lg mb-2 text-sm border border-gray-200 flex items-center gap-3 dark:bg-gray-700 dark:border-gray-600">
        <DocumentIcon />
        <p className="font-semibold text-gray-700 dark:text-gray-300">{name}</p>
      </div>
    );
  };
  
  const MarkdownComponents = {
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100" {...props} />,
        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 pl-4 mb-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 pl-4 mb-2" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2 text-gray-600 dark:border-gray-600 dark:text-gray-400" {...props} />,
        code: ({ node, inline, children, ...props }) => {
          return !inline ? (
            <pre className="bg-gray-800 text-white p-3 rounded-md my-2 overflow-x-auto text-sm font-mono dark:bg-gray-900">
              <code>{String(children).replace(/\n$/, '')}</code>
            </pre>
          ) : (
            <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded font-mono text-sm dark:bg-gray-700 dark:text-gray-200" {...props}>
              {children}
            </code>
          );
        },
        a: ({ node, ...props }) => <a className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer" {...props} />,
        table: ({ node, ...props }) => <table className="table-auto w-full my-2 text-sm border-collapse border border-gray-300 dark:border-gray-600" {...props} />,
        thead: ({ node, ...props }) => <thead className="bg-gray-100 dark:bg-gray-700" {...props} />,
        th: ({ node, ...props }) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-200" {...props} />,
        td: ({ node, ...props }) => <td className="border border-gray-300 px-3 py-2 dark:border-gray-600" {...props} />,
  }

  return (
    <div className="h-full flex flex-col">
        <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto px-4 pt-8 pb-32">
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div key={msg.id} className={`w-full flex items-start gap-4 fade-in ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'bot' && (
                  <div className="flex-shrink-0 w-8 h-8">
                    <SatyashreeIcon />
                  </div>
                )}
                
                <div className={`max-w-xl p-4 rounded-xl shadow-sm text-gray-800 leading-relaxed dark:text-gray-200 ${
                    msg.sender === 'user'
                    ? 'bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                    : 'bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                }`}>
                    {msg.file && renderFilePreview(msg.file)}
                    <div className="text-base space-y-2">
                        {msg.sender === 'user' ? msg.text : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                {msg.text}
                            </ReactMarkdown>
                        )}
                        {isLoading && index === messages.length - 1 && (
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        )}
                    </div>
                    {msg.sender === 'bot' && !isLoading && msg.text && (
                        <div className="flex gap-2 items-center mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <button onClick={() => handleFeedback(msg.id, 'liked')} disabled={!!feedbackMap[msg.id]} className="disabled:opacity-50"><ThumbsUpIcon className={feedbackMap[msg.id] === 'liked' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}/></button>
                            <button onClick={() => handleFeedback(msg.id, 'disliked')} disabled={!!feedbackMap[msg.id]} className="disabled:opacity-50"><ThumbsDownIcon className={feedbackMap[msg.id] === 'disliked' ? 'text-red-500' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}/></button>
                            {isSpeechSynthesisSupported && <button onClick={() => handleSpeak(msg.text, msg.id)}><SpeakerIcon className={speakingMessageId === msg.id ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}/></button>}
                            <button onClick={() => handleCopy(msg.text, msg.id)} disabled={copiedMessageId === msg.id} className="flex items-center">{copiedMessageId === msg.id ? <CheckIcon className="text-green-500" /> : <CopyIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"/>}</button>
                        </div>
                    )}
                </div>

                {msg.sender === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8">
                    <UserIcon />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 bg-gray-50/80 backdrop-blur-md dark:bg-gray-900/80">
            <div className="max-w-4xl mx-auto px-4 py-3">
                {filePreview && (
                    <div className="relative mb-2 p-2 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                            {file?.type.startsWith('image/') ? <img src={filePreview} alt="preview" className="h-12 w-12 object-cover rounded-md" /> : <div className="h-12 w-12 bg-gray-100 rounded-md flex items-center justify-center dark:bg-gray-700"><DocumentIcon /></div>}
                            <div className="text-sm flex-grow overflow-hidden"><p className="font-semibold truncate dark:text-gray-200">{file?.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{file && (file.size / 1024 / 1024).toFixed(2)} MB</p></div>
                        </div>
                        <button onClick={removeFile} className="absolute top-1 right-1 bg-gray-200/50 rounded-full p-1 text-gray-600 hover:bg-gray-300 dark:bg-gray-600/50 dark:text-gray-300 dark:hover:bg-gray-500"><CloseIcon /></button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-center bg-white border border-gray-300 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:focus-within:ring-blue-500">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="pl-3 pr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300" disabled={isLoading} aria-label="Attach file">
                        <PaperclipIcon />
                    </button>
                    <textarea 
                        ref={textareaRef}
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                        placeholder="ଏକ ବାର୍ତ୍ତା ଲେଖନ୍ତୁ..." 
                        className="flex-grow bg-transparent text-gray-800 placeholder-gray-500 py-3 px-2 focus:outline-none transition resize-none dark:text-gray-200 dark:placeholder-gray-400" 
                        disabled={isLoading}
                        rows={1}
                        style={{ maxHeight: '200px' }}
                    />
                    <div className="p-2">
                        {isLoading ? (
                            <button
                                type="button"
                                onClick={onStopGeneration}
                                className="p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                aria-label="Stop generation"
                            >
                                <StopIcon className="h-5 w-5" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim() && !file}
                                className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-gray-200 dark:text-gray-800 dark:hover:bg-gray-300 dark:disabled:bg-gray-500"
                                aria-label="Send message"
                            >
                                <SendIcon className="h-5 w-5"/>
                            </button>
                        )}
                    </div>
                </form>
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,.pdf,.txt,.md,.csv,.json,.xml,.html"/>
                 <p className="text-xs text-center text-gray-500 mt-2 dark:text-gray-400">Satyashree can make mistakes. Consider checking important information.</p>
            </div>
        </div>
    </div>
  );
};

export default Chat;