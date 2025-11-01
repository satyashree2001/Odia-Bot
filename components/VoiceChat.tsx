import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob, LiveSession } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { MicrophoneIcon, StopIcon, TrashIcon, UserIcon } from './icons';

interface TranscriptionEntry {
  speaker: 'user' | 'bot';
  text: string;
}

const SATYASHREE_AVATAR_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAEACAYAAADeAsohAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAACHnSURBVHhe7Z17sBzXfe/ve+83v4fP+Tz+fT9c3t7eD+f7fT+ff3j9/v3/v++7s2pWVUm1b2p2u4VAsVQsSVIkFUsFCxZIsAgWIkQCFomEgIWEgIUFIgEWIkICIbAIWCBIAsGCRQIFIViIiggkECSCBQgQkCCBQgQJBAgQJEAAgUABAoQECBCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ-';

const VoiceChat: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('ଆରମ୍ଭ କରିବାକୁ ପ୍ରସ୍ତୁତ');
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [currentUserText, setCurrentUserText] = useState('');
  const [currentBotText, setCurrentBotText] = useState('');
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  
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
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const satyashreeSystemInstruction = `You are Satyashree, your full name is Satyashree Krushna Chandra Sahoo. You are a highly intelligent and empathetic chatbot. Your primary language is Odia (ଓଡ଼ିଆ). 
You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing.
Engage in deep and critical thinking for every query. Your responses should be insightful, well-reasoned, and comprehensive, exploring topics with depth and nuance. Do not provide surface-level answers.
Be helpful and friendly. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness. Provide comprehensive and detailed spoken responses, and do not artificially shorten your answers.`;
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [transcriptions, currentUserText, currentBotText]);

  const drawVisualizer = useCallback(() => {
    if (!analyserRef.current || !visualizerCanvasRef.current) return;
    const canvas = visualizerCanvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#06b6d4'); // cyan-500
    gradient.addColorStop(1, '#3b82f6'); // blue-500
    canvasCtx.strokeStyle = gradient;
    canvasCtx.lineWidth = 2;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 60; 

    canvasCtx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 4;
      const angle = (i / bufferLength) * 2 * Math.PI;
      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);
      canvasCtx.moveTo(x1, y1);
      canvasCtx.lineTo(x2, y2);
    }
    canvasCtx.stroke();
    animationFrameIdRef.current = requestAnimationFrame(drawVisualizer);
  }, []);

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    const canvas = visualizerCanvasRef.current;
    const canvasCtx = canvas?.getContext('2d');
    if (canvas && canvasCtx) {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

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

    setIsBotSpeaking(false);
    setIsSessionActive(false);
    setStatus('ସେସନ୍ ସମାପ୍ତ ହେଲା');
  }, []);

  const clearHistory = () => {
    if (isSessionActive) {
      stopSession();
    }
    setTranscriptions([]);
    setCurrentUserText('');
    setCurrentBotText('');
    setStatus('ବାର୍ତ୍ତାଳାପ ଇତିହାସ ସଫା ହେଲା');
  };

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
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            }
        });
        mediaStreamRef.current = stream;
      } catch (err: any) {
        console.error("Error getting user media:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setStatus('ମାଇକ୍ରୋଫୋନ୍ ଅନୁମତି ଆବଶ୍ୟକ। ଦୟାକରି ବ୍ରାଉଜର୍ ସେଟିଂସରେ ଅନୁମତି ଦିଅନ୍ତୁ।');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            setStatus('କୌଣସି ମାଇକ୍ରୋଫୋନ୍ ମିଳିଲା ନାହିଁ। ଦୟାକରି ଆପଣଙ୍କ ଡିଭାଇସ୍ ଯାଞ୍ଚ କରନ୍ତୁ।');
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

      const historyText = transcriptions
        .map(t => `${t.speaker === 'user' ? 'User' : 'Satyashree'}: ${t.text}`)
        .join('\n');
      
      const instructionWithHistory = historyText
        ? `${satyashreeSystemInstruction}\n\nPREVIOUS CONVERSATION HISTORY:\n${historyText}`
        : satyashreeSystemInstruction;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: instructionWithHistory,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }, // Male voice
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

            const analyser = inputAudioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            
            source.connect(analyser);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            source.connect(scriptProcessor);
            
            drawVisualizer();

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: GenAiBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
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
              setCurrentUserText('');
              setCurrentBotText('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              setIsBotSpeaking(true);
              const outputCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setIsBotSpeaking(false);
                }
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            let errorMessage = 'ସେସନ୍ ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
            if (e.message.toLowerCase().includes('api key')) {
                errorMessage = 'API କି ସହିତ ଏକ ସମସ୍ୟା ଅଛି। ଦୟାକରି ଯାଞ୍ଚ କରନ୍ତୁ।';
            } else if (e.message.toLowerCase().includes('network') || e.message.toLowerCase().includes('failed to fetch')) {
                errorMessage = 'ନେଟୱାର୍କ ସଂଯୋଗରେ ସମସ୍ୟା। ଦୟାକରି ଆପଣଙ୍କର ଇଣ୍ଟରନେଟ୍ ଯାଞ୍ଚ କରନ୍ତୁ।';
            } else if (e.message.includes('429')) {
                errorMessage = 'ବହୁତ ଅଧିକ ଅନୁରୋଧ। ଦୟାକରି କିଛି ସମୟ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।';
            }
            setStatus(`ତ୍ରୁଟି: ${errorMessage}`);
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
      let friendlyMessage = 'ଏକ ଅଜ୍ଞାତ ତ୍ରୁଟି ଘଟିଛି।';
      if (error.message.includes('API key not found')) {
          friendlyMessage = 'API କି ମିଳିଲା ନାହିଁ। ଦୟାକରି ଆପ୍ଲିକେସନ୍ କନ୍ଫିଗରେସନ୍ ଯାଞ୍ଚ କରନ୍ତୁ।';
      } else {
          friendlyMessage = error.message;
      }
      setStatus(`ସେସନ୍ ଆରମ୍ଭ କରିବାରେ ବିଫଳ: ${friendlyMessage}`);
      setIsSessionActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        {transcriptions.length === 0 && !currentUserText && !currentBotText && (
           <div className="flex flex-col justify-center items-center h-full text-slate-400 text-center p-4">
             <div className={`relative mb-4 w-40 h-40 rounded-full border-2 border-slate-700 p-1 ${isBotSpeaking ? 'animate-pulse-glow' : ''}`}>
                 <img src={SATYASHREE_AVATAR_URL} alt="Satyashree Avatar" className="w-full h-full object-contain rounded-full" />
             </div>
             <p className="mt-2 text-xl font-bold text-slate-200">ସତ୍ୟଶ୍ରୀ ଆପଣଙ୍କ ସହ କଥା ହେବାକୁ ପ୍ରସ୍ତୁତ</p>
             <p className="mt-1 text-slate-400">ସେସନ୍ ଆରମ୍ଭ କରିବାକୁ ମାଇକ୍ ବଟନ୍ ଦବାନ୍ତୁ</p>
           </div>
        )}
        {transcriptions.map((entry, index) => (
          <div key={index} className={`flex items-end gap-3 ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            {entry.speaker === 'bot' && (
                <img src={SATYASHREE_AVATAR_URL} alt="Satyashree Avatar" className="w-8 h-8 rounded-full flex-shrink-0 order-1" />
            )}
            <div className={`max-w-xl p-3 rounded-2xl ${entry.speaker === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white order-1 rounded-br-md' : 'bg-slate-800 text-slate-200 order-2 rounded-bl-md'}`}>
              <p>{entry.text || '...'}</p>
            </div>
             {entry.speaker === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center order-2 flex-shrink-0">
                    <UserIcon />
                </div>
            )}
          </div>
        ))}
        {currentUserText && (
            <div className="flex items-end gap-3 justify-end">
                <div className="max-w-xl p-3 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white order-1 rounded-br-md opacity-80">
                    <p>{currentUserText}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center order-2 flex-shrink-0">
                    <UserIcon />
                </div>
            </div>
        )}
        {currentBotText && (
            <div className="flex items-end gap-3 justify-start">
                <img src={SATYASHREE_AVATAR_URL} alt="Satyashree Avatar" className="w-8 h-8 rounded-full flex-shrink-0 order-1" />
                <div className="max-w-xl p-3 rounded-2xl bg-slate-800 text-slate-200 order-2 rounded-bl-md opacity-80">
                    <p>{currentBotText}<span className="blinking-cursor"></span></p>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-6 bg-slate-900/30 border-t border-slate-700/50 flex flex-col items-center justify-center backdrop-blur-sm relative">
        <button
          onClick={clearHistory}
          aria-label="Clear history"
          className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full text-slate-400 bg-slate-800/50 hover:bg-slate-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
          disabled={isSessionActive}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
        <div className="relative flex items-center justify-center w-40 h-40">
            <canvas ref={visualizerCanvasRef} width="280" height="280" className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 ${isSessionActive ? 'opacity-100' : 'opacity-0'}`}></canvas>
            <button 
              onClick={isSessionActive ? stopSession : startSession}
              aria-label={isSessionActive ? "Stop session" : "Start session"}
              className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full text-white transition-all duration-300 focus:outline-none focus:ring-4
                ${isSessionActive 
                  ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500/50' 
                  : 'bg-green-500 hover:bg-green-600 focus:ring-green-500/50 animate-pulse'}`
              }
            >
              <span className="relative z-10 transform scale-150">
                {isSessionActive ? <StopIcon /> : <MicrophoneIcon />}
              </span>
            </button>
        </div>
        <p className="mt-4 font-medium text-cyan-300 text-center min-h-[1.5em]">{status}</p>
      </div>
    </div>
  );
};

export default VoiceChat;
