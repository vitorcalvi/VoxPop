// AI Service Stub - Chutes AI removed
// This service now returns null/fallback responses

export interface AIAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}

export interface ImageAnalysisResult {
  subject: string;
  details: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}

export const analyzeFeedback = async (
  _title: string,
  _description: string,
  _screenshotBase64?: string
): Promise<AIAnalysisResult | null> => {
  return null;
};

export const generateRoadmapSummary = async (_feedbacks: any[]): Promise<string> => {
  return 'AI roadmap generation is not configured. Please configure an AI provider to enable this feature.';
};

export const listChutes = async () => {
  return [];
};

export const analyzeImagesToFeedback = async (
  _imagesBase64: string[]
): Promise<ImageAnalysisResult | null> => {
  return null;
};
