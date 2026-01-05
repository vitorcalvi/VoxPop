
export type FeedbackStatus = 'open' | 'planned' | 'in-progress' | 'completed' | 'closed';

export interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  category: string;
  votes: number;
  status: FeedbackStatus;
  createdAt: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  aiInsight?: string;
  screenshot?: string; // Base64 encoded image
}

export interface AIAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}
