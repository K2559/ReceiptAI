
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { getSettings } from "./settingsService";

// Helper to convert standard JSON schema types to Gemini Enums
const convertSchemaToGemini = (schema: any): Schema => {
  if (!schema) return { type: Type.OBJECT, properties: {} };
  
  const newSchema: any = { ...schema };
  
  if (newSchema.type) {
    newSchema.type = newSchema.type.toUpperCase();
  }

  if (newSchema.items) {
    newSchema.items = convertSchemaToGemini(newSchema.items);
  }

  if (newSchema.properties) {
    Object.keys(newSchema.properties).forEach(key => {
      newSchema.properties[key] = convertSchemaToGemini(newSchema.properties[key]);
    });
  }
  
  return newSchema as Schema;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Upload image to cloud storage
const uploadImageToCloud = async (file: File): Promise<string> => {
  const settings = getSettings();
  
  try {
    if (settings.imageStorage === 'imgbb') {
      // ImgBB - Get free API key from https://api.imgbb.com/
      const apiKey = settings.imgbbApiKey || 'd0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d3'; // Demo key
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('ImgBB upload failed');
      const data = await response.json();
      return data.data.url;
      
    } else if (settings.imageStorage === 'cloudinary') {
      // Cloudinary - Free tier: 25GB storage
      // Get credentials from https://cloudinary.com/
      if (!settings.cloudinaryCloudName || !settings.cloudinaryUploadPreset) {
        throw new Error('Cloudinary credentials not configured');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', settings.cloudinaryUploadPreset);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${settings.cloudinaryCloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      
      if (!response.ok) throw new Error('Cloudinary upload failed');
      const data = await response.json();
      return data.secure_url;
      
    } else {
      // Local storage (base64) - fallback
      throw new Error('Using local storage');
    }
  } catch (error) {
    console.warn('Cloud upload failed, using local base64 storage:', error);
    // Fallback to base64 if upload fails
    const base64 = await fileToBase64(file);
    return `data:${file.type};base64,${base64}`;
  }
};

export const extractReceiptData = async (file: File): Promise<ReceiptData> => {
  const settings = getSettings();
  const baseId = uuidv4();
  
  try {
    let extractedData: any = {};
    
    // Upload image to cloud storage first
    const imageUrl = await uploadImageToCloud(file);
    
    // Get base64 for LLM processing
    const base64Data = await fileToBase64(file);
    
    const defaultResult: ReceiptData = {
      id: baseId,
      createdAt: Date.now(),
      status: 'error',
      rawImage: imageUrl // Store cloud URL instead of base64
    };

    if (settings.provider === 'gemini') {
      // Gemini Implementation
      const apiKey = settings.apiKey || process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing for Gemini");
      
      const ai = new GoogleGenAI({ apiKey });
      
      let parsedSchema: Schema | undefined;
      try {
        const jsonSchema = JSON.parse(settings.outputSchema);
        parsedSchema = convertSchemaToGemini(jsonSchema);
      } catch (e) {
        console.error("Invalid Schema for Gemini", e);
      }

      const response = await ai.models.generateContent({
        model: settings.model || 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: file.type } },
            { text: settings.systemPrompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: parsedSchema,
          temperature: 0.1,
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from Gemini");
      extractedData = JSON.parse(text);

    } else {
      // OpenRouter / Local / OpenAI Compatible Implementation
      const baseUrl = settings.baseUrl || (settings.provider === 'local' ? 'http://localhost:11434/v1' : 'https://openrouter.ai/api/v1');
      const apiKey = settings.apiKey;
      
      // For OpenRouter/Local, we usually put schema in prompt
      const systemPromptWithSchema = `${settings.systemPrompt}\n\nYou MUST output valid JSON strictly adhering to this schema:\n${settings.outputSchema}`;

      const body = {
        model: settings.model,
        messages: [
          {
            role: "system",
            content: systemPromptWithSchema
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract data from this receipt." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }, 
        temperature: 0.1
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      if (settings.provider === 'openrouter') {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "ReceiptAI";
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM Error: ${res.status} - ${errText}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response from LLM");
      
      extractedData = JSON.parse(content);
    }

    return {
      ...defaultResult,
      status: 'draft', // Default to draft for human review
      ...extractedData,
    };

  } catch (error) {
    console.error("Extraction Error:", error);
    return {
        ...defaultResult,
        error: (error as Error).message
    };
  }
};
