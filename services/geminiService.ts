import { GoogleGenAI, Type } from "@google/genai";
import { PinVariation } from "../types";
import { isAbortError } from "../utils";

const getAI = (userApiKey?: string) => {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set it in your Profile settings.");
  }
  return new GoogleGenAI({ apiKey });
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (isAbortError(err)) throw err;
      
      const errMsg = err.message?.toLowerCase() || "";
      const is503 = errMsg.includes('503') || errMsg.includes('unavailable') || errMsg.includes('high demand');
      const isTransient = is503 || errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('deadline') || errMsg.includes('timeout');
      
      // If it's a 503 or transient error, retry with exponential backoff
      if (isTransient && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`AI call failed (attempt ${i + 1}/${retries}), retrying in ${waitTime}ms...`, err.message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // If it's an abort error, we might want to just throw it without retry
      // but we should make sure it's handled gracefully upstream
      throw err;
    }
  }
  throw new Error('AI service is currently unavailable due to high demand. Please try again in a few moments.');
};

const parseAIError = (error: any): string => {
  if (typeof error === 'string') return error;
  
  // Try to extract message from Gemini SDK error structure
  const msg = error.message || "";
  try {
    // Sometimes the message is a JSON string
    if (msg.startsWith('{')) {
      const parsed = JSON.parse(msg);
      return parsed.error?.message || parsed.message || msg;
    }
  } catch (e) {
    // Not JSON, continue with original message
  }
  
  return msg || "An unexpected AI error occurred.";
};

export const generatePinVariations = async (keyword: string, userApiKey?: string): Promise<{ variations: PinVariation[], gradientColors: string[] }> => {
  const ai = getAI(userApiKey);
  const textPrompt = `
    Act as a Pinterest Marketing Expert. 
    Context: User wants pins for the keyword "${keyword}".
    
    Task: 
    1. Generate 5 DISTINCT variations with different marketing angles (e.g., educational, inspirational, direct response). 
    2. For EACH variation, provide:
       - A unique image prompt (vertical style, aesthetic).
       - A viral headline.
       - A Pinterest SEO Title (max 100 chars, keywords first).
       - A unique SEO Description (approx 150-250 chars). IMPORTANT: Include 10 relevant, trending hashtags at the very end of this description string.
       - 10 hashtags (also provide them separately in the hashtags field).
       - A tailored Call to Action (CTA) string (MAX 25 characters).
       - Suggested hex colors for text and outline.
    
    CRITICAL: Ensure the SEO Title and Description are highly relevant to "${keyword}".
  `;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: textPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  seoTitle: { type: Type.STRING },
                  seoDescription: { type: Type.STRING },
                  hashtags: { type: Type.STRING },
                  textColor: { type: Type.STRING },
                  outlineColor: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  ctaText: { type: Type.STRING }
                },
                required: ["headline", "seoTitle", "seoDescription", "hashtags", "textColor", "outlineColor", "imagePrompt", "ctaText"]
              }
            },
            gradientColors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["variations", "gradientColors"]
        }
      }
    }));

    if (!response.text) {
      throw new Error("Empty response from AI model.");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    if (isAbortError(error)) throw error;
    const parsedMsg = parseAIError(error);
    console.error("Text Generation Error:", error);
    throw new Error(parsedMsg);
  }
};

export const generateSEOMetadata = async (headline: string, keyword: string, userApiKey?: string): Promise<{ title: string, description: string, hashtags: string }> => {
  const ai = getAI(userApiKey);
  const prompt = `
    Act as a Pinterest SEO Expert. 
    Topic: ${keyword}
    Headline: ${headline}
    
    Task: Generate optimized Pinterest metadata.
    1. Title: Engaging, keyword-rich, under 100 characters.
    2. Description: Compelling, 2-3 sentences, naturally includes high-volume keywords. IMPORTANT: Include 10 trending hashtags at the end of the description.
    3. Hashtags: 10 relevant, trending hashtags (separate list).
    
    Output as JSON.
  `;
  
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            hashtags: { type: Type.STRING }
          },
          required: ["title", "description", "hashtags"]
        }
      }
    }));
    
    if (!response.text) {
      throw new Error("Empty response from AI model.");
    }

    return JSON.parse(response.text);
  } catch (e: any) {
    if (isAbortError(e)) throw e;
    const parsedMsg = parseAIError(e);
    console.error("SEO Metadata Error:", e);
    throw new Error(parsedMsg);
  }
};

export const rephraseCTA = async (headline: string, userApiKey?: string): Promise<string[]> => {
  const ai = getAI(userApiKey);
  const prompt = `Based on the Pinterest headline: "${headline}", suggest 3 short, high-converting Call to Action (CTA) phrases. Max 25 characters each. Output as JSON array of strings.`;
  
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    }));

    if (!response.text) {
      throw new Error("Empty response from AI model.");
    }

    return JSON.parse(response.text);
  } catch (e: any) {
    if (isAbortError(e)) throw e;
    // For CTA, we can return defaults instead of throwing
    console.error("CTA Rephrase Error:", e);
    return ["Learn More", "Get Started", "Read Now"];
  }
};

export const generatePinImage = async (prompt: string, userApiKey?: string): Promise<string> => {
  const ai = getAI(userApiKey);
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "3:4" } }
    }));
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image data");
  } catch (error: any) {
    if (isAbortError(error)) throw error;
    const parsedMsg = parseAIError(error);
    console.error("Image Generation Error:", error);
    throw new Error(parsedMsg);
  }
};