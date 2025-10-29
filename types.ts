
export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  file?: {
    name: string;
    type: string;
    previewUrl: string;
  };
  feedback?: 'liked' | 'disliked' | null;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}
