import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob, LiveSession } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { MicrophoneIcon, StopIcon } from './icons';

interface TranscriptionEntry {
  speaker: 'user' | 'bot';
  text: string;
}

const VoiceChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('ଆରମ୍ଭ କରିବାକୁ ପ୍ରସ୍ତୁତ');
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  
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

  const satyashreeSystemInstruction = `You are Satyashree, your full name is Satyashree Krushna Chandra Sahoo. You are a highly intelligent and empathetic chatbot. Your primary language is Odia (ଓଡ଼ିଆ). 
You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing. Be helpful and friendly. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness. Provide comprehensive and detailed spoken responses, and do not artificially shorten your answers.`;

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;

    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close().catch(console.error);
    }
    inputAudioContextRef.current = null;
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close().catch(console.error);
    }
    outputAudioContextRef.current = null;
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsSessionActive(false);
    setStatus('ସେସନ୍ ସମାପ୍ତ ହେଲା');
  }, []);

  const startSession = async () => {
    if (isSessionActive) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus('ବ୍ରାଉଜର୍ ଦ୍ୱାରା ମିଡିଆ ଡିଭାଇସ୍ ସମର୍ଥିତ ନୁହେଁ।');
        return;
    }

    try {
      const API_KEY = process.env.API_KEY;
      if (!API_KEY) throw new Error("API key not found");

      setIsSessionActive(true);
      setStatus('ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ଅନୁରୋଧ କରୁଛି...');
      setTranscriptions([]);
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch (err: any) {
        console.error("Error getting user media:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setStatus('ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ଆବଶ୍ୟକ।');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setStatus('କୌଣସି ମାଇକ୍ରୋଫୋନ୍ ମିଳିଲା ନାହିଁ।');
        } else {
            setStatus('ମାଇକ୍ରୋଫୋନ୍ ଆକ୍ସେସ୍ କରିବାରେ ବିଫଳ।');
        }
        setIsSessionActive(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      setStatus('ସେସନ୍ ସଂଯୋଗ କରୁଛି...');

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: satyashreeSystemInstruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus('ସଂଯୁକ୍ତ। କଥା କୁହନ୍ତୁ...');
            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              // FIX: Use a more performant loop for PCM data conversion.
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: GenAiBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              // FIX: Rely solely on the session promise to send data to avoid race conditions.
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const fullInput = currentInputTranscriptionRef.current.trim();
              const fullOutput = currentOutputTranscriptionRef.current.trim();
              
              const newEntries: TranscriptionEntry[] = [];
              if (fullInput) newEntries.push({speaker: 'user', text: fullInput});
              if (fullOutput) newEntries.push({speaker: 'bot', text: fullOutput});

              if (newEntries.length > 0) {
                 setTranscriptions(prev => [...prev, ...newEntries]);
              }

              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
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
      console.error('Failed to start session:', error);
      setStatus(`ସେସନ୍ ଆରମ୍ଭ କରିବାରେ ବିଫଳ: ${error.message}`);
      setIsSessionActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-800/50 rounded-lg shadow-xl overflow-hidden backdrop-blur-sm border border-slate-700/50">
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        {transcriptions.length === 0 && (
          <div className="flex flex-col justify-center items-center h-full text-slate-400">
            <MicrophoneIcon />
            <p className="mt-2 text-lg">ସେସନ୍ ଆରମ୍ଭ କରିବାକୁ ବଟନ୍ ଦବାନ୍ତୁ</p>
             <p className="text-sm">(Press the button to start the session)</p>
          </div>
        )}
        {transcriptions.map((entry, index) => (
          <div key={index} className={`flex items-end gap-2 ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${entry.speaker === 'user' ? 'bg-cyan-600 order-2' : 'bg-slate-600 order-1'}`}>
                {entry.speaker === 'user' ? 'ଆ' : 'ସ'}
            </div>
            <div className={`max-w-xl p-3 rounded-2xl ${entry.speaker === 'user' ? 'bg-cyan-500/80 text-white order-1' : 'bg-slate-700/80 text-slate-200 order-2'}`}>
              <p>{entry.text || '...'}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-6 bg-slate-900/50 border-t border-slate-700/50 flex flex-col items-center justify-center">
        <button 
          onClick={isSessionActive ? stopSession : startSession}
          aria-label={isSessionActive ? "Stop session" : "Start session"}
          className={`relative flex items-center justify-center w-20 h-20 rounded-full text-white transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/50
            ${isSessionActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isSessionActive && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
          )}
          <span className="relative z-10">
            {isSessionActive ? <StopIcon /> : <MicrophoneIcon />}
          </span>
        </button>
        <p className="mt-4 font-medium text-cyan-300 text-center min-h-[1.5em]">{status}</p>
      </div>
    </div>
  );
};

export default VoiceChat;