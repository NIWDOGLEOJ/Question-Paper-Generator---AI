# Question Paper Generator

An intelligent web application that generates customized question papers from PDF textbooks using AI. Upload your textbook, define the paper structure, and get a professionally formatted question paper with questions based on the actual content of your book.

![Question Paper Generator](https://img.shields.io/badge/React-18.3.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8) ![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [LM Studio Integration](#lm-studio-integration)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### Core Features
- 📄 **PDF Upload**: Upload textbook PDFs up to 50MB
- 🤖 **AI-Powered Generation**: Uses local LLM (via LM Studio) or template-based generation
- 📊 **Custom Structure**: Define sections, question types, marks, and difficulty levels
- 📝 **Multiple Question Types**:
  - Multiple Choice Questions (MCQ)
  - True/False
  - Short Answer
  - Essay/Long Answer
  - Fill in the Blanks
- 🎯 **Intelligent Content Analysis**: Extracts keywords, concepts, definitions, and facts from PDFs
- 📋 **Dashboard**: View and manage previously generated papers
- 🖨️ **Print-Ready**: Clean, formatted output ready for printing
- 💾 **Local Storage**: All data stored locally in your browser

### Advanced Features
- 🔌 **LM Studio Integration**: Connect to your local AI model for smart question generation
- 🧠 **Content-Aware**: Generates questions based on actual textbook content
- 🎨 **Modern UI**: Clean, intuitive interface built with Radix UI components
- ⚡ **Fast & Responsive**: Built with React and optimized for performance
- 🌐 **No Backend Required**: Runs entirely in the browser
- 🔒 **Privacy First**: All processing happens locally - no data sent to external servers

## 🔄 How It Works

### Workflow

```
1. Upload PDF Textbook
         ↓
2. Extract Text Content
         ↓
3. Analyze Content
   - Filter out non-educational pages
   - Extract keywords and concepts
   - Identify definitions and facts
         ↓
4. Define Paper Structure
   - Set paper title and subject
   - Add sections with question types
   - Specify marks and difficulty
         ↓
5. Generate Questions
   - Option A: LM Studio AI (if enabled)
   - Option B: Template-based generation
         ↓
6. Review & Download
   - View generated paper
   - Print or save as PDF
```

### Content Analysis Process

The app performs intelligent analysis of your PDF:

1. **Page Filtering**: Automatically skips:
   - Copyright pages
   - Table of contents
   - Index pages
   - Author biographies
   - Acknowledgments

2. **Content Extraction**:
   - **Keywords**: Frequently occurring meaningful terms (appearing 3+ times)
   - **Topics**: Capitalized concepts and multi-word technical phrases
   - **Definitions**: Sentences containing "is", "defined as", "refers to"
   - **Facts**: Statements with data, percentages, or research claims
   - **Key Sentences**: Clean, meaningful sentences for True/False questions

3. **Question Generation**:
   - **With LM Studio**: AI analyzes context and generates intelligent questions
   - **Template-Based**: Uses extracted content to create structured questions

## 🛠 Tech Stack

### Frontend
- **React 18.3.1** - UI framework
- **React Router 7** - Navigation and routing
- **TypeScript** - Type safety
- **Tailwind CSS 4.1** - Styling
- **Radix UI** - Accessible UI components
- **Lucide React** - Icons

### PDF Processing
- **PDF.js** - PDF text extraction
- **pdfjs-dist 5.6.205** - PDF parsing library

### AI Integration
- **LM Studio** - Local LLM inference (optional)
- OpenAI-compatible API format

### State Management
- **LocalStorage API** - Data persistence
- React hooks for state management

### Build Tools
- **Vite 6.3.5** - Build tool and dev server
- **@vitejs/plugin-react** - React support

## 📦 Installation

### Prerequisites

- **Node.js** 16+ and **pnpm** (or npm)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **LM Studio** (optional, for AI-powered generation)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd question-paper-generator
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Start the development server**
   ```bash
   pnpm run dev
   # or
   npm run dev
   ```

4. **Open in browser**
   - The app will automatically open at the preview URL
   - Or navigate to the URL shown in the terminal

### Optional: LM Studio Setup

For AI-powered question generation:

1. **Download and install** [LM Studio](https://lmstudio.ai/)
2. **Load a model** (recommended: nvidia/nemotron-3-nano-4b or similar 4B-13B parameter model)
3. **Start the server** in LM Studio:
   - Go to "Developer" or "Server" tab
   - Click "Start Server"
   - **Enable CORS** (very important!)
4. **Configure in app**:
   - Click "LM Studio Settings" in the top right
   - Set API URL: `http://localhost:1234/v1`
   - Leave API Token empty
   - Set Model name: `nvidia/nemotron-3-nano-4b`
   - Test connection and enable

See [LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md) for detailed instructions.

## 🚀 Usage

### Quick Start

1. **Upload PDF**
   - Click "Upload a file" or drag and drop your textbook PDF
   - Wait for the file to load (max 50MB)

2. **Define Structure**
   - Enter paper title, subject, and duration
   - Add sections with the "+" button
   - For each section, specify:
     - Section name (e.g., "Section A")
     - Question type (MCQ, True/False, etc.)
     - Number of questions
     - Marks per question
     - Difficulty level

3. **Generate**
   - Click "Generate Paper"
   - Wait while the app analyzes the PDF and creates questions
   - If LM Studio is enabled, it will use AI; otherwise, template-based

4. **Review & Use**
   - View the generated paper
   - Print directly from the browser
   - Papers are auto-saved to your dashboard

### Example Paper Structure

```
Paper Title: Mid-Term Examination
Subject: Biology
Duration: 120 Minutes

Section A - Multiple Choice (10 questions × 1 mark)
Section B - True/False (5 questions × 2 marks)
Section C - Short Answer (5 questions × 5 marks)
Section D - Essay (2 questions × 10 marks)

Total: 75 marks
```

## 🤖 LM Studio Integration

### Why Use LM Studio?

- **Better Quality**: AI generates contextually relevant questions
- **Content-Aware**: Questions based on actual textbook content
- **Privacy**: Everything runs locally on your machine
- **No Costs**: Free to use, no API charges
- **Offline**: Works without internet

### Configuration

1. **API URL**: `http://localhost:1234/v1`
2. **Model**: Match the model loaded in LM Studio
3. **CORS**: Must be enabled in LM Studio

### How It Works

When enabled, the app:
1. Sends PDF content (up to 6000 characters) to your local LM Studio
2. Uses intelligent prompts to generate questions
3. Parses the AI response into structured questions
4. Falls back to template-based if AI fails

### Supported Models

Any model loaded in LM Studio works, but recommended:
- nvidia/nemotron-3-nano-4b (fast, good quality)
- llama-3-8b (better quality, slower)
- mistral-7b-instruct (balanced)

Smaller models (4B) are faster, larger models (7B-13B) produce better questions.

## 📁 Project Structure

```
question-paper-generator/
├── src/
│   ├── app/
│   │   ├── components/          # React components
│   │   │   ├── ui/              # Reusable UI components (Radix)
│   │   │   ├── LMStudioSettings.tsx  # LM Studio config panel
│   │   │   └── figma/           # Figma-imported components
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.tsx    # Main dashboard
│   │   │   ├── Generate.tsx     # Question generation wizard
│   │   │   └── ViewPaper.tsx    # Paper preview/print view
│   │   ├── services/            # Business logic
│   │   │   ├── pdfService.ts    # PDF processing & question generation
│   │   │   └── lmStudioService.ts  # LM Studio API integration
│   │   ├── App.tsx              # Main app component
│   │   ├── Layout.tsx           # App layout wrapper
│   │   └── routes.tsx           # Route definitions
│   ├── styles/
│   │   ├── theme.css            # Tailwind theme variables
│   │   └── fonts.css            # Font imports
│   └── imports/                 # Static assets
├── public/                      # Public assets
├── LM_STUDIO_SETUP.md          # LM Studio setup guide
├── README.md                    # This file
└── package.json                 # Dependencies
```

### Key Files

- **`pdfService.ts`**: Core logic for PDF text extraction, content analysis, and question generation
- **`lmStudioService.ts`**: LM Studio API integration and prompt engineering
- **`Generate.tsx`**: Multi-step wizard for paper generation
- **`Dashboard.tsx`**: Displays saved papers with search and delete
- **`ViewPaper.tsx`**: Formatted paper view for printing

## ⚙️ Configuration

### LocalStorage Keys

The app stores data in browser localStorage:

- `questionPapers`: Array of generated papers
- `lmStudioConfig`: LM Studio connection settings

### Clearing Data

To reset the app:
```javascript
// Open browser console (F12) and run:
localStorage.clear()
```

### LM Studio Config

Stored configuration:
```json
{
  "enabled": false,
  "apiUrl": "http://localhost:1234/v1",
  "model": "nvidia/nemotron-3-nano-4b",
  "apiToken": ""
}
```

## 🐛 Troubleshooting

### Common Issues

#### PDF Not Uploading
- **Check file size**: Max 50MB
- **Verify file type**: Must be `.pdf`
- **Try a different PDF**: Some PDFs may be scanned images (not text-based)

#### No Questions Generated
- **Check browser console** (F12) for errors
- **Verify PDF has text**: Scanned PDFs without OCR won't work
- **Try smaller sections**: Start with fewer questions

#### LM Studio Connection Fails
- **Enable CORS**: Check LM Studio server settings
- **Verify server is running**: Look for green indicator in LM Studio
- **Check URL**: Should be `http://localhost:1234/v1`
- **Test in terminal**: Use curl command from [LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md)
- **Browser console**: Check for CORS errors

#### Poor Question Quality
- **Use LM Studio**: AI generates better questions than templates
- **Use larger models**: 7B-13B parameters produce better results
- **Check PDF quality**: Better textbooks = better questions
- **Adjust difficulty**: Try different difficulty levels

#### Papers Not Saving
- **Check localStorage**: Browser may have disabled it
- **Storage quota**: Clear old papers if limit reached
- **Private browsing**: May not persist data

### Getting Help

1. **Check browser console** (F12) for detailed errors
2. **Review LM_STUDIO_SETUP.md** for LM Studio issues
3. **Open an issue** on GitHub with:
   - Error message
   - Browser and version
   - Steps to reproduce
   - Console logs (if applicable)

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Commit with clear messages**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Use TypeScript for type safety
- Follow existing code style
- Add comments for complex logic
- Test with different PDFs
- Update README if adding features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's PDF rendering library
- **LM Studio** - Local LLM inference platform
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first CSS framework
- **React Team** - For the amazing framework

## 📞 Support

- **Documentation**: See [LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md) for LM Studio setup
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 🗺️ Roadmap

Future improvements:
- [ ] Support for more question types (matching, ordering, etc.)
- [ ] Export to Word/PDF
- [ ] Question bank/library feature
- [ ] Multi-language support
- [ ] Answer key generation
- [ ] Image support in questions
- [ ] Batch processing (multiple PDFs)
- [ ] Cloud sync option
- [ ] Collaborative editing

---

**Made with ❤️ for educators and students**

*Generate smarter question papers, save time, and focus on what matters - teaching and learning.*
