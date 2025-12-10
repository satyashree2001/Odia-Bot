import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob, LiveSession } from '@google/genai';
import { transcribeAudio } from '../services/geminiService';
import { UploadIcon, CopyIcon, CheckIcon, CloseIcon, AudioFileIcon, LiveRecordIcon, StopIcon } from './icons';
import { useDropzone } from 'react-dropzone';
import { encode } from '../utils/audioUtils';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
  
const MAX_FILE_SIZE_MB = 100;

const transcriptionSystemInstruction = `You are a speech-to-text engine specialized ONLY for Odia (ଓଡ଼ିଆ) transcription.

Your job:
- Convert spoken Odia audio into pure Odia Unicode text.
- Never translate. Only transcribe EXACTLY what the speaker says.
- Never output Hindi or any other language under any condition.
- Never mix scripts. Produce ONLY Odia Unicode characters for Odia words.
- If an English word is spoken, keep it in English.
- Do NOT guess, rewrite, or correct meaning. Only transcribe what is spoken.

STRICT RULES:
1. You must always output text in Odia Unicode script (ଅ, ଆ, ଇ, ଈ, କ, ଖ, ଗ, ଘ, etc.).
2. Under NO situation are you allowed to output Devanagari/Hindi characters 
   (ि, ी, ु, ू, ा, ो, ै, etc.).
3. Do NOT auto-detect languages. Assume and transcribe ONLY Odia.
4. If the user speaks Hindi or any other non-Odia language, DO NOT transcribe it. Reply:
   “ଦୟାକରି ଓଡ଼ିଆରେ କୁହନ୍ତୁ, ମୁଁ କେବଳ ଓଡ଼ିଆ ଅଡିଓକୁ ଟେକ୍ସଟ୍ କରେ।”
5. Do NOT translate Hindi → Odia. Just give the above message.
6. If the audio is unclear, write:
   “ଶବ୍ଦ ସ୍ପଷ୍ଟ ନୁହେଁ, ଦୟାକରି ପୁଣିଥରେ କୁହନ୍ତୁ।”
7. If Odia is spoken with accent or mixed with Hindi, output ONLY the Odia portion in Unicode and ignore Hindi.
8. If any Hindi characters appear accidentally in your transcription, delete them and retry using pure Odia script.
9. Your output must ALWAYS be Odia Unicode text — never Romanized Odia (like *mu bhala achhi*).
10. Keep sentences clean, readable, and grammatically stable while preserving exact spoken meaning.

TECHNICAL BEHAVIOR GUIDELINES:
- Always assume the input language is "or" (Odia).
- Never activate multi-language or auto-language detection.
- Never output translated or interpreted content.
- Do not include explanations, metadata, timestamps, JSON, or labels.
- Final output must be ONLY the Odia transcription.

Your final answer should always be:
PURE ODIA UNICODE ★ No Hindi ★ No Translation ★ No Mixing`;

const Transcription: React.FC = () => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioPreview, setAudioPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    // Live Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [liveTranscript, setLiveTranscript] = useState('');

    const audioRef = useRef<HTMLAudioElement>(null);

    // Live Recording Refs
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const currentInputTranscriptionRef = useRef('');
    
    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${secs}`;
    };

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            if (!file.type.startsWith('audio/')) {
                 setError('ଦୟାକରି ଏକ ବୈଧ ଅଡିଓ ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ।');
                 return;
            }
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                setError(`ଫାଇଲ୍ ଆକାର ${MAX_FILE_SIZE_MB}MB ରୁ ଅଧିକ ହେବା ଉଚିତ୍ ନୁହେଁ।`);
                return;
            }
            
            clearState(false);
            setAudioFile(file);
            setAudioPreview(URL.createObjectURL(file));
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'audio/*': [] },
        multiple: false,
    });

    const handleTranscribe = async () => {
        if (!audioFile || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResultText(null);
        setCopied(false);
        if (audioRef.current) audioRef.current.pause();

        try {
            const base64Data = await fileToBase64(audioFile);
            const response = await transcribeAudio(base64Data, audioFile.type);
            setResultText(response);
        } catch (err: any) {
            setError(err.message || 'ଅଡିଓ ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।');
        } finally {
            setIsLoading(false);
        }
    };

    const stopRecording = useCallback(() => {
        setIsRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        
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

        const finalTranscript = currentInputTranscriptionRef.current;
        currentInputTranscriptionRef.current = '';

        if (finalTranscript) {
            setResultText(finalTranscript);
        }
        setLiveTranscript('');
    }, []);

    const startRecording = async () => {
        clearState();
        setIsRecording(true);
        setRecordingTime(0);
        setError(null);
        
        timerIntervalRef.current = window.setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

        try {
            const API_KEY = process.env.API_KEY;
            if (!API_KEY) throw new Error("API key not found");
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: API_KEY });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                  systemInstruction: transcriptionSystemInstruction,
                  responseModalities: [Modality.AUDIO],
                  inputAudioTranscription: {},
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                  },
                },
                callbacks: {
                    onopen: () => {
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
                            setLiveTranscript(currentInputTranscriptionRef.current);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setError(`ତ୍ରୁଟି: ${e.message}`);
                        stopRecording();
                    },
                    onclose: (e: CloseEvent) => {
                        if (isRecording) stopRecording();
                    },
                },
            });

        } catch (error: any) {
            setError(`ରେକର୍ଡିଂ ଆରମ୍ଭ କରିବାରେ ବିଫଳ: ${error.message}`);
            stopRecording();
        }
    };
    
    useEffect(() => {
      return () => {
        if (isRecording) stopRecording();
      };
    }, [isRecording, stopRecording]);


    const handleCopy = () => {
        if (!resultText) return;
        navigator.clipboard.writeText(resultText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const clearState = (fullReset = true) => {
        if (audioPreview) URL.revokeObjectURL(audioPreview);
        if (isRecording) stopRecording();
        if (fullReset) {
            setAudioFile(null);
            setAudioPreview(null);
        }
        setResultText(null);
        setError(null);
        setIsLoading(false);
        setCopied(false);
        setLiveTranscript('');
        setRecordingTime(0);
    };

    return (
        <div className="flex flex-col h-full p-4 md:p-6">
            <div className="flex-shrink-0 mb-4 text-center">
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">ଶ୍ରୁତଲିଖନ (Audio Transcription)</h2>
                 <p className="text-gray-600 dark:text-gray-400">ଏକ ଅଡିଓ ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ କିମ୍ବା ଲାଇଭ୍ ରେକର୍ଡ କରନ୍ତୁ।</p>
            </div>
            <div className="flex-grow overflow-y-auto rounded-lg bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm p-4 md:p-6">
                <div className="flex flex-col lg:flex-row gap-6 h-full">
                    
                    {/* Left Column: Input */}
                    <div className="lg:w-1/2 flex flex-col gap-4">
                        {/* File Upload */}
                        <div {...getRootProps()} className={`relative flex flex-col justify-center items-center h-48 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'}`}>
                            <input {...getInputProps()} disabled={isRecording} />
                            <UploadIcon className="text-gray-400 dark:text-gray-500 mb-2" />
                            <p className="font-semibold text-gray-700 dark:text-gray-300">ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ</p>
                            <p className="text-sm">କିମ୍ବା ଫାଇଲକୁ ଏଠାକୁ ଟାଣି ଆଣନ୍ତୁ</p>
                            {audioFile && (
                                <div className="absolute inset-0 bg-white dark:bg-gray-800/90 p-2 flex flex-col justify-center items-center text-left">
                                    <AudioFileIcon className="h-10 w-10 text-blue-500 mb-2" />
                                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-full px-4">{audioFile.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <button onClick={(e) => { e.stopPropagation(); clearState(); }} className="absolute top-2 right-2 p-1 rounded-full bg-gray-200/80 hover:bg-gray-300 dark:bg-gray-600/80 dark:hover:bg-gray-500"><CloseIcon /></button>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <hr className="flex-grow border-gray-200 dark:border-gray-700"/>
                            <span className="text-gray-500 dark:text-gray-400">କିମ୍ବା</span>
                            <hr className="flex-grow border-gray-200 dark:border-gray-700"/>
                        </div>

                        {/* Live Record */}
                        <div className={`flex flex-col items-center justify-center p-4 rounded-lg transition-colors ${isRecording ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-900/20'}`}>
                             {!isRecording ? (
                                <button onClick={startRecording} disabled={!!audioFile} className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:text-blue-400">
                                    <LiveRecordIcon className="mb-2 h-10 w-10"/>
                                    <span className="font-semibold">ଲାଇଭ୍ ରେକର୍ଡ କରନ୍ତୁ</span>
                                </button>
                             ) : (
                                <div className="flex flex-col items-center justify-center w-full">
                                    <div className="flex items-center gap-2 text-red-500">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span>REC</span>
                                    </div>
                                    <p className="text-2xl font-mono my-2 text-gray-800 dark:text-gray-200">{formatTime(recordingTime)}</p>
                                    <button onClick={stopRecording} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2">
                                        <StopIcon className="h-4 w-4" /> ବନ୍ଦ କରନ୍ତୁ
                                    </button>
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Right Column: Output */}
                    <div className="lg:w-1/2 flex flex-col">
                         {audioPreview && !resultText && (
                            <div className="mb-4 text-center p-4 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                                 <audio ref={audioRef} src={audioPreview} controls className="w-full"></audio>
                                 <button onClick={handleTranscribe} disabled={isLoading} className="mt-4 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                                    {isLoading ? 'ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରୁଛି...' : 'ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରନ୍ତୁ'}
                                </button>
                            </div>
                        )}
                        
                        <div className={`relative flex-grow p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 min-h-[200px] border ${(liveTranscript || resultText) ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
                           <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">ଟ୍ରାନ୍ସକ୍ରିପସନ୍ ଫଳାଫଳ</h3>
                           <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {liveTranscript && <p>{liveTranscript}<span className="inline-block w-2 h-4 bg-gray-600 dark:bg-gray-400 animate-pulse ml-1"></span></p>}
                                {resultText && <p>{resultText}</p>}
                                {!liveTranscript && !resultText && !isLoading && (
                                    <p className="text-gray-400 dark:text-gray-500">ଫଳାଫଳ ଏଠାରେ ଦେଖାଯିବ...</p>
                                )}
                                {isLoading && !isRecording && (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-blue-500"></div>
                                        <span>ପ୍ରକ୍ରିୟାକରଣ କରୁଛି...</span>
                                    </div>
                                )}
                           </div>
                           {resultText && (
                             <button onClick={handleCopy} className="absolute top-3 right-3 flex items-center gap-1.5 text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                                {copied ? <CheckIcon className="text-green-500"/> : <CopyIcon />}
                                {copied ? 'କପି ହେଲା' : 'କପି କରନ୍ତୁ'}
                            </button>
                           )}
                        </div>
                         {error && (
                            <div className="mt-4 text-center text-red-500 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-sm">
                                <p>{error}</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Transcription;