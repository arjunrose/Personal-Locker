import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client with the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes an intruder's photo to generate a security report.
 * @param base64Image The base64 string of the captured image (without data URI prefix if possible, but we'll handle clean up)
 * @returns A string containing the analysis.
 */
export const analyzeIntruderImage = async (base64Image: string): Promise<string> => {
  try {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: "You are a security system AI. Analyze this image of a person attempting unauthorized access. Describe their approximate age, facial expression (e.g., confused, focused, malicious), current environment, and any distinctive features for a security log. Keep it concise (under 50 words)."
          }
        ]
      }
    });

    return response.text || "Analysis failed: No text returned.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Security analysis currently unavailable.";
  }
};