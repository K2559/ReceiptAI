
export interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

export type ReceiptStatus = 'processing' | 'draft' | 'approved' | 'rejected' | 'error';

// Bounding box in normalized coordinates (0-1000 scale)
// Format: [ymin, xmin, ymax, xmax]
export type BoundingBox = [number, number, number, number] | null;

export interface ReceiptData extends Record<string, any> {
  id: string;
  createdAt: number;
  status: ReceiptStatus;
  rawImage?: string;
  boundingBox?: BoundingBox;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED', // Keeping for legacy/internal reference if needed
  ERROR = 'ERROR'
}

export type LLMProvider = 'gemini' | 'openrouter' | 'local';
export type ImageStorageProvider = 'imgbb' | 'cloudinary' | 'local';

export interface AppSettings {
  provider: LLMProvider;
  apiKey: string; // For OpenRouter or custom Gemini key
  baseUrl: string; // For Local/OpenRouter
  model: string;
  systemPrompt: string;
  outputSchema: string; // JSON string representation of the schema
  imageStorage: ImageStorageProvider;
  imgbbApiKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  concurrentApiCalls: number; // Number of concurrent LLM API calls
}
