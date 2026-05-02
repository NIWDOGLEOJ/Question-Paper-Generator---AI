import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-66acca32/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload PDF endpoint - stores PDF data in KV store
app.post("/make-server-66acca32/upload-pdf", async (c) => {
  try {
    console.log('Upload PDF endpoint called');
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file in form data');
      return c.json({ error: 'No file provided' }, 400);
    }

    console.log(`File received: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Generate unique file ID
    const timestamp = Date.now();
    const fileId = `pdf-${timestamp}`;
    
    // Read file as base64 for storage
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Store PDF data in KV
    await kv.set(fileId, {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'application/pdf',
      data: base64Data,
      uploadedAt: new Date().toISOString(),
    });

    console.log(`PDF stored successfully: ${fileId}`);
    return c.json({ fileId, success: true });
  } catch (error) {
    console.error('Error in upload-pdf endpoint:', error);
    return c.json({ 
      error: 'Server error during PDF upload', 
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// Generate questions endpoint
app.post("/make-server-66acca32/generate-questions", async (c) => {
  try {
    const { fileId, sections, paperTitle, subject, duration } = await c.req.json();

    if (!fileId || !sections) {
      return c.json({ error: 'Missing required fields: fileId or sections' }, 400);
    }

    console.log(`Generating questions for file: ${fileId}`);

    // Retrieve PDF from KV store
    const pdfRecord = await kv.get(fileId);
    
    if (!pdfRecord || !pdfRecord.data) {
      console.error('PDF not found in KV store:', fileId);
      return c.json({ error: 'PDF file not found' }, 404);
    }

    // Convert base64 back to ArrayBuffer
    const binaryString = atob(pdfRecord.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const pdfText = await extractTextFromPDF(arrayBuffer);

    if (!pdfText || pdfText.trim().length === 0) {
      return c.json({ error: 'Failed to extract text from PDF or PDF is empty' }, 500);
    }

    console.log(`Extracted ${pdfText.length} characters from PDF`);

    // Generate questions using OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
      return c.json({ error: 'OpenAI API key not configured. Please set up your API key.' }, 500);
    }

    console.log('Calling OpenAI to generate questions...');
    const generatedPaper = await generateQuestionsWithOpenAI(pdfText, sections, openaiApiKey, paperTitle, subject);

    // Store the generated paper in KV store
    const paperId = `paper-${Date.now()}`;
    await kv.set(paperId, {
      id: paperId,
      title: paperTitle || 'Generated Question Paper',
      subject: subject || 'Subject',
      duration: duration || '120 Minutes',
      totalMarks: sections.reduce((acc: number, s: any) => acc + (s.count * s.marks), 0),
      sections: generatedPaper.sections,
      createdAt: new Date().toISOString(),
      sourceFile: pdfRecord.fileName,
    });

    // Clean up the PDF from KV store to save space
    await kv.del(fileId);

    console.log(`Question paper generated successfully: ${paperId}`);
    return c.json({ paperId, success: true });
  } catch (error) {
    console.error('Error in generate-questions endpoint:', error);
    return c.json({ 
      error: 'Server error during question generation', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Get paper by ID
app.get("/make-server-66acca32/papers/:id", async (c) => {
  try {
    const paperId = c.req.param('id');
    const paper = await kv.get(paperId);

    if (!paper) {
      return c.json({ error: 'Paper not found' }, 404);
    }

    return c.json(paper);
  } catch (error) {
    console.error('Error fetching paper:', error);
    return c.json({ error: 'Server error while fetching paper', details: String(error) }, 500);
  }
});

// List all papers
app.get("/make-server-66acca32/papers", async (c) => {
  try {
    const papers = await kv.getByPrefix('paper-');
    
    // Sort by creation date (newest first)
    const sortedPapers = papers.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json({ papers: sortedPapers });
  } catch (error) {
    console.error('Error listing papers:', error);
    return c.json({ error: 'Server error while listing papers', details: String(error) }, 500);
  }
});

// Helper function to extract text from PDF
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Use pdf-parse library via npm:
    const pdfParse = (await import('npm:pdf-parse/lib/pdf-parse.js')).default;
    const buffer = new Uint8Array(arrayBuffer);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`PDF text extraction failed: ${error}`);
  }
}

// Helper function to generate questions using OpenAI
async function generateQuestionsWithOpenAI(
  pdfText: string,
  sections: any[],
  apiKey: string,
  paperTitle?: string,
  subject?: string
) {
  const systemPrompt = `You are an expert educator and question paper creator. Your task is to analyze the provided textbook content and generate high-quality, relevant questions based on the specified structure.

Important guidelines:
- Generate questions that are directly related to the content in the provided text
- Ensure questions are clear, unambiguous, and at the appropriate difficulty level
- For multiple choice questions, provide 4 options with only one correct answer
- For short answer and essay questions, ensure they require thoughtful responses
- Maintain academic rigor and proper grammar
- Return ONLY valid JSON without any markdown formatting or code blocks`;

  const userPrompt = `Based on the following textbook content, generate a question paper with these specifications:

TEXTBOOK CONTENT (excerpt):
${pdfText.substring(0, 8000)}

PAPER STRUCTURE:
${sections.map((s: any, idx: number) => `
Section ${idx + 1}: ${s.name}
- Type: ${s.type}
- Number of questions: ${s.count}
- Marks per question: ${s.marks}
- Difficulty: ${s.difficulty}
`).join('\n')}

Generate the questions in the following JSON format:
{
  "sections": [
    {
      "name": "Section A",
      "instructions": "Answer all questions. Each question carries X marks.",
      "type": "Multiple Choice",
      "questions": [
        {
          "id": 1,
          "text": "Question text here?",
          "options": ["Option A", "Option B", "Option C", "Option D"]
        }
      ]
    },
    {
      "name": "Section B",
      "instructions": "Answer any X questions. Each question carries Y marks.",
      "type": "Short Answer",
      "questions": [
        {
          "id": 2,
          "text": "Question text here?"
        }
      ]
    }
  ]
}

Generate questions that are directly derived from the textbook content provided above.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API request failed: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const generatedPaper = JSON.parse(cleanedContent);

    return generatedPaper;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error(`OpenAI question generation failed: ${error}`);
  }
}

Deno.serve(app.fetch);