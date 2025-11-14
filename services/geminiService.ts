// Fix: Add imports for GenerateContentResponse, Modality, and GroundingChunk.
import { GoogleGenAI, GenerateContentResponse, Modality } from '@google/genai';
import { type ChatMessage, type GroundingChunk } from '../types';

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
Be helpful, friendly, and deeply knowledgeable. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness. Provide comprehensive and detailed responses to fulfill user requests thoroughly. Do not artificially shorten your answers. Always end your responses by offering to clarify or expand on the topic.`;

const fastModeInstruction = `You are Satyashree. Respond concisely and directly in Odia, in 1-3 sentences. End by asking if the user needs more details.`;


const handleGeminiError = (error: unknown, context: string, details?: { file?: any }): string => {
  console.error(`Error in ${context}:`, error);

  const tryAgain = 'ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।';
  let userMessage = `କ୍ଷମା କରନ୍ତୁ, ଏକ ଅଜ୍ଞାତ ତ୍ରୁଟି ଘଟିଛି।`;

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('api key not valid')) {
      userMessage = 'ଆପଣଙ୍କ API କି ବୈଧ ନୁହଁ। ଦୟାକରି ଆପଣଙ୍କର ସେଟିଂସ୍ ଯାଞ୍ଚ କରନ୍ତୁ।';
      return userMessage; // Don't add 'try again' for this
    }
    if (error.message.includes('quota')) {
      userMessage = 'ଆପଣ ଆପଣଙ୍କର API କୋଟା ଅତିକ୍ରମ କରିଛନ୍ତି।';
      return userMessage;
    }
    if (error.message.includes('429')) { // Too Many Requests
      userMessage = 'ବହୁତ ଅଧିକ ଅନୁରୋଧ।';
    } else if (error.message.toLowerCase().includes('deadline exceeded')) {
        userMessage = 'ସଂଯୋଗ ସମୟ ସମାପ୍ତ ହୋଇଗଲା।';
    } else {
        userMessage = details?.file
                ? 'କ୍ଷମା କରନ୍ତୁ, ଆପଣଙ୍କ ଫାଇଲ୍ ପ୍ରକ୍ରିୟାକରଣ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।'
                : 'କ୍ଷମା କରନ୍ତୁ, ଚାଟ୍ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
    }
  }

  return `${userMessage} ${tryAgain}`;
};


export const runChat = async (
  history: ChatMessage[],
  prompt: string,
  onChunk: (payload: { chunk: string; mode?: 'fast' | 'expert' }) => void,
  file?: { data: string; mimeType: string }
): Promise<void> => {
  try {
    let mode: 'fast' | 'expert' = 'expert';

    // If there's a file, it's an expert task. Skip classification.
    if (!file && prompt) {
      const classifierPrompt = `Classify the following user query as 'fast' or 'expert'. 
'Fast' queries are simple facts, greetings, or short questions. 
'Expert' queries are complex, require reasoning, creativity, or detailed explanation. 
Respond with only the word 'fast' or 'expert'. 
Query: "${prompt}"`;

      const classificationResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: classifierPrompt,
      });
      const classification = classificationResponse.text.trim().toLowerCase();
      if (classification === 'fast') {
        mode = 'fast';
      }
    }

    const contents = history
      .filter(msg => msg.text || msg.file)
      .map(msg => {
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

    const modelName = mode === 'fast' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    const systemInstruction = mode === 'fast' ? fastModeInstruction : satyashreeSystemInstruction;

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    let isFirstChunk = true;

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        if (isFirstChunk) {
          onChunk({ chunk: chunkText, mode: mode });
          isFirstChunk = false;
        } else {
          onChunk({ chunk: chunkText });
        }
      }
    }
  } catch (error) {
    const errorMessage = handleGeminiError(error, 'runChat', { file });
    onChunk({ chunk: errorMessage });
  }
};

// Fix: Implement and export runSearch function.
export const runSearch = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  location?: { latitude: number; longitude: number }
): Promise<{ text: string; groundingChunks: GroundingChunk[] }> => {
  try {
    const tools: any[] = [{ googleSearch: {} }];
    const toolConfig: any = {};

    if (location) {
      tools.push({ googleMaps: {} });
      toolConfig.retrievalConfig = {
        latLng: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      };
    }

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: satyashreeSystemInstruction,
        tools: tools,
        toolConfig: Object.keys(toolConfig).length > 0 ? toolConfig : undefined,
      },
    });

    let fullText = '';
    let finalResponse: GenerateContentResponse | null = null;

    for await (const chunk of responseStream) {
      finalResponse = chunk;
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }

    const groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text: fullText, groundingChunks: groundingChunks as GroundingChunk[] };

  } catch (error) {
    const errorMessage = handleGeminiError(error, 'runSearch');
    onChunk(errorMessage);
    return { text: errorMessage, groundingChunks: [] };
  }
};

interface Turn {
  role: 'user' | 'model';
  text: string;
}

// Fix: Implement and export runComplexQuery function.
export const runComplexQuery = async (
  history: Turn[],
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
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: satyashreeSystemInstruction,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }
    return fullText;
  } catch (error) {
    const errorMessage = handleGeminiError(error, 'runComplexQuery');
    onChunk(errorMessage);
    return errorMessage;
  }
};

// Fix: Implement and export analyzeVideoUrl function.
export const analyzeVideoUrl = async (
  history: Turn[],
  videoUrl: string,
  onChunk: (chunk: string) => void
): Promise<string> => {
  try {
    const prompt = `Please analyze the content of the video at this URL and provide a detailed summary in Odia: ${videoUrl}`;

    const contents = history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-pro',
      // @ts-ignore
      contents: contents,
      config: {
        systemInstruction: satyashreeSystemInstruction,
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(chunkText);
      }
    }
    return fullText;
  } catch (error) {
    const errorMessage = handleGeminiError(error, 'analyzeVideoUrl');
    onChunk(errorMessage);
    return errorMessage;
  }
};

interface ImagePayload {
    data: string;
    mimeType: string;
}

// Fix: Implement and export generateImage function.
export const generateImage = async (
  prompt: string,
  images: ImagePayload[]
): Promise<string> => {
  try {
    const textPart = { text: prompt };
    const imageParts = images.map(img => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType,
      },
    }));

    const parts = [...imageParts, textPart];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error('No image was generated. The model did not return an image.');
  } catch (error) {
    throw new Error(handleGeminiError(error, 'generateImage'));
  }
};

export const generateTitleForChat = async (prompt: string): Promise<string> => {
  try {
    const titlePrompt = `Please create a very short, concise title in the Odia language (3-5 words maximum) for a conversation that starts with this user prompt: "${prompt}". Respond with only the title text and nothing else.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: titlePrompt,
    });
    
    const title = response.text.trim().replace(/"/g, '');
    return title || 'ନୂଆ ବାର୍ତ୍ତାଳାପ';
  } catch (error) {
    console.error('Error generating title:', error);
    return 'ନୂଆ ବାର୍ତ୍ତାଳାପ'; 
  }
};