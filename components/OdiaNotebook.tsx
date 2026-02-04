import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import { 
  PlusIcon, TrashIcon, SendIcon, DocumentIcon, PDFIcon, WordIcon, 
  SlideIcon, InfographicIcon, PodcastIcon, StopIcon, SpeakerIcon, CloseIcon, CheckIcon, SparklesIcon, ImageIcon
} from './icons';
import { generateNotebookContent, generatePodcastAudio, generateImageInfographic } from '../services/geminiService';
import { NotebookArtifact, NotebookArtifactType } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { decode, decodeAudioData } from '../utils/audioUtils';

const OdiaNotebook: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<{ id: string; name: string; data: string; mimeType: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [artifacts, setArtifacts] = useState<NotebookArtifact[]>([]);
  const [activeArtifactIndex, setActiveArtifactIndex] = useState<number | null>(null);
  const [podcastAudioBase64, setPodcastAudioBase64] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(acceptedFiles.map(async f => {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(f);
      });
      return { id: crypto.randomUUID(), name: f.name, data: base64, mimeType: f.type };
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleGenerate = async (type: NotebookArtifactType) => {
    if (!prompt.trim() && files.length === 0) return;
    setIsGenerating(true);
    setPodcastAudioBase64(null);

    try {
      const filePayload = files.map(f => ({ data: f.data, mimeType: f.mimeType }));
      
      if (type === 'image_infographic') {
        const imageUrl = await generateImageInfographic(prompt || "Create a beautiful infographic summary", filePayload);
        const newArtifact: NotebookArtifact = {
          type,
          title: `Visual Infographic - ${new Date().toLocaleTimeString()}`,
          content: '',
          imageUrl: imageUrl
        };
        setArtifacts(prev => [newArtifact, ...prev]);
        setActiveArtifactIndex(0);
        return;
      }

      const result = await generateNotebookContent(prompt || "Analyze these documents", type, filePayload);
      
      const newArtifact: NotebookArtifact = {
        type,
        title: result.title || `Odia ${type.toUpperCase()} - ${new Date().toLocaleDateString()}`,
        content: result.summary || result.content || '',
        slides: result.slides,
        infographic: result.items,
        podcastScript: result.script
      };

      setArtifacts(prev => [newArtifact, ...prev]);
      setActiveArtifactIndex(0);
    } catch (error) {
      console.error(error);
      alert("Error generating content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = (artifact: NotebookArtifact) => {
    const doc = new jsPDF();
    doc.setFont("helvetica"); // Default font, Odia might need a specialized font loaded
    doc.text(artifact.title, 10, 10);
    let y = 20;
    if (artifact.type === 'pdf' && (artifact as any).sections) {
      (artifact as any).sections.forEach((s: any) => {
        doc.setFontSize(14);
        doc.text(s.heading, 10, y);
        y += 10;
        doc.setFontSize(11);
        const splitText = doc.splitTextToSize(s.content, 180);
        doc.text(splitText, 10, y);
        y += splitText.length * 5 + 10;
      });
    } else {
      const splitText = doc.splitTextToSize(artifact.content, 180);
      doc.text(splitText, 10, y);
    }
    doc.save(`${artifact.title}.pdf`);
  };

  const downloadWord = (artifact: NotebookArtifact) => {
    const sections: any[] = [];
    if (artifact.type === 'word' && (artifact as any).sections) {
       (artifact as any).sections.forEach((s: any) => {
         sections.push(new docx.Paragraph({ text: s.heading, heading: docx.HeadingLevel.HEADING_1 }));
         sections.push(new docx.Paragraph({ text: s.content }));
       });
    } else {
       sections.push(new docx.Paragraph({ text: artifact.title, heading: docx.HeadingLevel.HEADING_1 }));
       sections.push(new docx.Paragraph({ text: artifact.content }));
    }

    const doc = new docx.Document({
      sections: [{ properties: {}, children: sections }]
    });

    docx.Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${artifact.title}.docx`;
      a.click();
    });
  };

  const playPodcast = async (script: { speaker: string; text: string }[]) => {
    setIsAudioLoading(true);
    try {
      const base64 = await generatePodcastAudio(script);
      setPodcastAudioBase64(base64);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const buffer = await decodeAudioData(decode(base64), audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (e) {
      console.error(e);
      alert("Failed to generate podcast audio.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  const activeArtifact = activeArtifactIndex !== null ? artifacts[activeArtifactIndex] : null;

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar - Sources */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="font-bold dark:text-gray-100">Sources</h2>
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600">
              <PlusIcon />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {files.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              <DocumentIcon className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Upload docs to start</p>
            </div>
          )}
          {files.map(f => (
            <div key={f.id} className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <DocumentIcon className="h-5 w-5 text-gray-500" />
              <p className="flex-1 text-xs font-medium truncate dark:text-gray-300">{f.name}</p>
              <button onClick={() => removeFile(f.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
           <textarea
             value={prompt}
             onChange={e => setPrompt(e.target.value)}
             placeholder="What do you want to generate?"
             className="w-full text-sm p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
           />
           <div className="grid grid-cols-2 gap-2 mt-4">
             <button onClick={() => handleGenerate('summary')} className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">
               <SparklesIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">Summary</span>
             </button>
             <button onClick={() => handleGenerate('image_infographic')} className="flex items-center gap-2 p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
               <ImageIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">Visual Infog.</span>
             </button>
             <button onClick={() => handleGenerate('pdf')} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300">
               <PDFIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">PDF</span>
             </button>
             <button onClick={() => handleGenerate('word')} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
               <WordIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">Word</span>
             </button>
             <button onClick={() => handleGenerate('slides')} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
               <SlideIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">Slides</span>
             </button>
             <button onClick={() => handleGenerate('podcast')} className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300">
               <PodcastIcon className="h-4 w-4" />
               <span className="text-[10px] font-bold">Podcast</span>
             </button>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isGenerating && (
          <div className="absolute inset-0 z-50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm flex items-center justify-center">
             <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 font-bold text-gray-800 dark:text-gray-100">ଓଡ଼ିଆରେ ପ୍ରସ୍ତୁତ କରୁଛି (Generating in Odia)...</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Creating high-quality visual content. Please wait.</p>
             </div>
          </div>
        )}

        {/* History List for Notebook */}
        <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 bg-white dark:bg-gray-800 overflow-x-auto">
          {artifacts.map((art, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveArtifactIndex(idx)}
              className={`text-xs whitespace-nowrap px-3 py-1 rounded-full border transition-colors ${activeArtifactIndex === idx ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {art.title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {!activeArtifact && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6 text-indigo-600">
                <SparklesIcon className="h-10 w-10" />
              </div>
              <h1 className="text-3xl font-bold dark:text-white mb-4">ଓଡ଼ିଆ ନୋଟବୁକ୍ (Odia Notebook)</h1>
              <p className="text-gray-600 dark:text-gray-400">
                ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ କିମ୍ବା ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ ଏବଂ ଓଡ଼ିଆରେ PDF, Word, Presentation ଏବଂ Podcasts ତିଆରି କରନ୍ତୁ।
              </p>
            </div>
          )}

          {activeArtifact && (
            <div className="max-w-4xl mx-auto space-y-8 fade-in">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold dark:text-white">{activeArtifact.title}</h2>
                <div className="flex gap-2">
                  {(activeArtifact.type === 'pdf' || activeArtifact.type === 'summary') && (
                    <button onClick={() => downloadPDF(activeArtifact)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Download PDF">
                      <PDFIcon />
                    </button>
                  )}
                  {(activeArtifact.type === 'word' || activeArtifact.type === 'summary') && (
                    <button onClick={() => downloadWord(activeArtifact)} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Download Word">
                      <WordIcon />
                    </button>
                  )}
                  {activeArtifact.type === 'image_infographic' && activeArtifact.imageUrl && (
                    <a href={activeArtifact.imageUrl} download="infographic.png" className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200" title="Download Image">
                      <ImageIcon />
                    </a>
                  )}
                </div>
              </div>

              {/* Specific Artifact Views */}
              {activeArtifact.type === 'image_infographic' && activeArtifact.imageUrl && (
                <div className="flex justify-center bg-gray-100 dark:bg-gray-800 p-4 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg">
                  <img 
                    src={activeArtifact.imageUrl} 
                    alt="Odia Visual Infographic" 
                    className="max-w-full rounded-2xl shadow-xl"
                  />
                </div>
              )}

              {activeArtifact.type === 'summary' && (
                <div className="prose prose-indigo dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeArtifact.content}
                  </ReactMarkdown>
                </div>
              )}

              {activeArtifact.type === 'slides' && activeArtifact.slides && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeArtifact.slides.map((slide, idx) => (
                    <div key={idx} className="slide-container bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Slide {idx + 1}</span>
                        <h3 className="text-lg font-bold dark:text-white">{slide.title}</h3>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                        {slide.content.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeArtifact.type === 'infographic' && activeArtifact.infographic && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeArtifact.infographic.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2">{item.title}</p>
                      <p className="text-3xl font-bold dark:text-white mb-2">{item.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeArtifact.type === 'podcast' && activeArtifact.podcastScript && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center p-10 bg-indigo-600 rounded-3xl text-white shadow-xl">
                    <PodcastIcon className="h-16 w-16 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Odia Audio Overview</h3>
                    <p className="text-sm opacity-80 mb-6">A deep dive discussion in your language</p>
                    {isAudioLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse h-2 w-2 rounded-full bg-white"></div>
                        <div className="animate-pulse h-2 w-2 rounded-full bg-white delay-75"></div>
                        <div className="animate-pulse h-2 w-2 rounded-full bg-white delay-150"></div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => playPodcast(activeArtifact.podcastScript!)} 
                        className="bg-white text-indigo-600 px-6 py-3 rounded-full font-bold hover:bg-gray-100 flex items-center gap-2"
                      >
                        <SpeakerIcon /> Listen Now
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-bold dark:text-white">Podcast Script</h4>
                    {activeArtifact.podcastScript.map((turn, idx) => (
                      <div key={idx} className={`p-4 rounded-xl ${turn.speaker === 'Speaker 1' ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <p className="text-[10px] font-bold text-indigo-600 mb-1">{turn.speaker}</p>
                        <p className="text-sm dark:text-gray-200">{turn.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OdiaNotebook;