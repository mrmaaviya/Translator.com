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

  const prompt = `You are a high-precision professional translator specializing in English, Hindi, and Urdu.
  Translate the following text from ${sourceLang === "Detect Language" ? "the automatically detected language" : sourceLang} to ${targetLang}.

  Quality Standards:
  1. Contextual Accuracy: Understand the core meaning and intent of the text, not just word-for-word translation.
  2. Idiomatic Fluency: Use natural, idiomatic expressions common in ${targetLang}. Avoid literal translations that sound "translated" or robotic.
  3. Tone & Register: Strictly match the tone (formal, professional, casual, or technical) of the original text. 
     - For Hindi/Urdu: Use appropriate gender markers and levels of respect (e.g., "Aap" vs "Tum/Tu") based on the context.
  4. Cultural Nuance: Ensure the translation is culturally appropriate for speakers of ${targetLang}.
  5. Formatting: Maintain the original formatting, punctuation, and casing.

  Strict Rule: Output ONLY the translated text. Do not provide explanations, notes, or alternative translations.

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
  const prompt = `You are a professional document translator specializing in government and administrative documents in English, Hindi, and Urdu.
  Perform high-accuracy OCR on this ${mimeType.includes("pdf") ? "PDF document" : "image"} and translate all extracted text to ${targetLang}.

  Quality Standards:
  1. Contextual Accuracy: Extract and translate with a deep understanding of administrative and formal language.
  2. Structural Integrity: Maintain the original formatting, tables, headers, and bullet points as much as possible. Use Markdown to represent the structure if applicable.
  3. Professional Tone: Use highly formal and precise vocabulary in ${targetLang} appropriate for the document type.
  4. Idiomatic Content: Ensure legal and administrative terms are translated using their standard ${targetLang} equivalents.
  ${instruction ? `5. Additional User Instructions: ${instruction}` : ""}

  Strict Rule: Output ONLY the translated text. Do not provide explanations or meta-comments.`;

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

export async function generateDraftFromInstruction(
  type: "letter" | "noting" | "draft",
  language: SupportedLanguage,
  instruction: string
): Promise<string> {
  const prompt = `Act as an expert Government Administrative Officer (IAS/PCS level). 
  Generate a professional ${type === "letter" ? "official letter (Patra)" : type === "noting" ? "office noting sheet (Sanchika)" : "official draft (Masuda)"} in ${language} based on the following instructions.
  
  Instructions: ${instruction}
  
  Guidelines:
  1. Use the standard official government format (Sarkari Format).
  2. For a Letter: Include proper Letter Number (Patrank) placeholder, Date (Dinank) placeholder, From/To sections, Subject (Vishay), Salutation, and professional body text.
  3. For a Noting: Include historical context, current proposal, rules/references, and a clear recommendation section.
  4. Use highly formal vocabulary appropriate for government departments in ${language}.
  5. If the instructions are in a different language than the target language ${language}, translate the intent accurately while maintaining the formal tone.
  
  Output only the drafted document.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || "Drafting failed.";
  } catch (error) {
    console.error("Direct drafting error:", error);
    throw error;
  }
}
