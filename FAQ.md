# Frequently Asked Questions (FAQ)

Common questions and answers about the Question Paper Generator.

## General Questions

### What is the Question Paper Generator?

The Question Paper Generator is a web application that automatically creates customized question papers from PDF textbooks. It can use either template-based generation or AI-powered generation (via LM Studio) to create questions based on the actual content of your textbook.

### Is it free to use?

Yes! The application is completely free and open-source under the MIT License. There are no subscriptions, API costs, or hidden fees.

### Do I need an internet connection?

No, once you've loaded the app in your browser, it works completely offline. All processing happens locally on your machine. LM Studio (if used) also runs locally without requiring internet.

### Is my data private?

Absolutely! Everything runs in your browser. Your PDFs, generated papers, and settings never leave your computer. There are no external servers or cloud storage involved.

## Installation & Setup

### What do I need to run this app?

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Node.js 16+ and pnpm (for development/installation)
- Optional: LM Studio for AI-powered generation

### How do I install it?

```bash
pnpm install
pnpm run dev
```

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

### Can I use this on mobile?

The app is optimized for desktop browsers. Mobile support is limited but basic functionality should work on tablets.

## PDF Processing

### What types of PDFs are supported?

The app works with PDFs that contain actual text (text-based PDFs). Scanned PDFs (images of pages) without OCR won't work because there's no text to extract.

### How do I know if my PDF will work?

Try opening the PDF and selecting text with your cursor. If you can select and copy text, it will work. If you can't select text, it's likely a scanned image.

### What's the maximum PDF size?

The app supports PDFs up to 50MB. Larger files may cause performance issues or run out of memory.

### Why are some pages being skipped?

The app automatically filters out non-educational content like:
- Copyright pages
- Table of contents
- Index pages
- Author biographies
- Acknowledgments
- Publisher information

This ensures only actual educational content is used for generating questions.

### Can I use textbooks in other languages?

Currently, the app works best with English textbooks. Support for other languages is planned for future versions.

## Question Generation

### How many questions can I generate?

There's no hard limit, but practical limits depend on:
- Your browser's memory
- PDF size and content quality
- Whether you're using LM Studio

Recommended: Start with 20-30 questions per paper.

### What question types are supported?

- **Multiple Choice (MCQ)**: 4 options per question
- **True/False**: Statement-based questions
- **Short Answer**: 2-3 sentence responses
- **Essay**: Detailed, analytical responses
- **Fill in the Blanks**: Complete the sentence

### Why are the questions not very good?

Without LM Studio (template-based):
- Questions are generated from templates using extracted keywords
- Quality depends heavily on the textbook's content quality
- Better for practice tests than actual exams

With LM Studio (AI-powered):
- Questions are contextually relevant and intelligent
- Much better quality and coherence
- Suitable for actual exams

**Solution**: Enable LM Studio for significantly better questions!

### Can I edit questions after generation?

Currently, questions cannot be edited after generation. You can:
- Regenerate the paper with different settings
- Copy questions and edit them manually in a word processor
- Delete and create a new paper

Question editing is planned for a future version.

## LM Studio Integration

### Do I need LM Studio?

No, LM Studio is optional. The app works without it using template-based generation. However, LM Studio significantly improves question quality.

### Which model should I use?

Recommended models:
- **Fast**: nvidia/nemotron-3-nano-4b (4B parameters)
- **Balanced**: mistral-7b-instruct (7B parameters)
- **Best Quality**: llama-3-8b (8B parameters)

Smaller = faster, Larger = better quality

### Why won't LM Studio connect?

Most common issue: **CORS is not enabled**

Fix:
1. Open LM Studio
2. Go to "Developer" or "Server" tab
3. Find and check "Enable CORS" checkbox
4. Restart the server

Other issues:
- Server not running (check for green indicator)
- Wrong URL (should be `http://localhost:1234/v1`)
- Firewall blocking localhost

See [LM_STUDIO_SETUP.md](LM_STUDIO_SETUP.md) for detailed troubleshooting.

### How long does AI generation take?

Depends on:
- Your computer's CPU/GPU
- Model size (4B is faster than 7B)
- Number of questions

Typical times:
- 4B model: ~5-10 seconds per section
- 7B model: ~15-30 seconds per section
- 13B model: ~30-60 seconds per section

### Can I use OpenAI instead of LM Studio?

Not currently. The app is designed for LM Studio's local inference. However, since we use the OpenAI-compatible format, adding OpenAI support would be straightforward. This is planned for a future version.

## Data Storage

### Where are my papers saved?

Papers are saved in your browser's localStorage. They persist even after closing the browser.

### How many papers can I save?

Depends on your browser's localStorage limit (typically 5-10MB). You can save hundreds of papers, but may need to delete old ones eventually.

### How do I export/backup my papers?

Currently, papers can only be printed or saved as PDF via browser print. Proper export functionality (Word, PDF) is planned for future versions.

### Can I sync papers across devices?

No, papers are stored locally per browser. Cloud sync is planned for a future version.

### How do I delete all my data?

Open browser console (F12) and run:
```javascript
localStorage.clear()
```

Then refresh the page.

## Technical Questions

### Which browsers are supported?

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Older browsers may not work correctly.

### Can I self-host this?

Yes! Since it's a static web app:
1. Run `pnpm run build`
2. Deploy the `dist` folder to any static host
3. Examples: GitHub Pages, Netlify, Vercel, or your own server

### Is there a backend?

No, the app runs entirely in the browser. There's no backend server, database, or API (except optional LM Studio running locally).

### Can I contribute to the project?

Yes! We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### How do I report a bug?

Open an issue on GitHub with:
- Description of the bug
- Steps to reproduce
- Browser and OS version
- Console errors (F12)

See [CONTRIBUTING.md](CONTRIBUTING.md) for bug report template.

## Features & Roadmap

### Can I generate answer keys?

Not yet. Answer key generation is planned for a future version.

### Can I use images in questions?

Not currently. Image support is planned for future versions.

### Can I import question banks?

Not yet. Question bank/library features are planned.

### Can I collaborate with other teachers?

Not yet. Collaborative features are planned for future versions.

### What features are coming next?

Planned features (in rough priority order):
1. Export to Word/PDF
2. Answer key generation
3. Question editing after generation
4. Question bank/library
5. OCR support for scanned PDFs
6. Multi-language support
7. Image support in questions
8. Cloud sync
9. Collaborative editing
10. Mobile app

See [CHANGELOG.md](CHANGELOG.md) for detailed roadmap.

## Performance

### The app is slow. How can I speed it up?

Tips:
- Use smaller PDFs (under 10MB)
- Reduce number of questions per section
- Use faster LM Studio models (4B instead of 7B)
- Close other browser tabs
- Clear browser cache and restart

### My browser crashes when generating papers

Likely causes:
- PDF too large (>50MB)
- Too many questions at once
- Insufficient RAM

Solutions:
- Use smaller PDFs
- Generate in smaller batches
- Close other programs
- Increase browser memory limit

### Why does PDF extraction take so long?

Large PDFs with many pages take time to process. The app:
1. Reads entire PDF
2. Extracts text from each page
3. Filters non-educational pages
4. Analyzes content for keywords/topics

This can take 5-30 seconds for large textbooks.

## Troubleshooting

### "No readable text found in PDF"

Your PDF is likely a scanned image without text. Use a PDF with actual text, or use OCR software to add text to the PDF first.

### "Failed to fetch" error with LM Studio

CORS is not enabled. See "Why won't LM Studio connect?" above.

### Questions are repeating

This can happen with:
- Short PDFs (not enough content)
- Too many questions requested
- Poor quality textbooks

Solution: Use longer, better quality textbooks or reduce question count.

### Print layout is broken

Use browser print (Ctrl/Cmd + P) instead of saving to PDF directly. Ensure:
- Print background graphics is enabled
- Margins are set appropriately
- Paper size is correct (usually A4 or Letter)

### Papers not appearing in dashboard

Check:
- Browser's localStorage is enabled
- Not in private/incognito mode
- No browser extensions blocking localStorage
- Browser console (F12) for errors

## Getting Help

Still have questions?

1. **Check documentation**: README.md, LM_STUDIO_SETUP.md, QUICKSTART.md
2. **Search issues**: Someone may have asked already
3. **Browser console**: Check for error messages (F12)
4. **Ask**: Open a GitHub Discussion or Issue

---

**Can't find your question?** Open a GitHub Discussion and we'll help!
