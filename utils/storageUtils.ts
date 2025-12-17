// IndexedDB has much larger limits (typically 50% of disk space or several GB)
// This now returns a more accurate estimate using the Storage API
export const getStorageUsage = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      used,
      usedMB: (used / (1024 * 1024)).toFixed(2),
      estimatedLimit: quota,
      limitMB: (quota / (1024 * 1024)).toFixed(0),
      percentUsed: quota > 0 ? ((used / quota) * 100).toFixed(1) : '0'
    };
  }
  // Fallback for older browsers
  return {
    used: 0,
    usedMB: '0',
    estimatedLimit: 0,
    limitMB: '0',
    percentUsed: '0'
  };
};

// Sync version for backward compatibility (returns null, use async version)
export const getStorageUsageSync = () => {
  // With IndexedDB, we can't easily get sync usage
  // Return a placeholder that indicates "unknown"
  return {
    used: 0,
    usedMB: '?',
    estimatedLimit: 0,
    percentUsed: '0'
  };
};

export const isStorageNearLimit = async () => {
  const usage = await getStorageUsage();
  return parseFloat(usage.percentUsed) > 80;
};

// With IndexedDB, storage warnings are much less likely
// Only warn if we're using a significant portion of available space
export const getStorageWarning = () => {
  // IndexedDB has GB of space, so we don't show warnings by default
  // Users can check storage in Settings if needed
  return null;
};
