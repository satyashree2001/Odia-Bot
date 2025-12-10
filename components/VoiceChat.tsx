import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob, LiveSession } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { MicrophoneIcon, StopIcon, TrashIcon, UserIcon, OdiaBotIcon } from './icons';

interface TranscriptionEntry {
  speaker: 'user' | 'bot';
  text: string;
}

const VoiceChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('ଆରମ୍ଭ କରିବାକୁ ପ୍ରସ୍ତୁତ');
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentBotText, setCurrentBotText] = useState('');
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const odiaBotSystemInstruction = `You are OdiaBot. Your primary language is Odia (ଓଡ଼ିଆ). You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing. Be helpful and friendly.`;
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcriptions, currentUserText, currentBotText]);


  const stopSession = useCallback(() => {
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;

    if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
    inputAudioContextRef.current = null;
    if (outputAudioContextRef.current?.state !== 'closed') outputAudioContextRef.current?.close();
    outputAudioContextRef.current = null;
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsSessionActive(false);
    setStatus('ସେସନ୍ ସମାପ୍ତ ହେଲା');
  }, []);

  const clearHistory = () => {
    if (window.confirm('ଆପଣ ନିଶ୍ଚିତ ଯେ ଆପଣ ଏହି ବାର୍ତ୍ତାଳାପ ଇତିହାସ ସଫା କରିବାକୁ ଚାହୁଁଛନ୍ତି?')) {
      if (isSessionActive) stopSession();
      setTranscriptions([]);
      setCurrentUserText('');
      setCurrentBotText('');
      setStatus('ବାର୍ତ୍ତାଳାପ ଇତିହାସ ସଫା ହେଲା');
    }
  };

  const startSession = async () => {
    if (isSessionActive) return;

    try {
      const API_KEY = process.env.API_KEY;
      if (!API_KEY) throw new Error("API key not found");

      setIsSessionActive(true);
      setStatus('ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ଅନୁରୋଧ କରୁଛି...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: API_KEY });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      setStatus('ସେସନ୍ ସଂଯୋଗ କରୁଛି...');

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: odiaBotSystemInstruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
        },
        callbacks: {
          onopen: () => {
            setStatus('ସଂଯୁକ୍ତ। କଥା କୁହନ୍ତୁ...');
            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            source.connect(scriptProcessor);
            
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: GenAiBlob = {
                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
              setCurrentUserText(currentInputTranscriptionRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
              setCurrentBotText(currentOutputTranscriptionRef.current);
            }
            if (message.serverContent?.turnComplete) {
              const newEntries: TranscriptionEntry[] = [];
              if (currentInputTranscriptionRef.current.trim()) newEntries.push({speaker: 'user', text: currentInputTranscriptionRef.current.trim()});
              if (currentOutputTranscriptionRef.current.trim()) newEntries.push({speaker: 'bot', text: currentOutputTranscriptionRef.current.trim()});
              if(newEntries.length > 0) setTranscriptions(prev => [...prev, ...newEntries]);
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
              setCurrentUserText('');
              setCurrentBotText('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const outputCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setStatus(`ତ୍ରୁଟି: ${e.message}`);
            stopSession();
          },
          onclose: (e: CloseEvent) => {
            if (isSessionActive) {
                setStatus('ସେସନ୍ ବନ୍ଦ ହେଲା');
                stopSession();
            }
          },
        },
      });
    } catch (error: any) {
      setStatus(`ସେସନ୍ ଆରମ୍ଭ କରିବାରେ ବିଫଳ: ${error.message}`);
      setIsSessionActive(false);
    }
  };

  useEffect(() => () => stopSession(), [stopSession]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto px-4 pt-8 pb-48">
        {transcriptions.length === 0 && !currentUserText && !currentBotText && (
           <div className="flex flex-col justify-center items-center h-full text-gray-600 dark:text-gray-400 text-center p-4">
             <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4 dark:bg-gray-700"><OdiaBotIcon className="h-16 w-16"/></div>
             <p className="mt-2 text-2xl font-medium text-gray-800 dark:text-gray-200">OdiaBot Voice</p>
             <p className="mt-1">ସେସନ୍ ଆରମ୍ଭ କରିବାକୁ ମାଇକ୍ ବଟନ୍ ଦବାନ୍ତୁ</p>
           </div>
        )}
        <div className="space-y-6">
            {transcriptions.map((entry, index) => (
            <div key={index} className={`flex items-start gap-4 fade-in ${entry.speaker === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 w-8 h-8">{entry.speaker === 'bot' ? <OdiaBotIcon /> : <UserIcon />}</div>
                <div className="max-w-xl p-4 rounded-xl bg-white border border-gray-200 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"><p>{entry.text || '...'}</p></div>
            </div>
            ))}
            {currentUserText && (
                <div className="flex items-start gap-4 flex-row-reverse opacity-70">
                    <div className="flex-shrink-0 w-8 h-8"><UserIcon /></div>
                    <div className="max-w-xl p-4 rounded-xl bg-white border border-gray-200 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"><p>{currentUserText}</p></div>
                </div>
            )}
            {currentBotText && (
                <div className="flex items-start gap-4 opacity-70">
                    <div className="flex-shrink-0 w-8 h-8"><OdiaBotIcon /></div>
                    <div className="max-w-xl p-4 rounded-xl bg-white border border-gray-200 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"><p>{currentBotText}<span className="inline-block w-2 h-4 bg-gray-600 dark:bg-gray-400 animate-pulse ml-1"></span></p></div>
                </div>
            )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-50/80 backdrop-blur-md dark:bg-gray-900/80">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col items-center justify-center relative">
            <button
                onClick={clearHistory}
                disabled={!isSessionActive && transcriptions.length === 0}
                aria-label="Clear history"
                className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
            >
                <TrashIcon className="h-5 w-5" />
            </button>
            <button 
                onClick={isSessionActive ? stopSession : startSession}
                aria-label={isSessionActive ? "Stop session" : "Start session"}
                className={`flex items-center justify-center w-20 h-20 rounded-full text-white transition-all duration-300 focus:outline-none focus:ring-4
                    ${isSessionActive 
                    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/50 animate-pulse' 
                    : 'bg-green-500 hover:bg-green-600 focus:ring-green-500/50'}`
                }
            >
                {isSessionActive ? <StopIcon /> : <MicrophoneIcon />}
            </button>
            <p className="mt-4 font-medium text-gray-700 text-center min-h-[1.5em] dark:text-gray-300">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;