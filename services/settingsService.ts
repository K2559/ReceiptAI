import { AppSettings } from "../types";

const SETTINGS_KEY = 'receiptai_settings_v1';
const SETTINGS_VERSION_KEY = 'receiptai_settings_version';
const CURRENT_VERSION = 2; // Bump this when prompt/schema changes need to propagate

const DEFAULT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    merchantName: { type: "string", title: "Merchant" },
    transactionDate: { type: "string", title: "Date" },
    totalAmount: { type: "number", title: "Total" },
    currency: { type: "string", title: "Currency" },
    category: { type: "string", title: "Category" },
    items: {
      type: "array",
      title: "Line Items",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          price: { type: "number" }
        }
      }
    },
    boundingBox: {
      type: "array",
      items: { type: "number" },
      minItems: 4,
      maxItems: 4,
      title: "Bounding Box",
      description: "Receipt bounding box as [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates, or null if not detected"
    }
  },
  required: ["merchantName", "totalAmount", "category"]
}, null, 2);

const DEFAULT_PROMPT = `Analyze this receipt image and extract the details according to the provided JSON schema.
Ensure all numeric values are numbers, and dates are in YYYY-MM-DD format.

Additionally, detect the receipt area in the image and return its bounding box in normalized coordinates (0-1000 scale).
The bounding box should be returned as [ymin, xmin, ymax, xmax] where:
- ymin: top edge (0 = top of image, 1000 = bottom)
- xmin: left edge (0 = left of image, 1000 = right)
- ymax: bottom edge
- xmax: right edge

If the receipt fills the entire image or no distinct receipt boundary is detected, return null for boundingBox.`;

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-2.5-flash',
  systemPrompt: DEFAULT_PROMPT,
  outputSchema: DEFAULT_SCHEMA,
  imageStorage: 'imgbb',
  imgbbApiKey: '',
  cloudinaryCloudName: '',
  cloudinaryUploadPreset: '',
  concurrentApiCalls: 10
};

export const getSettings = (): AppSettings => {
  const saved = localStorage.getItem(SETTINGS_KEY);
  const savedVersion = parseInt(localStorage.getItem(SETTINGS_VERSION_KEY) || '0', 10);
  
  if (saved) {
    const parsedSettings = JSON.parse(saved);
    
    // If version is outdated, update prompt and schema to include bounding box
    if (savedVersion < CURRENT_VERSION) {
      console.log('Updating settings to version', CURRENT_VERSION);
      // Update to new prompt and schema with bounding box support
      parsedSettings.systemPrompt = DEFAULT_PROMPT;
      parsedSettings.outputSchema = DEFAULT_SCHEMA;
      // Save the updated settings
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsedSettings));
      localStorage.setItem(SETTINGS_VERSION_KEY, String(CURRENT_VERSION));
    }
    
    return { ...DEFAULT_SETTINGS, ...parsedSettings };
  }
  
  // New user - set version
  localStorage.setItem(SETTINGS_VERSION_KEY, String(CURRENT_VERSION));
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const resetSettings = () => {
  localStorage.removeItem(SETTINGS_KEY);
  return DEFAULT_SETTINGS;
};
