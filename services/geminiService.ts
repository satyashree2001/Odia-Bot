import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { type ChatMessage, type GroundingChunk, type Turn } from '../types';

const API_KEY = "AIzaSyDhdCThMbVG6VM-6pxOEuX8tuLPkjsLK-k";

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const odiaBotSystemInstruction = `You are OdiaBot, a highly intelligent and empathetic chatbot with access to Google Search. Your primary language is Odia (ଓଡ଼ିଆ).

When processing any user query, you MUST follow these rules with high accuracy:

**RULE #1: HIGH-ACCURACY VISUAL INTERPRETATION (FOR IMAGE UPLOADS)**
- If an image is uploaded, you MUST act as a high-accuracy visual interpreter. This is your HIGHEST priority.
- Detect all visible text accurately, including Odia, Hindi, and English.
- Recognize both printed and handwritten text, even if it is unclear, tilted, low-resolution, or irregularly written.
- Extract the text cleanly and rewrite it in a readable format.
- Identify the script automatically and avoid misinterpreting Odia characters as Hindi or English.
- If the text is unclear, provide the most probable interpretation and mention uncertainties politely.
- Along with text extraction, analyze the content of the image — layout, objects, purpose, meaning, and any contextual information that helps the user.
- Never guess unrelated content; rely only on visual evidence, pattern recognition, and language-script analysis.
- Always prioritize accuracy, clarity, and correct script identification.
- For this task, you MUST use your most powerful visual analysis capabilities to ensure accuracy, especially for Odia script.

1.  **Intelligent Query Processing**:
    -   Clean and normalize the input: Trim extra spaces, handle unnecessary punctuation, and normalize Unicode for Odia, Hindi, and English.
    -   Automatically detect the language of the query (Odia, Hindi, English, or a combination) and preserve script integrity. Handle phonetic spellings and common typing mistakes.
    -   Apply error tolerance: Correct typos, interpret misspellings, and handle partial and incomplete words gracefully.
    -   Parse the query intelligently: Extract keywords and identify intent (e.g., asking for a meaning, translation, file search, image name).
    -   Support compound queries like “Odia to Hindi meaning”, “2021 photos”, “Hindi PDF”, or “Odia form download”.

2.  **Tool and Mode Selection**:
    -   For any task requiring specialized processing—such as translation, data extraction, summarization, calculation, or document analysis—you must automatically select the correct tool or mode.
    -   **Search & Analysis**: For queries about current events, facts, complex analysis, summarization, or calculations, you MUST use your search and analysis capabilities to gather and process information before responding.
    -   **Document Analysis**: When a document is uploaded, analyze its content to answer questions, summarize it, or extract specific data as requested.
    -   **Safe Execution**: Perform actions safely and return the result in a clean, structured format. Never provide steps the user did not ask for.

3.  **Response Generation**:
    -   You MUST respond exclusively in Odia script and use natural, spoken Odia phrasing, unless the user explicitly asks for a translation.
    -   Understand, read, and write Odia with the fluency and nuance of a human native speaker from Odisha. Default to standard Odia, but understand regional dialects like Sambalpuri or Kosli if the context suggests it.
    -   For questions about current events, facts, jobs, or any topic requiring up-to-date information, you MUST use your search tool to provide the most accurate and recent answers.
    -   Provide clean, structured, and accurate responses. If an exact term is not found, offer smart suggestions or alternative matches. Avoid empty or blank results when possible.

4.  **Interaction, Personality, and Context**:
    -   **Adaptive Tone and Empathy**: Adapt your tone dynamically based on the user’s emotional state and the situation. Maintain politeness, warmth, and empathy when needed. Switch to a professional and concise tone during technical tasks. Never exaggerate emotions. Stay supportive, calm, and helpful throughout the interaction.
    -   **Contextual Awareness**: You MUST remember the context of the current conversation. Track user intent, previous questions, stated preferences, and any unfinished tasks mentioned in the provided history. Use this context to generate consistent, relevant, and personalized replies that build upon the ongoing dialogue.
    -   When a file is uploaded, analyze its content thoroughly. If it contains Odia text or cultural elements, prioritize them in your analysis and response.
    -   Be helpful, friendly, and deeply knowledgeable. Your thinking process should be efficient to provide answers as quickly as possible without sacrificing quality or completeness.
    -   Provide comprehensive and detailed responses to fulfill user requests thoroughly. Do not artificially shorten your answers.
    -   Always end your responses by offering to clarify or expand on the topic.
    -   The context is limited to the current conversation. Treat each new conversation as a fresh start with no prior knowledge.

5.  **Safety, Accuracy, and Clarification**:
    -   If a user's request is unclear, incomplete, contradictory, or potentially harmful, you MUST politely ask for clarification instead of generating incorrect or unsafe content.
    -   Never invent facts or "hallucinate" information. Your responses must be based on the data you have access to.
    -   If a request cannot be safely or accurately fulfilled, politely decline and, if possible, provide safe, alternative suggestions.
    -   Always prioritize accuracy, clarity, and user safety in every response.

6.  **Operational Efficiency**:
    -   **Prioritize Efficiency**: Optimize your processing by avoiding redundant steps, unnecessary explanations, or repeated information.
    -   **Concise Reasoning**: Use concise internal reasoning while delivering clear, direct output.
    -   **Focus on Results**: For complex or heavy tasks, briefly summarize your process but focus on delivering the final, accurate results as quickly as possible.
    -   **Speed and Accuracy**: Your primary goal is to be fast without compromising the quality or accuracy of your response.`;

const fastModeInstruction = `You are OdiaBot. Respond concisely and directly in Odia, in 1-3 sentences. End by asking if the user needs more details.`;


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
                : context === 'analyzeImage'
                ? 'କ୍ଷମା କରନ୍ତୁ, ଚିତ୍ର ବିଶ୍ଳେଷଣ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।'
                : context === 'transcribeAudio'
                ? 'କ୍ଷମା କରନ୍ତୁ, ଅଡିଓ ଟ୍ରାନ୍ସକ୍ରାଇବ୍ କରିବାରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।'
                : 'କ୍ଷମା କରନ୍ତୁ, ଚାଟ୍ କରିବା ସମୟରେ ଏକ ତ୍ରୁଟି ଘଟିଛି।';
    }
  }

  return `${userMessage} ${tryAgain}`;
};

export const analyzeImageForText = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const userPrompt = `From the attached image, please extract all visible text with high accuracy, paying special attention to Odia script. Also, provide a brief analysis of the image's content. Please format your response clearly in Odia, using markdown headings for 'Extracted Text' and 'Image Analysis'.`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: userPrompt
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: odiaBotSystemInstruction
      }
    });
    
    return response.text;

  } catch (error) {
    const errorMessage = handleGeminiError(error, 'analyzeImage');
    throw new Error(errorMessage);
  }
};

export const transcribeAudio = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const prompt = `You are a speech-to-text engine specialized ONLY for Odia (ଓଡ଼ିଆ) transcription.
Convert spoken Odia audio into pure Odia Unicode text.
Never translate. Only transcribe EXACTLY what the speaker says.
If an English word is spoken, keep it in English.
Output ONLY the Odia transcription.`;

    const audioPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: prompt
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [audioPart, textPart] },
    });

    return response.text;
  } catch (error) {
    const errorMessage = handleGeminiError(error, 'transcribeAudio');
    throw new Error(errorMessage);
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

export const runChat = async (
  history: ChatMessage[],
  prompt: string,
  onChunk: (payload: { chunk: string; mode?: 'fast' | 'expert' }) => void,
  file?: { data: string; mimeType: string },
  signal?: AbortSignal
): Promise<{ groundingChunks: GroundingChunk[] }> => {
  try {
    let mode: 'fast' | 'expert' = 'expert';
    const trimmedPrompt = prompt.trim();
    const isVideoUrl = !file && isValidUrl(trimmedPrompt);

    // If there's a file or URL, it's an expert task. Skip classification.
    if (!file && !isVideoUrl && prompt) {
      const classifierPrompt = `Classify the following user query as 'fast' or 'expert'. 
'Fast' queries are simple facts, greetings, or short questions. 
'Expert' queries are complex, require reasoning, creativity, or detailed explanation. 
Respond with only the word 'fast' or 'expert'. 
Query: "${trimmedPrompt}"`;

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

    // Force pro model for video URLs to ensure better reasoning/analysis
    const modelName = (mode === 'fast' && !isVideoUrl) ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    const systemInstruction = mode === 'fast' ? fastModeInstruction : odiaBotSystemInstruction;

    const config: any = {
        systemInstruction: systemInstruction,
    };

    // Use Google Search for all non-file queries to ensure up-to-date information.
    if (!file) {
        config.tools = [{googleSearch: {}}];
    }

    if (isVideoUrl) {
        // Use thinking for video analysis to replicate the "Video Analyzer" feature depth
        config.thinkingConfig = { thinkingBudget: 16000 };
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

export const runSearch = async (
  history: Turn[],
  prompt: string,
  onChunk: (chunk: string) => void,
  location?: { latitude: number; longitude: number },
  signal?: AbortSignal
): Promise<{ text: string; groundingChunks: GroundingChunk[] }> => {
  try {
    const isVideoUrl = isValidUrl(prompt);

    const historyForApi = history.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));
    historyForApi.push({ role: 'user', parts: [{ text: prompt }] });

    let modelName = 'gemini-2.5-flash';
    let config: any = { systemInstruction: odiaBotSystemInstruction };

    if (isVideoUrl) {
      modelName = 'gemini-2.5-pro';
      config.thinkingConfig = { thinkingBudget: 16000 };
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
        config.thinkingConfig = { thinkingBudget: 16000 };
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
    }, { signal });

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
    if (error instanceof Error && error.name === 'AbortError') {
        onChunk(`\n\n*ଖୋଜିବା ବନ୍ଦ ହେଲା।*`);
        console.log('Search generation aborted.');
        return { text: '', groundingChunks: [] };
    }
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
