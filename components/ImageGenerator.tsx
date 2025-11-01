
import React from 'react';
import { useState, useRef } from 'react';
import { generateImage } from '../services/geminiService';
import { CameraIcon, PlusIcon, CloseIcon, SaveIcon } from './icons';

interface UploadedImage {
  file: File;
  base64: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const suggestionPrompts = [
    'ଏକ କଫି ଦୋକାନ ପାଇଁ ଏକ ଆଧୁନିକ ଲୋଗୋ',
    'ଏକ ସ୍କୁଲ୍ କାର୍ଯ୍ୟକ୍ରମ ପାଇଁ ଏକ ରଙ୍ଗୀନ ଫ୍ଲାୟାର୍',
    'ଗେମିଂ ୟୁଟ୍ୟୁବ୍ ଚ୍ୟାନେଲ୍ ପାଇଁ ବ୍ୟାନର୍',
    'ଜନ୍ମଦିନ ପାର୍ଟି ପାଇଁ ଏକ ଆମନ୍ତ୍ରଣ କାର୍ଡ ଡିଜାଇନ୍',
];

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      try {
        const newImagesPromises = Array.from(files).map(async (file: File) => {
            if (!file.type.startsWith('image/')) return null;
            const base64 = await fileToBase64(file);
            return { file, base64 };
        });
        
        const newImages = (await Promise.all(newImagesPromises)).filter(Boolean) as UploadedImage[];
        setUploadedImages(prev => [...prev, ...newImages]);
      } catch (err) {
        console.error("Error reading files:", err);
        setError("ଫାଇଲ୍ ପଢିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।");
      } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setGeneratedImageUrl(null);
    setError(null);

    try {
      const imagePayload = uploadedImages.map(img => ({
          data: img.base64,
          mimeType: img.file.type,
      }));

      const base64Image = await generateImage(prompt, imagePayload);
      setGeneratedImageUrl(`data:image/png;base64,${base64Image}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `satyashree-generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseAsBase = async () => {
    if (!generatedImageUrl) return;
    const response = await fetch(generatedImageUrl);
    const blob = await response.blob();
    const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
    const base64 = await fileToBase64(file);
    setUploadedImages([{ file, base64 }]);
    setGeneratedImageUrl(null);
    setPrompt('');
  };

  const handleStartNew = () => {
    setGeneratedImageUrl(null);
    setUploadedImages([]);
    setPrompt('');
    setError(null);
  };

  return (
    <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto flex justify-center items-center">
        {isLoading ? (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-500 mx-auto"></div>
            <p className="mt-4 text-slate-300">ଚିତ୍ର ସୃଷ୍ଟି କରୁଛି...</p>
          </div>
        ) : error ? (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
                <p><strong>ତ୍ରୁଟି</strong></p>
                <p>{error}</p>
            </div>
        ) : generatedImageUrl ? (
          <div className="text-center flex flex-col items-center gap-4">
            <img src={generatedImageUrl} alt="Generated image" className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg" />
            <div className="flex flex-wrap justify-center gap-3 mt-2">
                <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 bg-green-500 text-white font-bold py-2 px-4 rounded-full hover:bg-green-600 transition-colors shadow-md text-sm"
                  >
                    <SaveIcon />
                    <span>ଡାଉନଲୋଡ୍</span>
                </button>
                 <button
                    onClick={handleUseAsBase}
                    className="inline-flex items-center gap-2 bg-slate-600 text-white font-bold py-2 px-4 rounded-full hover:bg-slate-500 transition-colors shadow-md text-sm"
                  >
                    <span>ଏହାକୁ ସମ୍ପାଦନ କରନ୍ତୁ</span>
                </button>
                 <button
                    onClick={handleStartNew}
                    className="inline-flex items-center gap-2 bg-cyan-500 text-white font-bold py-2 px-4 rounded-full hover:bg-cyan-600 transition-colors shadow-md text-sm"
                  >
                    <span>ନୂଆ ଆରମ୍ଭ କରନ୍ତୁ</span>
                </button>
            </div>
          </div>
        ) : (
           <div className="text-center text-slate-400 max-w-lg">
                <CameraIcon />
                <h2 className="text-2xl mt-2 font-bold text-cyan-400">ଚିତ୍ର ସୃଷ୍ଟି</h2>
                <p className="mt-2">ଲୋଗୋ, ଫ୍ଲାୟାର୍, ବ୍ୟାନର୍, ଏବଂ ଆହୁରି ଅନେକ କିଛି ସୃଷ୍ଟି କରନ୍ତୁ। କେବଳ ଓଡ଼ିଆରେ ଆପଣଙ୍କ ଆବଶ୍ୟକତା ବର୍ଣ୍ଣନା କରନ୍ତୁ।</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {suggestionPrompts.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="bg-slate-700/50 text-slate-300 text-sm px-3 py-1.5 rounded-full hover:bg-slate-700 hover:text-cyan-400 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>
      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 backdrop-blur-sm">
        {uploadedImages.length > 0 && (
             <div className="flex items-center gap-2 overflow-x-auto mb-3 p-2 bg-slate-900/50 rounded-lg">
                {uploadedImages.map((image, index) => (
                    <div key={`${image.file.name}-${index}`} className="relative flex-shrink-0 group">
                        <img 
                            src={`data:${image.file.type};base64,${image.base64}`} 
                            alt={image.file.name}
                            className="h-20 w-20 object-cover rounded-md" 
                        />
                        <button 
                            onClick={() => removeImage(index)} 
                            className="absolute -top-1 -right-1 bg-slate-700 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove image"
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="flex items-start gap-2">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={uploadedImages.length > 0 ? "ଚିତ୍ରଗୁଡ଼ିକୁ କିପରି ପରିବର୍ତ୍ତନ କରିବେ ବର୍ଣ୍ଣନା କରନ୍ତୁ..." : "ଏକ ଲୋଗୋ, ଫ୍ଲାୟାର୍, କିମ୍ବା ଆପଣଙ୍କ କଳ୍ପନାର ଯେକୌଣସି ଡିଜାଇନ୍ ବର୍ଣ୍ଣନା କରନ୍ତୁ..."}
                className="w-full bg-slate-800 text-white rounded-lg p-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400"
                disabled={isLoading}
            />
            <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept="image/*"
            />
            <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 hover:text-cyan-400 transition-colors"
                disabled={isLoading}
                aria-label="Add image"
            >
                <PlusIcon />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full mt-2 bg-cyan-500 text-white p-3 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <CameraIcon />
            <span>{uploadedImages.length > 0 ? 'ଚିତ୍ର ସମ୍ପାଦନ କରନ୍ତୁ' : 'ଚିତ୍ର ସୃଷ୍ଟି କରନ୍ତୁ'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImageGenerator;