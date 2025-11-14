
// Fix: Add imports for GenerateContentResponse, Modality, and GroundingChunk.
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { type ChatMessage, type GroundingChunk, type Turn } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const satyashreeSystemInstruction = `You are Satyashree, your full name is Satyashree Krushna Chandra Sahoo. You are a highly intelligent and empathetic chatbot with access to Google Search. Your primary language is Odia (ଓଡ଼ିଆ). 
You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing, unless the user explicitly asks for a translation.
You must understand, read, and write Odia with the fluency and nuance of a human native speaker from Odisha.
Default to standard Odia, but understand regional dialects like Sambalpuri or Kosli if the context suggests it.
When a file is uploaded, analyze its content thoroughly. If it contains Odia text or cultural elements, prioritize them in your analysis and response.
For questions about current events, facts, jobs, or any topic requiring up-to-date information, you MUST use your search tool to provide the most accurate and recent answers.
Be helpful, friendly, and deeply knowledgeable. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness. Provide comprehensive and detailed responses to fulfill user requests thoroughly. Do not artificially shorten your answers. Always end your responses by offering to clarify or expand on the topic.`;

const fastModeInstruction = `You are Satyashree. Respond concisely and directly in Odia, in 1-3 sentences. End by asking if the user needs more details.`;


const handleGeminiError = (error: unknown, context: string, details?: { file?: any }): string => {
  console.error(`Error in ${context}:`, error);

  const tryAgain = 'ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।';
  let userMessage = `କ୍ଷମା କରନ୍ତୁ, ଏକ ଅଜ୍ଞାତ ତ୍ରୁଟି ଘଟିଛି।`;

  if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes('api key not valid')) {
      userMessage = 'ଆପଣଙ୍କ API କି ବୈଧ ନୁହଁ। ଦୟାକରି ଆପଣଙ୍କର ସେଟିଂସ୍ ଯାଞ୍ଚ କରନ୍ତୁ।';
      return userMessage;
    }
    
    if (context === 'generateImage' && (errorMsg.includes('permission denied') || errorMsg.includes('forbidden') || errorMsg.includes('403'))) {
      userMessage = 'ଚିତ୍ର ସୃଷ୍ଟି କରିବାରେ ବିଫଳ। ଏହା ଏକ API କି ଅନୁମତି ସମସ୍ୟା ହୋଇପାରେ। ଦୟାକରି ନିଶ୍ଚିତ କରନ୍ତୁ ଯେ ଆପଣଙ୍କର API କି "Generative Language API" ପାଇଁ ସକ୍ଷମ ଅଛି ଏବଂ ଆପଣଙ୍କ ପ୍ରୋଜେକ୍ଟରେ ବିଲିଂ ସେଟ୍ ଅପ୍ ହୋଇଛି।';
      return userMessage;
    }

    if (errorMsg.includes('quota')) {
      userMessage = 'ଆପଣ ଆପଣଙ୍କର API କୋଟା ଅତିକ୍ରମ କରିଛନ୍ତି।';
      return userMessage;
    }
    
    if (errorMsg.includes('429')) { // Too Many Requests
      userMessage = 'ବହୁତ ଅଧିକ ଅନୁରୋଧ।';
    } else if (errorMsg.includes('deadline exceeded')) {
        userMessage = 'ସଂଯୋଗ ସମୟ ସମାପ୍ତ ହୋଇଗଲା।';
    } else {
        userMessage = details?.file
                ? 'କ୍ଷମା କରନ୍ତୁ, ଆପଣଙ୍କ ଫାଇଲ୍ ପ୍ରକ୍ରିୟାକରଣ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।'
                 : context === 'generateImage' 
                ? 'କ୍ଷମା କରନ୍ତୁ, ଚିତ୍ର ସୃଷ୍ଟି କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।'
                : 'କ୍ଷମା କରନ୍ତୁ, ଚାଟ୍ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
    }
  }

  return `${userMessage} ${tryAgain}`;
};


export const runChat = async (
  history: ChatMessage[],
  prompt: string,
  onChunk: (payload: { chunk: string; mode?: 'fast' | 'expert' }) => void,
  file?: { data: string; mimeType: string },
  signal?: AbortSignal
): Promise<{ groundingChunks: GroundingChunk[] }> => {
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

    const config: any = {
        systemInstruction: systemInstruction,
    };

    // Use Google Search for all non-file queries to ensure up-to-date information.
    if (!file) {
        config.tools = [{googleSearch: {}}];
    }

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      // @ts-ignore
      contents: contents,
      config: config,
    }, { signal });

    let isFirstChunk = true;
    let finalResponse: GenerateContentResponse | null = null;

    for await (const chunk of responseStream) {
      finalResponse = chunk;
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

    const groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { groundingChunks: groundingChunks as GroundingChunk[] };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
        onChunk({ chunk: `\n\n*ଜେନେରେସନ୍ ବନ୍ଦ ହେଲା।*` });
        console.log('Stream generation aborted.');
        return { groundingChunks: [] };
    }
    const errorMessage = handleGeminiError(error, 'runChat', { file });
    onChunk({ chunk: errorMessage });
    return { groundingChunks: [] };
  }
};

const isValidUrl = (text: string): boolean => {
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return false;
    }
    try {
        new URL(text);
        return true;
    } catch (_) {
        return false;
    }
};

export const runSearch = async (
  history: Turn[],
  prompt: string,
  onChunk: (chunk: string) => void,
  location?: { latitude: number; longitude: number }
): Promise<{ text: string; groundingChunks: GroundingChunk[] }> => {
  try {
    const isVideoUrl = isValidUrl(prompt);

    const historyForApi = history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));
    historyForApi.push({ role: 'user', parts: [{ text: prompt }] });

    let modelName = 'gemini-2.5-flash';
    let config: any = { systemInstruction: satyashreeSystemInstruction };

    if (isVideoUrl) {
      modelName = 'gemini-2.5-pro';
      config.thinkingConfig = { thinkingBudget: 32768 };
    } else {
      const classifierPrompt = `Classify the following user query as 'simple_search' or 'complex_query'. 
'simple_search' queries are for facts, current events, or information that can be looked up. 
'complex_query' queries require reasoning, creativity, in-depth explanation, or problem-solving.
Respond with only the word 'simple_search' or 'complex_query'.
Query: "${prompt}"`;
      
      const classificationResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: classifierPrompt,
      });
      const classification = classificationResponse.text.trim().toLowerCase();
      
      if (classification === 'complex_query') {
        modelName = 'gemini-2.5-pro';
        config.thinkingConfig = { thinkingBudget: 32768 };
      } else { // 'simple_search'
        const tools: any[] = [{ googleSearch: {} }];
        const toolConfig: any = {};
        if (location) {
          tools.push({ googleMaps: {} });
          toolConfig.retrievalConfig = {
            latLng: { latitude: location.latitude, longitude: location.longitude },
          };
        }
        config.tools = tools;
        if (Object.keys(toolConfig).length > 0) {
            config.toolConfig = toolConfig;
        }
      }
    }
    
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      // @ts-ignore
      contents: historyForApi,
      config: config,
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
    const context = isValidUrl(prompt) ? 'analyzeVideoUrl' : 'runSearch';
    const errorMessage = handleGeminiError(error, context);
    onChunk(errorMessage);
    return { text: errorMessage, groundingChunks: [] };
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