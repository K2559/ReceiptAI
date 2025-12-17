
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ReceiptData } from "../types";
import { v4 as uuidv4 } from 'uuid';
import { getSettings } from "./settingsService";

// Debug logging system
export interface DebugLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}

let debugLogs: DebugLog[] = [];

export const addDebugLog = (level: DebugLog['level'], message: string, details?: any) => {
  const log: DebugLog = {
    timestamp: Date.now(),
    level,
    message,
    details
  };
  debugLogs.push(log);
  console.log(`[${level.toUpperCase()}] ${message}`, details || '');
};

export const getDebugLogs = () => [...debugLogs];
export const clearDebugLogs = () => { debugLogs = []; };

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
        addDebugLog('info', `Retry attempt ${attempt}/${maxRetries}`, { delay });
        await sleep(delay);
      }
      
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable (network errors, 5xx errors, rate limits)
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
        addDebugLog('error', `Request failed after ${attempt} attempts`, { 
          error: lastError.message,
          isRetryable 
        });
        throw lastError;
      }

      addDebugLog('warn', `Request failed, will retry`, { 
        attempt: attempt + 1,
        maxRetries,
        error: lastError.message,
        nextDelay: Math.min(delay * backoffMultiplier, maxDelay)
      });

      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
};

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

// Convert file to full base64 data URL (includes data:mime;base64, prefix)
const fileToBase64DataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Resize and compress image for storage (reduces base64 size significantly)
const resizeAndCompressImage = (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 1200,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use JPEG for better compression (unless it's a PNG with transparency)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const compressedDataUrl = canvas.toDataURL(outputType, quality);
      
      addDebugLog('info', 'Image compressed', {
        originalSize: file.size,
        originalDimensions: `${img.width}x${img.height}`,
        newDimensions: `${width}x${height}`,
        compressedSize: compressedDataUrl.length,
        compressionRatio: ((1 - compressedDataUrl.length / (file.size * 1.37)) * 100).toFixed(1) + '%'
      });

      resolve(compressedDataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
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
      addDebugLog('info', 'Uploading to ImgBB...');
      const apiKey = settings.imgbbApiKey || 'd0d3c0d3c0d3c0d3c0d3c0d3c0d3c0d3';
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await withRetry(
        () => fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          body: formData
        }),
        { maxRetries: 2, initialDelay: 500 }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog('error', 'ImgBB upload failed', { status: response.status, error: errorText });
        throw new Error('ImgBB upload failed');
      }
      const data = await response.json();
      addDebugLog('success', 'ImgBB upload successful', { url: data.data.url });
      return data.data.url;
      
    } else if (settings.imageStorage === 'cloudinary') {
      addDebugLog('info', 'Uploading to Cloudinary...');
      if (!settings.cloudinaryCloudName || !settings.cloudinaryUploadPreset) {
        addDebugLog('error', 'Cloudinary credentials not configured');
        throw new Error('Cloudinary credentials not configured');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', settings.cloudinaryUploadPreset);
      
      const response = await withRetry(
        () => fetch(
          `https://api.cloudinary.com/v1_1/${settings.cloudinaryCloudName}/image/upload`,
          { method: 'POST', body: formData }
        ),
        { maxRetries: 2, initialDelay: 500 }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog('error', 'Cloudinary upload failed', { status: response.status, error: errorText });
        throw new Error('Cloudinary upload failed');
      }
      const data = await response.json();
      addDebugLog('success', 'Cloudinary upload successful', { url: data.secure_url });
      return data.secure_url;
      
    } else {
      addDebugLog('info', 'Using local base64 storage (no cloud provider configured)');
      throw new Error('Using local storage');
    }
  } catch (error) {
    addDebugLog('warn', 'Cloud upload failed, using compressed base64 for persistent storage', { error: (error as Error).message });
    // Resize and compress image before storing as base64 to save localStorage space
    try {
      return await resizeAndCompressImage(file);
    } catch (compressError) {
      addDebugLog('warn', 'Image compression failed, using original', { error: (compressError as Error).message });
      return await fileToBase64DataUrl(file);
    }
  }
};

export const extractReceiptData = async (file: File): Promise<ReceiptData> => {
  const settings = getSettings();
  const baseId = uuidv4();
  
  addDebugLog('info', `Starting extraction for: ${file.name}`, { 
    fileSize: file.size, 
    fileType: file.type,
    provider: settings.provider 
  });
  
  try {
    let extractedData: any = {};
    
    // Upload image to cloud storage first
    addDebugLog('info', 'Uploading image to cloud storage...');
    let imageUrl: string;
    try {
      imageUrl = await uploadImageToCloud(file);
      addDebugLog('success', 'Image uploaded successfully', { 
        url: imageUrl.substring(0, 50) + '...',
        isBase64: imageUrl.startsWith('data:'),
        isObjectURL: imageUrl.startsWith('blob:')
      });
    } catch (uploadError) {
      addDebugLog('warn', 'Image upload failed, using temporary object URL', { error: (uploadError as Error).message });
      imageUrl = URL.createObjectURL(file);
    }
    
    // Get base64 for LLM processing
    const base64Data = await fileToBase64(file);
    const base64Preview = base64Data.substring(0, 50) + '...';
    addDebugLog('info', 'Image converted to base64', { preview: base64Preview });
    
    const defaultResult: ReceiptData = {
      id: baseId,
      createdAt: Date.now(),
      status: 'error',
      rawImage: imageUrl
    };

    if (settings.provider === 'gemini') {
      // Gemini Implementation
      addDebugLog('info', '🔵 Using Gemini provider', { model: settings.model || 'gemini-2.5-flash' });
      
      const apiKey = settings.apiKey || process.env.API_KEY;
      if (!apiKey) {
        addDebugLog('error', 'API Key missing for Gemini');
        throw new Error("API Key missing for Gemini");
      }
      
      addDebugLog('info', 'Initializing Gemini client...');
      const ai = new GoogleGenAI({ apiKey });
      
      let parsedSchema: Schema | undefined;
      try {
        const jsonSchema = JSON.parse(settings.outputSchema);
        parsedSchema = convertSchemaToGemini(jsonSchema);
        addDebugLog('info', 'Schema parsed successfully', { schema: parsedSchema });
      } catch (e) {
        addDebugLog('warn', 'Invalid Schema for Gemini, proceeding without schema', { error: e });
      }

      const requestPayload = {
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
      };
      
      addDebugLog('info', 'Sending request to Gemini API...', { 
        model: requestPayload.model,
        promptLength: settings.systemPrompt.length,
        hasSchema: !!parsedSchema
      });

      const response = await withRetry(
        () => ai.models.generateContent(requestPayload),
        { maxRetries: 3, initialDelay: 1000 }
      );
      
      addDebugLog('success', 'Received response from Gemini');

      const text = response.text;
      if (!text) {
        addDebugLog('error', 'Empty response from Gemini', { response });
        throw new Error("No response from Gemini");
      }
      
      addDebugLog('info', 'Parsing Gemini response...', { responsePreview: text.substring(0, 100) });
      extractedData = JSON.parse(text);
      addDebugLog('success', 'Successfully parsed Gemini response', { extractedData });

    } else {
      // OpenRouter / Local / OpenAI Compatible Implementation
      const baseUrl = settings.baseUrl || (settings.provider === 'local' ? 'http://localhost:11434/v1' : 'https://openrouter.ai/api/v1');
      const apiKey = settings.apiKey;
      
      addDebugLog('info', `🟢 Using ${settings.provider} provider`, { 
        baseUrl, 
        model: settings.model,
        hasApiKey: !!apiKey 
      });
      
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

      addDebugLog('info', 'Sending request to LLM API...', { 
        url: `${baseUrl}/chat/completions`,
        model: body.model,
        headers: Object.keys(headers)
      });

      const res = await withRetry(
        () => fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        }),
        { maxRetries: 3, initialDelay: 1000 }
      );

      addDebugLog('info', `Received response: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        const errText = await res.text();
        addDebugLog('error', `LLM API Error: ${res.status}`, { 
          status: res.status, 
          statusText: res.statusText,
          errorBody: errText 
        });
        throw new Error(`LLM Error: ${res.status} - ${errText}`);
      }

      const json = await res.json();
      addDebugLog('info', 'Parsing LLM response...', { responseKeys: Object.keys(json) });
      
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        addDebugLog('error', 'Empty response from LLM', { response: json });
        throw new Error("Empty response from LLM");
      }
      
      addDebugLog('info', 'Extracting content from response...', { contentPreview: content.substring(0, 100) });
      
      try {
        // Try to clean up the content if it has markdown code blocks
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/```\s*$/, '');
          addDebugLog('info', 'Removed markdown code block wrapper');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/```\s*$/, '');
          addDebugLog('info', 'Removed code block wrapper');
        }
        
        extractedData = JSON.parse(cleanContent);
        addDebugLog('success', 'Successfully parsed LLM response', { 
          dataKeys: Object.keys(extractedData),
          sampleFields: {
            hasId: !!extractedData.id,
            hasMerchant: !!(extractedData.merchant || extractedData.merchantName),
            hasTotal: !!(extractedData.total || extractedData.totalAmount),
            hasDate: !!(extractedData.date || extractedData.transactionDate)
          }
        });
      } catch (parseError) {
        addDebugLog('error', 'Failed to parse JSON from LLM response', { 
          rawContent: content.substring(0, 300),
          error: (parseError as Error).message 
        });
        throw new Error(`JSON parse error: ${(parseError as Error).message}`);
      }
    }

    // Validate that we have some meaningful data
    if (!extractedData || Object.keys(extractedData).length === 0) {
      addDebugLog('error', '❌ Extracted data is empty', { extractedData });
      return {
        ...defaultResult,
        status: 'error',
        error: 'No data extracted from receipt'
      };
    }
    
    addDebugLog('success', `✅ Extraction completed for: ${file.name}`);
    
    const finalResult = {
      ...defaultResult,
      status: 'draft' as const,
      ...extractedData,
      id: baseId, // Ensure our ID is preserved
      createdAt: Date.now(), // Ensure timestamp is preserved
      rawImage: imageUrl // Ensure image URL is preserved
    };
    
    addDebugLog('info', 'Final result prepared', { 
      id: finalResult.id,
      status: finalResult.status,
      fieldCount: Object.keys(finalResult).length,
      hasRequiredFields: {
        id: !!finalResult.id,
        status: !!finalResult.status,
        rawImage: !!finalResult.rawImage
      }
    });
    
    return finalResult;

  } catch (error) {
    const errorMessage = (error as Error).message;
    addDebugLog('error', `❌ Extraction failed for: ${file.name}`, { 
      error: errorMessage,
      stack: (error as Error).stack 
    });
    
    // Convert to compressed base64 for persistent storage even on error
    let errorImageUrl: string;
    try {
      errorImageUrl = await resizeAndCompressImage(file);
    } catch {
      try {
        errorImageUrl = await fileToBase64DataUrl(file);
      } catch {
        errorImageUrl = ''; // Fallback if all fails
      }
    }
    
    return {
      id: baseId,
      createdAt: Date.now(),
      status: 'error',
      rawImage: errorImageUrl,
      error: errorMessage
    };
  }
};
