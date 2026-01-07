export type FeedbackStatus = 'open' | 'planned' | 'in-progress' | 'completed' | 'closed';

export interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  category: string;
  votes: number;
  status: FeedbackStatus;
  createdAt: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  aiInsight?: string;
  screenshot?: string; // Legacy single screenshot
  screenshots?: string[]; // Multiple screenshots as array
}

export interface AIAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}
