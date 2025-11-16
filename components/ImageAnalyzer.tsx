import React, { useState, useCallback } from 'react';
import { analyzeImageForText } from '../services/geminiService';
import { UploadIcon, CopyIcon, CheckIcon, CloseIcon } from './icons';
import { useDropzone } from 'react-dropzone';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

const parseAndRenderResult = (resultText: string) => {
    const sections: { [key: string]: string } = {};
    let currentKey = '';
    const lines = resultText.split('\n');

    lines.forEach(line => {
        const match = line.match(/^\*\*(.*?)\*\*:(.*)$/);
        if (match) {
            currentKey = match[1].trim();
            sections[currentKey] = match[2].trim();
        } else if (currentKey && line.trim()) {
            sections[currentKey] += '\n' + line;
        }
    });

    const getTextToCopy = () => sections['Extracted Text'] || resultText;

    return (
        <div className="space-y-4 text-left">
            {Object.entries(sections).map(([key, value]) => (
                <div key={key}>
                    <h3 className="font-bold text-cyan-400 mb-1">{key}:</h3>
                    {key === 'Extracted Text' ? (
                        <pre className="whitespace-pre-wrap bg-slate-900/50 p-3 rounded-md text-sm leading-relaxed border border-slate-700">{value}</pre>
                    ) : (
                        <p className="text-slate-300">{value}</p>
                    )}
                </div>
            ))}
            {Object.keys(sections).length === 0 && (
                 <pre className="whitespace-pre-wrap bg-slate-900/50 p-3 rounded-md text-sm leading-relaxed border border-slate-700">{resultText}</pre>
            )}
        </div>
    );
};


const ImageAnalyzer: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setResultText(null);
        } else {
            setError('ଦୟାକରି ଏକ ବୈଧ ଚିତ୍ର ଫାଇଲ୍ ଅପଲୋଡ୍ କରନ୍ତୁ।');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: false,
    });

    const handleAnalyze = async () => {
        if (!imageFile || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResultText(null);
        setCopied(false);

        try {
            const base64Data = await fileToBase64(imageFile);
            const response = await analyzeImageForText(base64Data, imageFile.type);
            setResultText(response);
        } catch (err: any) {
            setError(err.message || 'ଚିତ୍ର ବିଶ୍ଳେଷଣ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = () => {
        if (!resultText) return;

        let textToCopy = resultText;
        // Regex to specifically extract content from the "Extracted Text" markdown code block
        const match = resultText.match(/\*\*Extracted Text\*\*:\s*\`\`\`\n?(.*?)\n?\`\`\`/s);
        if (match && match[1]) {
            textToCopy = match[1].trim();
        } else {
            // Fallback for just the text content if the full structure isn't matched
            const fallbackMatch = resultText.match(/\*\*Extracted Text\*\*:(.*)/s);
            if(fallbackMatch && fallbackMatch[1]) {
                textToCopy = fallbackMatch[1].replace(/\*\*Notes\*\*:.*/s, '').replace(/`/g, '').trim();
            }
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const clearState = () => {
        setImageFile(null);
        setImagePreview(null);
        setResultText(null);
        setError(null);
        setIsLoading(false);
        setCopied(false);
    };

    return (
        <div className="flex flex-col h-full flex-grow bg-slate-900/50 rounded-xl shadow-2xl border border-slate-700/50">
            <div className="p-3 border-b border-slate-700/50">
                 <h2 className="font-bold text-lg text-slate-200">ଟେକ୍ସଟ୍ ଏକ୍ସଟ୍ରାକ୍ଟର୍ (Text Extractor)</h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
                {!imagePreview && !isLoading && (
                    <div {...getRootProps()} className={`flex flex-col justify-center items-center h-full text-center text-slate-400 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-cyan-400 bg-slate-800/50' : 'border-slate-600 hover:border-cyan-500'}`}>
                        <input {...getInputProps()} />
                        <UploadIcon className="text-slate-500 mb-4" />
                        <p className="font-semibold text-slate-300">ଏକ ଚିତ୍ର ଡ୍ରାଗ୍ କରନ୍ତୁ କିମ୍ବା ଅପଲୋଡ୍ କରିବାକୁ କ୍ଲିକ୍ କରନ୍ତୁ</p>
                        <p className="text-sm mt-1">ସମର୍ଥିତ ଭାଷା: ଓଡ଼ିଆ, ହିନ୍ଦୀ, ଇଂରାଜୀ</p>
                    </div>
                )}
                {imagePreview && (
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/2 flex-shrink-0">
                             <div className="relative group">
                                <img src={imagePreview} alt="Uploaded preview" className="rounded-lg w-full max-h-[40vh] md:max-h-[60vh] object-contain bg-slate-900/50" />
                                 <button onClick={clearState} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <CloseIcon />
                                 </button>
                             </div>
                             <button onClick={handleAnalyze} disabled={isLoading || !!resultText} className="mt-4 w-full bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">
                                {isLoading ? 'ବିଶ୍ଳେଷଣ କରୁଛି...' : resultText ? 'ବିଶ୍ଳେଷଣ ସମାପ୍ତ' : 'ଟେକ୍ସଟ୍ ଏକ୍ସଟ୍ରାକ୍ଟ କରନ୍ତୁ'}
                            </button>
                        </div>
                        <div className="md:w-1/2">
                            {isLoading && (
                                <div className="flex flex-col justify-center items-center h-full text-center text-slate-300">
                                    <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-cyan-400"></div>
                                    <p className="mt-4">ଚିତ୍ର ବିଶ୍ଳେଷଣ କରୁଛି...</p>
                                    <p className="text-sm text-slate-400">ଏଥିରେ କିଛି ସମୟ ଲାଗିପାରେ।</p>
                                </div>
                            )}
                            {resultText && (
                                 <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 relative">
                                    <h3 className="text-lg font-bold text-slate-100 mb-3">ବିଶ୍ଳେଷଣ ଫଳାଫଳ</h3>
                                    {parseAndRenderResult(resultText)}
                                    <button onClick={handleCopy} className="absolute top-3 right-3 flex items-center gap-1.5 text-sm bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-600 hover:text-white">
                                        {copied ? <CheckIcon className="text-green-400"/> : <CopyIcon />}
                                        {copied ? 'କପି ହେଲା!' : 'ଟେକ୍ସଟ୍ କପି କରନ୍ତୁ'}
                                    </button>
                                </div>
                            )}
                            {error && (
                                <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalyzer;