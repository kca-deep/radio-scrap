// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Common types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ArticleStatus = 'scraped' | 'extracted' | 'translated';
export type CountryCode = 'KR' | 'US' | 'UK' | 'JP';

// Scraping related
export interface ScrapeJob {
  job_id: string;
  status: JobStatus;
  total_urls: number;
  processed_urls: number;
  created_at: string;
  updated_at: string;
}

export interface ScrapeUploadResponse {
  job_id: string;
  total_urls: number;
}

export interface ScrapeProgressEvent {
  processed: number;
  total: number;
  current_url?: string;
  article_id?: string;
  attachments_count?: number;
  error?: string;
  status: 'processing' | 'success' | 'error' | 'completed' | 'failed' | 'skipped';
  step?: 'scraped' | 'extracting' | 'extracted' | 'translating';
  skip_reason?: 'duplicate';
  success_count?: number;
  skipped_count?: number;
  error_count?: number;
  // Step-wise counters
  scraped_count?: number;
  extracted_count?: number;
  translated_count?: number;
  completed_at?: string;
}

// Auto-collect related
export interface ArticlePreview {
  title: string;
  url: string;
  published_date?: string;
  source: string;
  snippet?: string;
  document_type?: string;
  matched_keywords?: string[];
  is_duplicate?: boolean;
}

// Article progress tracking for scrape modal
export type ArticleStepStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ArticleProgressState {
  url: string;
  title: string;
  source: string;
  scrapeStatus: ArticleStepStatus;
  extractStatus: ArticleStepStatus;
  translateStatus: ArticleStepStatus;
  overallStatus: 'pending' | 'processing' | 'completed' | 'skipped' | 'error';
  error?: string;
}

export interface AutoCollectRequest {
  sources: string[];
  /** Date range filter: YYYY-MM for single month, or YYYY-MM~YYYY-MM for month range */
  date_range: string;
}

export interface AutoCollectStartRequest {
  selected_articles: ArticlePreview[];
}

export interface AutoCollectPreviewResponse {
  data: {
    fcc?: ArticlePreview[];
    ofcom?: ArticlePreview[];
    soumu?: ArticlePreview[];
  };
  warnings: string[];
  total_count: number;
}

export interface AutoCollectStartResponse {
  job_id: string;
  total_urls: number;
}

// Article related
export interface Article {
  id: string;
  url: string;
  title: string;
  title_ko?: string;
  content?: string;
  content_ko?: string;
  source: string;
  country_code?: CountryCode;
  published_date?: string;
  status: ArticleStatus;
  scraped_at: string;
  translated_at?: string;
  attachments?: Attachment[];
  attachments_count?: number;
}

export interface Attachment {
  id: number;
  article_id: string;
  filename: string;
  file_path: string;
  file_url?: string;
  downloaded_at: string;
}

// Filter related
export interface ArticleFilters {
  country_code?: CountryCode;
  status?: ArticleStatus;
  source?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

// Translation related
export interface TranslateJob {
  job_id: string;
  status: JobStatus;
  total_articles: number;
  processed_articles: number;
  created_at: string;
  updated_at: string;
}

export interface TranslateProgressEvent {
  processed: number;
  total: number;
  current_article_id?: string;
  error?: string;
  status: 'processing' | 'success' | 'error' | 'completed' | 'failed';
}

// Publishing related
export interface Publication {
  id: string;
  title: string;
  article_ids: string[];
  html_path?: string;
  created_at: string;
  sent_at?: string;
}
