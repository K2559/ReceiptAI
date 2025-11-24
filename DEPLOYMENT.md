# Deployment Guide for ReceiptAI

## GitHub Pages Deployment

Your app is now configured to deploy to GitHub Pages at: `https://k2559.github.io/ReceiptAI/`

### Steps to Deploy:

1. **Initialize Git repository (if not already done):**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub repository:**
   - Go to https://github.com/K2559/ReceiptAI
   - If it doesn't exist, create a new repository named `ReceiptAI`
   - Don't initialize with README (since you already have files)

3. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/K2559/ReceiptAI.git
   git branch -M main
   git push -u origin main
   ```

4. **Configure GitHub Pages:**
   - Go to your repository settings: https://github.com/K2559/ReceiptAI/settings/pages
   - Under "Build and deployment":
     - Source: Select "GitHub Actions"
   
5. **Add API Key Secret:**
   - Go to: https://github.com/K2559/ReceiptAI/settings/secrets/actions
   - Click "New repository secret"
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key
   - Click "Add secret"

6. **Deploy:**
   The GitHub Action will automatically deploy when you push to main branch.
   
   Or manually deploy using:
   ```bash
   npm install
   npm run deploy
   ```

### Your Live URL:
Once deployed, your app will be available at:
**https://k2559.github.io/ReceiptAI/**

### Important Notes:

- The app uses localStorage for data storage, so data is stored locally in the browser
- Users will need to enter their own Gemini API key in the Settings page
- The API key is stored securely in the browser's localStorage
- For production use, consider implementing a backend API to handle the Gemini API calls securely

### Troubleshooting:

If the deployment fails:
1. Check the Actions tab: https://github.com/K2559/ReceiptAI/actions
2. Ensure GitHub Pages is enabled in repository settings
3. Verify the GEMINI_API_KEY secret is set correctly
4. Make sure the repository is public (or you have GitHub Pro for private repos with Pages)
