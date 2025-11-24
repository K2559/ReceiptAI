import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData } from "../types";
import { v4 as uuidv4 } from 'uuid';

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
    }
  },
  required: ["merchantName", "totalAmount", "items", "category"],
};

export const extractReceiptData = async (file: File): Promise<ReceiptData> => {
  try {
    const ai = getClient();
    const imagePart = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          imagePart,
          { text: "Analyze this receipt image and extract the following details into JSON format: Merchant Name, Date, Total Amount, Currency, Category, and individual line items." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsedData = JSON.parse(text);

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
      rawImage: URL.createObjectURL(file) // Store temporary URL for display
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
      rawImage: URL.createObjectURL(file)
    };
  }
};
