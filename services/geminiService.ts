import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { type ChatMessage } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const satyashreeSystemInstruction = `You are Satyashree, your full name is Satyashree Krushna Chandra Sahoo. You are a highly intelligent and empathetic chatbot. Your primary language is Odia (ଓଡ଼ିଆ). 
You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing, unless the user explicitly asks for a translation.
You must understand, read, and write Odia with the fluency and nuance of a human native speaker from Odisha.
Default to standard Odia, but understand regional dialects like Sambalpuri or Kosli if the context suggests it.
When a file is uploaded, analyze its content thoroughly. If it contains Odia text or cultural elements, prioritize them in your analysis and response.
Be helpful, friendly, and deeply knowledgeable. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness. Provide comprehensive and detailed responses to fulfill user requests thoroughly. Do not artificially shorten your answers.`;

export const runChat = async (
  history: ChatMessage[],
  prompt: string,
  onChunk: (chunk: string) => void,
  file?: { data: string; mimeType: string }
): Promise<string> => {
  try {
    const contents = history
      .filter(msg => msg.text || msg.file) // Exclude empty placeholders or initial greetings without text
      .map(msg => {
          // NOTE: file data from history isn't available as it's not stored, only text is used.
          const parts = [{ text: msg.text }];
          return {
              role: msg.sender === 'user' ? 'user' : 'model',
              parts: parts
          };
      });

    const userParts: any[] = [{ text: prompt }];
    if (file) {
      userParts.unshift({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType,
        },
      });
    }
    contents.push({ role: 'user', parts: userParts });


    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: satyashreeSystemInstruction,
      },
    });

    let fullResponse = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    }
    return fullResponse;

  } catch (error) {
    console.error('Error in runChat:', error);
    const tryAgain = 'ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।';
    let errorMessage = `କ୍ଷମା କରନ୍ତୁ, ଏକ ତ୍ରୁଟି ଘଟିଛି। ${tryAgain}`;
    if (file) {
      errorMessage = `କ୍ଷମା କରନ୍ତୁ, ଆପଣଙ୍କ ଫାଇଲ୍ ପ୍ରକ୍ରିୟାକରଣ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି। ${tryAgain}`;
    }
    onChunk(errorMessage);
    return errorMessage;
  }
};

export const runSearch = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  latLng?: { latitude: number; longitude: number }
): Promise<{ text: string, groundingChunks: any[] }> => {
  try {
    const config: any = {
      systemInstruction: satyashreeSystemInstruction,
      tools: [{ googleSearch: {} }, { googleMaps: {} }],
    };

    if (latLng) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: latLng,
        },
      };
    }

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: config,
    });

    let fullText = '';
    let groundingChunks: any[] = [];

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
      const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (newChunks) {
          groundingChunks = newChunks;
      }
    }

    return { text: fullText, groundingChunks };
  } catch (error) {
    console.error('Error in runSearch:', error);
    const errorMessage = 'କ୍ଷମା କରନ୍ତୁ, ସନ୍ଧାନ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
    onChunk(errorMessage);
    return { text: errorMessage, groundingChunks: [] };
  }
};

export const runComplexQuery = async (
  history: { role: 'user' | 'model'; text: string }[],
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> => {
  try {
     const contents = history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      contents: contents,
      config: {
        systemInstruction: satyashreeSystemInstruction,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let fullResponse = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    }
    return fullResponse;
  } catch (error) {
    console.error('Error in runComplexQuery:', error);
    const errorMessage = 'କ୍ଷମା କରନ୍ତୁ, ଏକ ଜଟିଳ ତ୍ରୁଟି ଘଟିଛି।';
    onChunk(errorMessage);
    return errorMessage;
  }
};

export const analyzeVideoUrl = async (
  history: { role: 'user' | 'model'; text: string }[],
  url: string,
  onChunk: (chunk: string) => void
): Promise<string> => {
  try {
    const prompt = `Please provide a detailed summary in the Odia language for the video at the following URL. Analyze its content, focusing on the main topics, key points, and overall conclusion. URL: ${url}`;
    
    const contents = history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      contents: contents,
      config: {
        systemInstruction: satyashreeSystemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    let fullResponse = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    }
    return fullResponse;
  } catch (error) {
    console.error('Error in analyzeVideoUrl:', error);
    const errorMessage = 'କ୍ଷମା କରନ୍ତୁ, ଭିଡିଓ ବିଶ୍ଳେଷଣ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
    onChunk(errorMessage);
    return errorMessage;
  }
};


export const generateImage = async (
    prompt: string,
    images?: { data: string; mimeType: string }[]
): Promise<string> => {
  try {
    const isEditing = images && images.length > 0;

    if (isEditing) {
        const requestParts: any[] = [];
        images.forEach(image => {
            requestParts.push({
                inlineData: {
                    data: image.data,
                    mimeType: image.mimeType,
                },
            });
        });
        requestParts.push({ text: prompt });

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: requestParts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts.find(p => !!p.inlineData);
        if (imagePart && imagePart.inlineData) {
            return imagePart.inlineData.data;
        }
        throw new Error('No image data received during editing');

    } else {
        const finalPrompt = `Create a professional and high-quality graphic design based on the following description. This could be a logo, flyer, banner, or another visual concept. Focus on clarity, aesthetics, and relevance to the prompt. Description: "${prompt}"`;
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            return response.generatedImages[0].image.imageBytes;
        }
        throw new Error('No image data received during generation');
    }
  } catch (error) {
    console.error('Error in generateImage/editImage:', error);
    throw new Error('କ୍ଷମା କରନ୍ତୁ, ଚିତ୍ର ସୃଷ୍ଟି / ସମ୍ପାଦନ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।');
  }
};