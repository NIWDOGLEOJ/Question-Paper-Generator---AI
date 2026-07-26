import JSZip from "jszip";
import Tesseract from "tesseract.js";
import * as pdfService from "./pdfService";

/**
 * Universal browser-first text extraction service for QPaper Gen.
 * Supports: .pdf, .docx, .pptx, .txt, .md, .png, .jpg, .jpeg, .webp
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (msg: string) => void,
  startPage?: number,
  endPage?: number
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  
  if (onProgress) onProgress(`Reading ${file.name}...`);

  switch (ext) {
    case "pdf":
      // Re-use our robust PDF digital text extraction and OCR fallback engine
      return await pdfService.extractTextFromPDF(file, onProgress, startPage, endPage);
      
    case "docx":
      return await extractDocxText(file, onProgress);
      
    case "pptx":
      return await extractPptxText(file, onProgress);
      
    case "md":
    case "txt":
    case "csv":
    case "json":
      return await readPlainAsText(file);
      
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return await extractImageText(file, onProgress);
      
    default:
      // Fallback: try reading as plain text if it's unknown but might be readable
      try {
        return await readPlainAsText(file);
      } catch {
        throw new Error(
          `Unsupported file format (.${ext}). Supported formats: .pdf, .docx, .pptx, .txt, .md, .png, .jpg, .jpeg, .webp`
        );
      }
  }
}

/** Reads plain text files using FileReader */
function readPlainAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Extracts text from .docx ZIP structure */
async function extractDocxText(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  try {
    if (onProgress) onProgress("Unzipping Word document...");
    const zip = await JSZip.loadAsync(file);
    const documentXmlFile = zip.file("word/document.xml");
    
    if (!documentXmlFile) {
      throw new Error("Invalid Word document structure: word/document.xml missing.");
    }
    
    if (onProgress) onProgress("Parsing document XML...");
    const xmlText = await documentXmlFile.async("string");
    
    // Extract paragraphs w:p to preserve layout structure
    const paragraphs = xmlText.match(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g);
    if (!paragraphs) {
      // Fallback: extract simple text runs w:t directly
      const tMatches = xmlText.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      return tMatches ? tMatches.map(m => m.replace(/<[^>]+>/g, "")).join(" ") : "";
    }
    
    return paragraphs
      .map(p => {
        const tMatches = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
        return tMatches ? tMatches.map(m => m.replace(/<[^>]+>/g, "")).join("") : "";
      })
      .filter(t => t.trim().length > 0)
      .join("\n\n");
      
  } catch (err: any) {
    throw new Error(`Failed to parse Word document: ${err.message}`);
  }
}

/** Extracts text from .pptx ZIP structure */
async function extractPptxText(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  try {
    if (onProgress) onProgress("Unzipping PowerPoint slideshow...");
    const zip = await JSZip.loadAsync(file);
    
    let pptxText = "";
    let slideNum = 1;
    
    if (onProgress) onProgress("Parsing slideshow slides...");
    
    while (true) {
      const slideFile = zip.file(`ppt/slides/slide${slideNum}.xml`);
      if (!slideFile) break;
      
      const slideXml = await slideFile.async("string");
      const tMatches = slideXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
      if (tMatches) {
        const slideContent = tMatches
          .map(m => m.replace(/<[^>]+>/g, ""))
          .join(" ");
        pptxText += `\n\n--- Slide ${slideNum} ---\n${slideContent}`;
      }
      slideNum++;
    }
    
    if (pptxText.trim().length === 0) {
      // Try alternative slide paths (some engines slide names slightly differ)
      const slides = Object.keys(zip.files).filter(k => k.startsWith("ppt/slides/slide"));
      for (let i = 0; i < slides.length; i++) {
        const xml = await zip.files[slides[i]].async("string");
        const tMatches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
        if (tMatches) {
          const content = tMatches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
          pptxText += `\n\n--- Slide ${i + 1} ---\n${content}`;
        }
      }
    }
    
    return pptxText.trim();
    
  } catch (err: any) {
    throw new Error(`Failed to parse PowerPoint slides: ${err.message}`);
  }
}

/** OCRs raw image files using Tesseract.js */
async function extractImageText(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  try {
    if (onProgress) onProgress("Initializing local OCR engine...");
    
    const res = await Tesseract.recognize(file, "eng", {
      logger: m => {
        if (onProgress && m.status === "recognizing text") {
          onProgress(`OCR Recognizing: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    if (onProgress) onProgress("OCR Text extraction complete.");
    return res.data.text;
    
  } catch (err: any) {
    throw new Error(`OCR Text extraction failed: ${err.message}`);
  }
}
