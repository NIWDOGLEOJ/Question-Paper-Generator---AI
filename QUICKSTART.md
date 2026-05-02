# Quick Start Guide

Get your Question Paper Generator up and running in 5 minutes!

## ⚡ Super Quick Start (Without AI)

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start the app**
   ```bash
   pnpm run dev
   ```

3. **Open in browser** (auto-opens or check terminal for URL)

4. **Generate your first paper**:
   - Click "New Paper" or the big + button
   - Upload a PDF textbook
   - Click "Next Step"
   - Keep the default structure or customize it
   - Click "Generate Paper"
   - Wait ~3-5 seconds
   - View and print your paper!

**That's it!** You now have a working question paper generator.

## 🤖 With AI (LM Studio)

Want smarter, context-aware questions? Add LM Studio:

### 1. Install LM Studio
- Download from [lmstudio.ai](https://lmstudio.ai/)
- Install and open the app

### 2. Load a Model
- Go to "Search" tab
- Download: `nvidia/nemotron-3-nano-4b` (recommended for speed)
- Or any 4B-13B parameter model

### 3. Start Server
- Click "Developer" or "Server" tab
- Click "Start Server"
- **Check "Enable CORS"** ← Very important!
- Note the URL (usually `http://localhost:1234`)

### 4. Connect to App
- In the Question Paper Generator, click "LM Studio Settings" (top right)
- Enter:
  - API URL: `http://localhost:1234/v1`
  - API Token: (leave empty)
  - Model: `nvidia/nemotron-3-nano-4b`
- Click "Test Connection"
- Should show "Connected" ✅
- Check "Enable" and click "Save Settings"

### 5. Generate with AI
- Generate a paper as usual
- You'll see "LM Studio Active" badge during generation
- AI analyzes your textbook and creates intelligent questions!

## 📚 Your First Paper

### Recommended Settings

**For a quick test:**
```
Paper Title: Practice Test
Subject: General
Duration: 60 minutes

Section A: Multiple Choice - 5 questions × 2 marks (Easy)
Section B: True/False - 5 questions × 1 mark (Easy)
```

**For a real exam:**
```
Paper Title: Mid-Term Examination
Subject: Biology
Duration: 120 minutes

Section A: Multiple Choice - 10 questions × 1 mark (Easy)
Section B: True/False - 10 questions × 1 mark (Medium)
Section C: Short Answer - 5 questions × 5 marks (Medium)
Section D: Essay - 2 questions × 10 marks (Hard)

Total: 75 marks
```

## 🎯 Pro Tips

1. **Start Small**: Test with 2-3 sections first
2. **Good PDFs**: Use textbooks with clear text (not scanned images)
3. **File Size**: Smaller PDFs (under 10MB) process faster
4. **LM Studio**: Larger models = better questions but slower
5. **Print**: Use browser print (Ctrl/Cmd + P) for best results
6. **Save Papers**: Auto-saved to dashboard, no need to manually save

## ❓ Troubleshooting

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run dev
```

### PDF not generating questions
- Check if PDF has actual text (not scanned)
- Try a different, smaller PDF
- Check browser console (F12) for errors

### LM Studio won't connect
- Make sure server is running (green indicator in LM Studio)
- **Enable CORS** in LM Studio server settings
- Use `http://localhost:1234/v1` (not https)
- Test in terminal:
  ```bash
  curl http://localhost:1234/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"nvidia/nemotron-3-nano-4b","messages":[{"role":"user","content":"Hi"}]}'
  ```

### Poor question quality (without AI)
- Enable LM Studio for much better questions
- Or try a different textbook with clearer content
- Increase difficulty level for more complex questions

## 📖 Next Steps

- Read [README.md](README.md) for complete documentation
- Check [LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md) for detailed LM Studio guide
- See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to contribute

## 🎉 You're Ready!

Start generating better question papers in minutes, not hours.

**Happy Teaching! 📚**
