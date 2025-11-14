

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  file?: {
    name: string;
    type: string;
    previewUrl: string;
  };
  mode?: 'fast' | 'expert';
  groundingChunks?: GroundingChunk[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface Conversations {
  [id: string]: Conversation;
}

export interface ReviewSnippet {
  uri: string;
  title: string;
  snippet: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: ReviewSnippet[];
    };
  };
}

export interface Turn {
  role: 'user' | 'model';
  text: string;
}
