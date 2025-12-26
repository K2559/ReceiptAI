import React, { useState, useEffect } from 'react';
import { BoundingBox } from '../types';
import { cropImageByBoundingBox, isValidBoundingBox } from '../utils/imageCropUtils';
import { Crop, Maximize2, Loader2 } from 'lucide-react';

export interface CroppedImageProps {
  src: string;
  boundingBox?: BoundingBox;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  showToggle?: boolean;
  padding?: number;
}

/**
 * CroppedImage component that displays either a cropped or full image
 * based on bounding box availability and user preference.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
const CroppedImage: React.FC<CroppedImageProps> = ({
  src,
  boundingBox,
  alt = 'Image',
  className = '',
  style,
  draggable = false,
  showToggle = true,
  padding = 0,
}) => {
  const [showCropped, setShowCropped] = useState(true);
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBoundingBox = boundingBox && isValidBoundingBox(boundingBox);

  useEffect(() => {
    // Reset state when src or boundingBox changes
    setCroppedSrc(null);
    setError(null);

    if (!hasBoundingBox || !showCropped) {
      return;
    }

    const cropImage = async () => {
      setIsLoading(true);
      try {
        const cropped = await cropImageByBoundingBox(src, boundingBox as [number, number, number, number], { padding });
        setCroppedSrc(cropped);
      } catch (err) {
        console.error('Failed to crop image:', err);
        setError('Failed to crop image');
        // Fall back to full image on error
      } finally {
        setIsLoading(false);
      }
    };

    cropImage();
  }, [src, boundingBox, showCropped, hasBoundingBox, padding]);

  // Determine which image to display
  const displaySrc = showCropped && croppedSrc ? croppedSrc : src;

  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 z-10">
          <Loader2 className="animate-spin text-brand-600" size={24} />
        </div>
      )}

      {/* Image */}
      <img
        src={displaySrc}
        alt={alt}
        className={className}
        style={style}
        draggable={draggable}
      />

      {/* Toggle button - only show if bounding box is available */}
      {showToggle && hasBoundingBox && (
        <button
          onClick={() => setShowCropped(!showCropped)}
          className="absolute top-2 right-2 bg-white/90 backdrop-blur shadow-md rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs font-medium text-slate-700 hover:bg-white transition-colors z-20 border border-slate-200"
          title={showCropped ? 'Show full image' : 'Show cropped image'}
        >
          {showCropped ? (
            <>
              <Maximize2 size={14} />
              Full
            </>
          ) : (
            <>
              <Crop size={14} />
              Cropped
            </>
          )}
        </button>
      )}

      {/* Error indicator */}
      {error && !isLoading && (
        <div className="absolute bottom-2 left-2 bg-red-100 text-red-700 text-xs px-2 py-1 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default CroppedImage;
