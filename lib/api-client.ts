import { API_URL, ScrapeUploadResponse, ScrapeJob, Article, ArticleFilters, Publication } from './types';

// Error handling helper
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'API request failed');
  }
  return response.json();
}

// ============================================
// Scraping API
// ============================================

export async function uploadExcel(file: File): Promise<ScrapeUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/scrape/upload`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse<ScrapeUploadResponse>(response);
}

export async function startScraping(jobId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/scrape/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId }),
  });

  await handleResponse(response);
}

export async function getScrapeStatus(jobId: string): Promise<ScrapeJob> {
  const response = await fetch(`${API_URL}/api/scrape/status/${jobId}`);
  return handleResponse<ScrapeJob>(response);
}

// ============================================
// Articles API
// ============================================

export async function getArticles(filters?: ArticleFilters): Promise<Article[]> {
  const params = new URLSearchParams();

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  const url = `${API_URL}/api/articles${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

  return handleResponse<Article[]>(response);
}

export async function getArticle(id: string): Promise<Article> {
  const response = await fetch(`${API_URL}/api/articles/${id}`);
  return handleResponse<Article>(response);
}

export async function updateArticle(id: string, data: Partial<Article>): Promise<Article> {
  const response = await fetch(`${API_URL}/api/articles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return handleResponse<Article>(response);
}

export async function deleteArticle(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/articles/${id}`, {
    method: 'DELETE',
  });

  await handleResponse(response);
}

// ============================================
// Attachments API
// ============================================

export function getAttachmentDownloadUrl(attachmentId: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

// ============================================
// Translation API
// ============================================

export async function startTranslation(articleIds: string[]): Promise<{ job_id: string }> {
  const response = await fetch(`${API_URL}/api/translate/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_ids: articleIds }),
  });

  return handleResponse<{ job_id: string }>(response);
}

// ============================================
// Publishing API
// ============================================

export async function publishHTML(title: string, articleIds: string[]): Promise<Publication> {
  const response = await fetch(`${API_URL}/api/publish/html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, article_ids: articleIds }),
  });

  return handleResponse<Publication>(response);
}

export async function sendEmail(
  publicationId: string,
  recipients: string[],
  subject: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/publish/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publication_id: publicationId,
      recipients,
      subject,
    }),
  });

  await handleResponse(response);
}

export async function getPublication(id: string): Promise<Publication> {
  const response = await fetch(`${API_URL}/api/publish/${id}`);
  return handleResponse<Publication>(response);
}
