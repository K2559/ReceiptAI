import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData, BoundingBox } from "../types";
import { isValidBoundingBox } from "../utils/imageCropUtils";
import { v4 as uuidv4 } from 'uuid';

// Retry mechanism with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
      
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = 
        lastError.message.includes('fetch') ||
        lastError.message.includes('network') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504') ||
        lastError.message.includes('429') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');

      if (!isRetryable || attempt === maxRetries) {
        console.error(`Request failed after ${attempt} attempts:`, lastError.message);
        throw lastError;
      }

      console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying...`, lastError.message);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
};

const fileToGenerativePart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const receiptSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    merchantName: { type: Type.STRING, description: "The name of the store or merchant." },
    transactionDate: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format." },
    totalAmount: { type: Type.NUMBER, description: "The total amount paid." },
    currency: { type: Type.STRING, description: "The currency symbol or code (e.g., $, USD)." },
    category: { 
      type: Type.STRING, 
      description: "The category of the expense (e.g., Food, Transport, Utilities, Office Supplies)." 
    },
    items: {
      type: Type.ARRAY,
      description: "List of items purchased.",
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          price: { type: Type.NUMBER },
        }
      }
    },
    boundingBox: {
      type: Type.ARRAY,
      description: "Receipt bounding box as [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates. ymin is top edge (0=top, 1000=bottom), xmin is left edge (0=left, 1000=right). Return null if receipt fills entire image or no distinct boundary detected.",
      items: { type: Type.NUMBER }
    }
  },
  required: ["merchantName", "totalAmount", "items", "category"],
};

/**
 * Parses and validates a bounding box from LLM response
 * @param rawBoundingBox - The raw bounding box data from LLM
 * @returns Valid BoundingBox or null if invalid/missing
 */
const parseBoundingBox = (rawBoundingBox: any): BoundingBox => {
  if (rawBoundingBox === null || rawBoundingBox === undefined) {
    return null;
  }

  if (isValidBoundingBox(rawBoundingBox)) {
    return rawBoundingBox;
  }

  // Log warning for invalid bounding box format
  console.warn('Invalid bounding box format received from LLM:', rawBoundingBox);
  return null;
};

export const extractReceiptData = async (file: File): Promise<ReceiptData> => {
  try {
    const ai = getClient();
    const imagePart = await fileToGenerativePart(file);

    const response = await withRetry(
      () => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            imagePart,
            { text: `Analyze this receipt image and extract the following details into JSON format: Merchant Name, Date, Total Amount, Currency, Category, and individual line items.

Additionally, detect the receipt area in the image and return its bounding box in normalized coordinates (0-1000 scale).
The bounding box should be returned as [ymin, xmin, ymax, xmax] where:
- ymin: top edge (0 = top of image, 1000 = bottom)
- xmin: left edge (0 = left of image, 1000 = right)
- ymax: bottom edge
- xmax: right edge

If the receipt fills the entire image or no distinct receipt boundary is detected, omit the boundingBox field.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: receiptSchema,
          temperature: 0.1, // Low temperature for factual extraction
        }
      }),
      { maxRetries: 3, initialDelay: 1000 }
    );

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsedData = JSON.parse(text);

    // Parse and validate bounding box, handling null/missing gracefully
    const boundingBox = parseBoundingBox(parsedData.boundingBox);

    return {
      id: uuidv4(),
      createdAt: Date.now(),
      status: 'draft',
      merchantName: parsedData.merchantName || "Unknown Merchant",
      transactionDate: parsedData.transactionDate || new Date().toISOString().split('T')[0],
      totalAmount: parsedData.totalAmount || 0,
      currency: parsedData.currency || "$",
      category: parsedData.category || "Uncategorized",
      items: parsedData.items || [],
      rawImage: URL.createObjectURL(file), // Store temporary URL for display
      boundingBox: boundingBox
    };
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    // Return a partial error object so the UI can handle it gracefully
    return {
      id: uuidv4(),
      createdAt: Date.now(),
      status: 'error',
      merchantName: "Error Processing",
      transactionDate: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      currency: "?",
      category: "Error",
      items: [],
      rawImage: URL.createObjectURL(file),
      boundingBox: null
    };
  }
};
