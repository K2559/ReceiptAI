# ReceiptAI

A modern web application that uses AI to digitize and manage receipts automatically.

<div align="center">
<img width="1200" height="475" alt="ReceiptAI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## 🚀 Live Demo

**[https://k2559.github.io/ReceiptAI/](https://k2559.github.io/ReceiptAI/)**

## ✨ Features

- 📸 **Image Upload** - Upload receipt images for automatic data extraction
- 🤖 **AI-Powered Extraction** - Intelligent text extraction using Google Gemini AI
- 💾 **Local Storage** - All data stored locally in your browser
- 📊 **Excel Export** - Export receipts to Excel spreadsheets
- 📄 **PDF Reports** - Generate professional PDF reports with multi-select
- � **JeSON Backup** - Export/import complete database with images as base64
- 🔍 **Search & Filter** - Easily find receipts by merchant, date, or status
- ⚙️ **Customizable Settings** - Configure AI provider and API settings

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **AI Provider**: Google Gemini AI
- **PDF Generation**: jsPDF
- **Excel Export**: SheetJS

## 📦 Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/k2559/ReceiptAI.git
   cd ReceiptAI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## 🔑 Getting an API Key

To use ReceiptAI, you need a Google Gemini API key:

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and add it to your `.env.local` file

## 📖 Usage

1. **Upload Receipt**: Navigate to the Upload page and select a receipt image
2. **AI Processing**: The AI will automatically extract merchant, date, amount, and line items
3. **Review & Edit**: Review the extracted data and make any necessary corrections
4. **Save**: Save the receipt to your local database
5. **Export**: Generate Excel or PDF reports from the Database page

### Data Backup & Restore

- **Export JSON**: Click "Export JSON" to download your complete database including all images as base64
- **Import JSON**: Click "Import JSON" to restore a previously exported database file
- The import process automatically skips duplicate receipts based on ID
- JSON exports preserve all data including receipt images for complete backup

## 🚀 Deployment

### GitHub Pages (Automatic)

This project is configured for automatic deployment to GitHub Pages:

1. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Under "Build and deployment", select "GitHub Actions" as the source

2. **Add API Key Secret**:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GEMINI_API_KEY`
   - Value: Your Google Gemini API key

3. **Deploy**:
   - Push your code to the `main` branch
   - GitHub Actions will automatically build and deploy
   - Your app will be available at `https://yourusername.github.io/ReceiptAI/`

### Manual Deployment

```bash
npm run build
npm run deploy
```

## 🔄 CI/CD

The project includes two GitHub Actions workflows:

- **CI** (`ci.yml`): Runs on pull requests and pushes to validate builds
- **Deploy** (`deploy.yml`): Automatically deploys to GitHub Pages on push to main

## 📁 Project Structure

```
ReceiptAI/
├── components/          # React components
├── pages/              # Page components
├── services/           # API and storage services
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── context/            # React context providers
└── public/             # Static assets
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Google Gemini AI for powerful text extraction
- React team for the amazing framework
- All open source contributors

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
