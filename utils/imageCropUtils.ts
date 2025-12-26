import { BoundingBox } from '../types';

export interface CropOptions {
  padding?: number; // Extra padding around the bounding box (in pixels)
}

/**
 * Validates bounding box coordinates
 * @param boundingBox - The bounding box to validate
 * @returns boolean - True if valid
 */
export const isValidBoundingBox = (
  boundingBox: any
): boundingBox is [number, number, number, number] => {
  // Check if it's an array with exactly 4 elements
  if (!Array.isArray(boundingBox) || boundingBox.length !== 4) {
    return false;
  }

  // Check all values are numbers
  if (!boundingBox.every((val) => typeof val === 'number' && !isNaN(val))) {
    return false;
  }

  const [ymin, xmin, ymax, xmax] = boundingBox;

  // Check all values are in range [0, 1000]
  if (
    ymin < 0 || ymin > 1000 ||
    xmin < 0 || xmin > 1000 ||
    ymax < 0 || ymax > 1000 ||
    xmax < 0 || xmax > 1000
  ) {
    return false;
  }

  // Check ymin < ymax and xmin < xmax
  if (ymin >= ymax || xmin >= xmax) {
    return false;
  }

  return true;
};

/**
 * Crops an image based on normalized bounding box coordinates (0-1000 scale)
 * @param imageDataUrl - Base64 data URL of the image
 * @param boundingBox - [ymin, xmin, ymax, xmax] in 0-1000 scale
 * @param options - Optional cropping options
 * @returns Promise<string> - Cropped image as base64 data URL
 */
export const cropImageByBoundingBox = async (
  imageDataUrl: string,
  boundingBox: [number, number, number, number],
  options?: CropOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const [ymin, xmin, ymax, xmax] = boundingBox;
        const padding = options?.padding ?? 0;

        // Convert normalized coordinates (0-1000) to actual pixel coordinates
        const imgWidth = img.width;
        const imgHeight = img.height;

        let cropX = Math.round((xmin / 1000) * imgWidth) - padding;
        let cropY = Math.round((ymin / 1000) * imgHeight) - padding;
        let cropWidth = Math.round(((xmax - xmin) / 1000) * imgWidth) + (padding * 2);
        let cropHeight = Math.round(((ymax - ymin) / 1000) * imgHeight) + (padding * 2);

        // Clamp values to image bounds
        cropX = Math.max(0, cropX);
        cropY = Math.max(0, cropY);
        cropWidth = Math.min(cropWidth, imgWidth - cropX);
        cropHeight = Math.min(cropHeight, imgHeight - cropY);

        // Ensure minimum dimensions
        cropWidth = Math.max(1, cropWidth);
        cropHeight = Math.max(1, cropHeight);

        // Create canvas and crop
        const canvas = document.createElement('canvas');
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, cropWidth, cropHeight
        );

        // Return as data URL (preserve original format if possible)
        const format = imageDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const croppedDataUrl = canvas.toDataURL(format, 0.92);
        resolve(croppedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
};
