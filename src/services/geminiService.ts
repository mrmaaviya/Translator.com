import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type SupportedLanguage = "English" | "Hindi" | "Urdu" | "Detect Language";

export const LANGUAGES: SupportedLanguage[] = ["English", "Hindi", "Urdu"];

export async function translateText(
  text: string,
  sourceLang: SupportedLanguage,
  targetLang: SupportedLanguage
): Promise<string> {
  if (!text.trim()) return "";

  const prompt = `Translate the following text from ${sourceLang === "Detect Language" ? "detecting the source language" : sourceLang} to ${targetLang}. 
  Only provide the translated text without any explanations or extra characters.
  Text: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || "Translation failed.";
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

export async function translateFile(
  fileData: string,
  mimeType: string,
  targetLang: SupportedLanguage,
  instruction?: string
): Promise<string> {
  const prompt = `Perform OCR on this ${mimeType.includes("pdf") ? "PDF document" : "image"} and translate all extracted text to ${targetLang}. 
  Maintain the original formatting and structure as much as possible. 
  Only providing the translated text.
  ${instruction ? `Follow these additional instructions: ${instruction}` : ""}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileData,
            },
          },
          {
            text: prompt,
          },
        ],
      }],
    });
    return response.text?.trim() || "Analysis and translation failed.";
  } catch (error) {
    console.error("File translation error:", error);
    throw error;
  }
}

export async function generateGovResponse(
  fileData: string,
  mimeType: string,
  type: "reply" | "noting",
  language: SupportedLanguage,
  instruction?: string
): Promise<string> {
  const prompt = `Act as an expert Government Administrative Officer (IAS/PCS level). 
  Analyze the attached government letter (from Zila/Block/Anchal/Commissioner office) and generate a ${type === "reply" ? "formal response letter (Jawab)" : "detailed office note sheet (Sanchika)"} in ${language}.
  
  Guidelines:
  1. Use the standard official government format (Sarkari Format).
  2. For "Jawab" (Reply): Include proper Letter Number (Patrank), Date (Dinank), From/To sections, Subject (Vishay), Salutation, and professional body text.
  3. For "Sanchika" (Noting): Include historical context, current proposal, rules/references, and a clear recommendation for the higher authority.
  4. Use highly formal vocabulary appropriate for government departments in ${language}.
  ${instruction ? `Additional Instructions: ${instruction}` : ""}
  
  Output only the drafted document.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileData,
            },
          },
          {
            text: prompt,
          },
        ],
      }],
    });
    return response.text?.trim() || "Drafting failed.";
  } catch (error) {
    console.error("Gov response error:", error);
    throw error;
  }
}
