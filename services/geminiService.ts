import { GoogleGenAI, Type } from "@google/genai";
import { FeedbackItem, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini to analyze feedback text and screenshots.
 */
export const analyzeFeedback = async (title: string, description: string, screenshotBase64?: string): Promise<AIAnalysisResult | null> => {
  try {
    const parts: any[] = [
      { text: `Analyze this customer feedback and categorize it accurately. 
      Examine the screenshot if provided to find visual bugs or UI issues.
      Title: ${title}
      Description: ${description}` }
    ];

    if (screenshotBase64) {
      const matches = screenshotBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "Category like: Feature, Bug, UI/UX, Performance, Mobile" },
            sentiment: { type: Type.STRING, description: "positive, neutral, or negative" },
            suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            impactScore: { type: Type.NUMBER, description: "1-10 priority based on user need" },
            aiInsight: { type: Type.STRING, description: "A concise insight explaining why this is important or what was noticed in the image." }
          },
          required: ["category", "sentiment", "suggestedTags", "impactScore", "aiInsight"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return null;
    
    return JSON.parse(textOutput) as AIAnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};

/**
 * Summarizes feedback items into a high-level roadmap.
 */
export const generateRoadmapSummary = async (feedbacks: FeedbackItem[]): Promise<string> => {
  const content = feedbacks.map(f => `- [${f.category}] ${f.title}: ${f.description}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Act as a senior product manager. Based on this feedback, generate a brief, professional roadmap summary with key themes and prioritization. Do not use Markdown formatting like bolding or headers, just plain text with bullets.
      
      Feedback:
      ${content}` }] },
    });

    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Gemini Roadmap Error:", error);
    return "Unable to generate roadmap summary.";
  }
};