// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Common types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ArticleStatus = 'scraped' | 'translated';
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
  status: 'processing' | 'success' | 'error' | 'completed' | 'failed';
  success_count?: number;
  error_count?: number;
  completed_at?: string;
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
  scraped_from?: string;
  scraped_to?: string;
  published_from?: string;
  published_to?: string;
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
