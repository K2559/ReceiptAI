export const getStorageUsage = () => {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return {
    used: total,
    usedMB: (total / (1024 * 1024)).toFixed(2),
    // Most browsers have 5-10MB limit
    estimatedLimit: 10 * 1024 * 1024,
    percentUsed: ((total / (10 * 1024 * 1024)) * 100).toFixed(1)
  };
};

export const isStorageNearLimit = () => {
  const usage = getStorageUsage();
  return parseFloat(usage.percentUsed) > 80;
};

export const getStorageWarning = () => {
  const usage = getStorageUsage();
  const percent = parseFloat(usage.percentUsed);
  
  if (percent > 90) {
    return {
      level: 'critical' as const,
      message: `Storage is ${usage.percentUsed}% full (${usage.usedMB}MB). Configure cloud storage (ImgBB/Cloudinary) in Settings to avoid data loss.`
    };
  } else if (percent > 80) {
    return {
      level: 'warning' as const,
      message: `Storage is ${usage.percentUsed}% full (${usage.usedMB}MB). Consider configuring cloud storage in Settings.`
    };
  }
  return null;
};
