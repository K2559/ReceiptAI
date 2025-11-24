# Image Storage Setup Guide

## Problem
Browser localStorage has a 5-10MB limit. Receipt images stored as base64 quickly exceed this limit, causing images to be lost after refresh.

## Solution
Use free cloud image hosting services to store images online permanently.

---

## Option 1: ImgBB (Recommended - Easiest)

**Free Tier:** Unlimited storage, no bandwidth limits

### Setup Steps:
1. Go to https://api.imgbb.com/
2. Sign up for a free account
3. Get your API key from the dashboard
4. In ReceiptAI Settings page:
   - Select "ImgBB" as Image Storage Provider
   - Paste your API key
   - Click Save

**Note:** The app includes a demo API key that works without signup, but it has rate limits. Get your own key for production use.

---

## Option 2: Cloudinary (More Features)

**Free Tier:** 25GB storage, 25GB bandwidth/month

### Setup Steps:
1. Go to https://cloudinary.com/users/register/free
2. Sign up for a free account
3. Go to Settings → Upload → Add upload preset
4. Create an "Unsigned" preset (for browser uploads)
5. Note your Cloud Name and Upload Preset name
6. In ReceiptAI Settings page:
   - Select "Cloudinary" as Image Storage Provider
   - Enter your Cloud Name
   - Enter your Upload Preset name
   - Click Save

---

## Option 3: Local Storage (Not Recommended)

Uses browser localStorage with base64 encoding. Has 5-10MB total limit across all data.

**Only use this for:**
- Testing with a few receipts
- Offline-only usage
- When you can't use cloud storage

---

## How It Works

1. When you upload a receipt image, it's automatically uploaded to your chosen cloud provider
2. The cloud provider returns a permanent URL (e.g., `https://i.ibb.co/abc123/receipt.jpg`)
3. This URL is stored in localStorage instead of the full image data
4. Images remain accessible even after page refresh or deployment
5. The original image is still sent to the LLM for processing

---

## Troubleshooting

**Images still disappearing?**
- Check that you've saved your settings
- Verify your API keys are correct
- Check browser console for upload errors
- Try switching to a different provider

**Upload failing?**
- Check your internet connection
- Verify API key/credentials are correct
- Check if you've exceeded free tier limits
- The app will fallback to local storage if upload fails

**Privacy concerns?**
- Images are uploaded to third-party services
- For sensitive receipts, use local storage or self-hosted solutions
- Both ImgBB and Cloudinary have privacy policies and GDPR compliance
