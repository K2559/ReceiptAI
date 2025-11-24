import { AppSettings } from "../types";

const SETTINGS_KEY = 'receiptai_settings_v1';

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
    }
  },
  required: ["merchantName", "totalAmount", "category"]
}, null, 2);

const DEFAULT_PROMPT = "Analyze this receipt image and extract the details according to the provided JSON schema. Ensure all numeric values are numbers, and dates are in YYYY-MM-DD format.";

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: '',
  model: 'gemini-2.5-flash',
  systemPrompt: DEFAULT_PROMPT,
  outputSchema: DEFAULT_SCHEMA
};

export const getSettings = (): AppSettings => {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const resetSettings = () => {
  localStorage.removeItem(SETTINGS_KEY);
  return DEFAULT_SETTINGS;
};
