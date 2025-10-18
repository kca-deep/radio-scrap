# UI 구현 플랜

## 개요

Backend API가 완성된 상태에서 Next.js 15 프론트엔드 UI를 구현합니다.
스크랩 → 기사 관리 → 번역 → 발행의 4단계 워크플로우를 shadcn/ui 컴포넌트로 구현합니다.

**기술 스택**:
- Next.js 15 (App Router, React 19)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (New York style)
- Server-Sent Events (SSE) for real-time progress

---

## 1. 프로젝트 구조

```
/app
  /scrape              # 1단계: URL 스크랩
    page.tsx           # Excel 업로드 & 스크랩 시작
    /[jobId]
      page.tsx         # 스크랩 진행 상황 (SSE)

  /articles            # 2단계: 기사 관리
    page.tsx           # 기사 목록 (필터, 검색)
    /[id]
      page.tsx         # 기사 상세 (편집, 첨부파일)

  /translate           # 3단계: 번역
    page.tsx           # 번역할 기사 선택
    /[jobId]
      page.tsx         # 번역 진행 상황 (SSE)

  /publish             # 4단계: 매거진 발행
    page.tsx           # 발행할 기사 선택 & HTML 생성
    /[id]
      page.tsx         # 생성된 매거진 미리보기

  /magazine/[id]       # 매거진 뷰어 (공개용)
    page.tsx

/components
  /scrape
    excel-uploader.tsx        # Excel 파일 드래그앤드롭
    scrape-progress.tsx       # 실시간 진행률 표시
    url-preview-table.tsx     # 업로드 후 URL 목록 미리보기

  /articles
    article-table.tsx         # 기사 목록 테이블 (정렬, 필터)
    article-filters.tsx       # 국가/상태/날짜 필터
    article-card.tsx          # 기사 카드 (그리드 뷰용)
    article-detail.tsx        # 기사 상세 정보
    attachment-list.tsx       # 첨부파일 목록

  /translate
    article-selector.tsx      # 번역할 기사 선택 (체크박스)
    translate-progress.tsx    # 번역 진행률 (SSE)

  /publish
    magazine-editor.tsx       # 매거진 편집기
    article-picker.tsx        # 발행할 기사 선택
    email-form.tsx            # 이메일 발송 폼

  /ui                         # shadcn/ui 컴포넌트
    button.tsx
    table.tsx
    card.tsx
    badge.tsx
    progress.tsx
    ... (필요시 추가)

/lib
  api-client.ts              # Backend API 클라이언트
  types.ts                   # TypeScript 타입 정의
  utils.ts                   # 유틸리티 함수 (cn 등)
  hooks/
    use-sse.ts               # SSE 훅
    use-articles.ts          # 기사 조회 훅
```

---

## 2. API 클라이언트 구현

### 2.1 `lib/types.ts`

```typescript
// API Base URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 공통 타입
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ArticleStatus = 'scraped' | 'translated';
export type CountryCode = 'KR' | 'US' | 'UK' | 'JP';

// 스크랩 관련
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

// 기사 관련
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
  attachments: Attachment[];
}

export interface Attachment {
  id: number;
  article_id: string;
  filename: string;
  file_path: string;
  file_url?: string;
  downloaded_at: string;
}

// 필터 관련
export interface ArticleFilters {
  country_code?: CountryCode;
  status?: ArticleStatus;
  source?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

// 번역 관련
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

// 발행 관련
export interface Publication {
  id: string;
  title: string;
  article_ids: string[];
  html_path?: string;
  created_at: string;
  sent_at?: string;
}
```

### 2.2 `lib/api-client.ts`

```typescript
import { API_URL, ScrapeUploadResponse, ScrapeJob, Article, ArticleFilters, Publication } from './types';

// 에러 핸들링 헬퍼
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'API request failed');
  }
  return response.json();
}

// ============================================
// 스크랩 API
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
// 기사 API
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
// 첨부파일 API
// ============================================

export function getAttachmentDownloadUrl(attachmentId: number): string {
  return `${API_URL}/api/attachments/${attachmentId}/download`;
}

// ============================================
// 번역 API
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
// 발행 API
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
```

### 2.3 `lib/hooks/use-sse.ts`

```typescript
import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../types';

interface UseSSEOptions<T> {
  onEvent?: (event: T) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function useSSE<T = any>(
  endpoint: string | null,
  options: UseSSEOptions<T> = {}
) {
  const [events, setEvents] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onEvent, onComplete, onError } = options;

  useEffect(() => {
    if (!endpoint) return;

    const eventSource = new EventSource(`${API_URL}${endpoint}`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as T;

        setEvents((prev) => [...prev, data]);
        onEvent?.(data);

        // Check for completion
        if ('status' in data && (data.status === 'completed' || data.status === 'failed')) {
          onComplete?.();
          eventSource.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (e) => {
      const errorMsg = 'SSE connection error';
      setError(errorMsg);
      setIsConnected(false);
      onError?.(errorMsg);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [endpoint, onEvent, onComplete, onError]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, error, clearEvents };
}
```

---

## 3. 페이지별 구현 계획

### 3.1 `/scrape` - 스크랩 페이지

**기능**:
- Excel 파일 드래그앤드롭 업로드
- 업로드된 URL 목록 미리보기
- 스크랩 시작 버튼
- `/scrape/[jobId]`로 리다이렉트

**필요한 shadcn/ui 컴포넌트**:
- `button`
- `card`
- `table`
- `alert`

**주요 코드**:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadExcel, startScraping } from '@/lib/api-client';
import ExcelUploader from '@/components/scrape/excel-uploader';
import { Button } from '@/components/ui/button';

export default function ScrapePage() {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [totalUrls, setTotalUrls] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadExcel(file);
      setJobId(result.job_id);
      setTotalUrls(result.total_urls);
    } catch (error) {
      alert('Excel upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartScraping = async () => {
    if (!jobId) return;

    try {
      await startScraping(jobId);
      router.push(`/scrape/${jobId}`);
    } catch (error) {
      alert('Failed to start scraping');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">URL Scraping</h1>

      <ExcelUploader onUpload={handleUpload} isLoading={isUploading} />

      {jobId && (
        <div className="mt-8">
          <p>Total URLs: {totalUrls}</p>
          <Button onClick={handleStartScraping}>Start Scraping</Button>
        </div>
      )}
    </div>
  );
}
```

### 3.2 `/scrape/[jobId]` - 스크랩 진행 상황

**기능**:
- 실시간 진행률 표시 (SSE)
- 처리 중인 URL 표시
- 성공/실패 카운트
- 완료 후 `/articles`로 이동

**필요한 shadcn/ui 컴포넌트**:
- `progress`
- `card`
- `badge`
- `button`

**주요 코드**:
```typescript
'use client';

import { useSSE } from '@/lib/hooks/use-sse';
import { ScrapeProgressEvent } from '@/lib/types';
import { Progress } from '@/components/ui/progress';

export default function ScrapeProgressPage({ params }: { params: { jobId: string } }) {
  const { events, isConnected } = useSSE<ScrapeProgressEvent>(
    `/api/scrape/stream/${params.jobId}`
  );

  const latestEvent = events[events.length - 1];
  const progress = latestEvent ? (latestEvent.processed / latestEvent.total) * 100 : 0;

  return (
    <div className="container mx-auto py-8">
      <h1>Scraping Progress</h1>
      <Progress value={progress} />
      <p>{latestEvent?.processed} / {latestEvent?.total}</p>
      {latestEvent?.current_url && <p>Processing: {latestEvent.current_url}</p>}
    </div>
  );
}
```

### 3.3 `/articles` - 기사 목록

**기능**:
- 기사 목록 테이블 (정렬, 페이지네이션)
- 국가/상태/날짜 필터
- 검색 (제목, 소스)
- 개별 기사 상세 보기
- 번역/삭제 액션

**필요한 shadcn/ui 컴포넌트**:
- `table`
- `select`
- `input`
- `badge`
- `button`
- `dropdown-menu`

### 3.4 `/translate` - 번역 페이지

**기능**:
- `status='scraped'` 기사만 표시
- 체크박스로 다중 선택
- 번역 시작 버튼
- `/translate/[jobId]`로 리다이렉트

### 3.5 `/publish` - 발행 페이지

**기능**:
- `status='translated'` 기사만 표시
- 매거진 제목 입력
- 기사 선택 및 순서 조정
- HTML 생성 미리보기
- 이메일 발송

---

## 4. 구현 순서

### Phase 1: 기본 설정 (1-2시간)
1. [x] shadcn/ui 컴포넌트 설치
   ```bash
   npx shadcn@latest add button card table badge progress input select
   npx shadcn@latest add alert dropdown-menu dialog toast
   ```

2. [x] `lib/types.ts` 작성
3. [x] `lib/api-client.ts` 작성
4. [x] `lib/hooks/use-sse.ts` 작성
5. [x] `.env.local` 설정
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

### Phase 2: 스크랩 UI (2-3시간)
6. [x] `components/scrape/excel-uploader.tsx` 구현
7. [x] `app/scrape/page.tsx` 구현
8. [x] `components/scrape/scrape-progress.tsx` 구현
9. [x] `app/scrape/[jobId]/page.tsx` 구현
10. [ ] 실제 Excel 파일로 테스트

### Phase 3: 기사 관리 UI (3-4시간)
11. [x] `components/articles/article-table.tsx` 구현 (app/articles/page.tsx에 통합)
12. [x] `components/articles/article-filters.tsx` 구현 (app/articles/page.tsx에 통합)
13. [x] `app/articles/page.tsx` 구현
14. [x] `components/articles/article-detail.tsx` 구현 (app/articles/[id]/page.tsx에 통합)
15. [x] `app/articles/[id]/page.tsx` 구현
16. [x] `components/articles/attachment-list.tsx` 구현 (app/articles/[id]/page.tsx에 통합)

### Phase 4: 번역 UI (2시간)
17. [x] `components/translate/article-selector.tsx` 구현
18. [x] `app/translate/page.tsx` 구현
19. [x] `components/translate/translate-progress.tsx` 구현
20. [x] `app/translate/[jobId]/page.tsx` 구현

### Phase 5: 발행 UI (2-3시간)
21. [x] `components/publish/article-picker.tsx` 구현
22. [x] `components/publish/magazine-editor.tsx` 구현 (app/publish/page.tsx에 통합)
23. [x] `app/publish/page.tsx` 구현
24. [x] `components/publish/email-form.tsx` 구현
25. [x] `app/publish/[id]/page.tsx` (미리보기) 구현
26. [x] `app/magazine/[id]/page.tsx` (공개 매거진 뷰어) 구현

### Phase 6: 통합 테스트 (1-2시간)
27. [ ] 전체 워크플로우 테스트 (스크랩 → 기사 → 번역 → 발행)
28. [ ] 에러 핸들링 개선
29. [ ] 로딩 상태 개선
30. [ ] 반응형 디자인 확인

---

## 5. shadcn/ui 컴포넌트 목록

### 우선순위 높음 (필수)
- [x] `button` - 모든 페이지에서 사용
- [x] `card` - 콘텐츠 그룹화
- [x] `table` - 기사 목록, URL 목록
- [x] `badge` - 상태 표시 (scraped, translated)
- [x] `progress` - 진행률 표시
- [x] `input` - 검색, 폼 입력
- [x] `select` - 필터 (국가, 상태)
- [x] `alert` - 에러/성공 메시지

### 우선순위 중간
- [x] `dropdown-menu` - 액션 메뉴 (수정/삭제)
- [x] `dialog` - 확인 다이얼로그
- [ ] `toast` - 알림 메시지 (선택사항)
- [x] `checkbox` - 다중 선택
- [x] `textarea` - 기사 편집
- [x] `label` - 폼 레이블

### 우선순위 낮음 (선택)
- [x] `tabs` - 뷰 전환
- [ ] `pagination` - 페이지네이션 (선택사항)
- [x] `skeleton` - 로딩 스켈레톤
- [x] `separator` - 구분선
- [x] `scroll-area` - 스크롤 영역
- [x] `popover` - 팝오버 (날짜 선택)
- [x] `calendar` - 캘린더 (날짜 범위 선택)

---

## 6. 테스트 시나리오

### 시나리오 1: Excel 업로드 및 스크랩
1. `/scrape` 페이지 접속
2. `legacy/[1단계]_20250915_policysearching.xlsx` 업로드
3. 업로드 성공 확인 (15개 URL)
4. "Start Scraping" 버튼 클릭
5. `/scrape/[jobId]` 페이지로 리다이렉트
6. 실시간 진행률 확인 (SSE)
7. 완료 후 `/articles` 페이지로 이동

### 시나리오 2: 기사 조회 및 필터
1. `/articles` 페이지 접속
2. 15개 기사 목록 확인
3. 국가 필터 적용 (US, UK, JP, KR)
4. 검색어 입력 (예: "FCC")
5. 개별 기사 클릭하여 상세 보기
6. 첨부파일 다운로드

### 시나리오 3: 번역
1. `/translate` 페이지 접속
2. `status='scraped'` 기사만 표시 확인
3. 번역할 기사 선택 (체크박스)
4. "Start Translation" 버튼 클릭
5. 번역 진행 상황 확인
6. 완료 후 `/articles`에서 `status='translated'` 확인

### 시나리오 4: 매거진 발행
1. `/publish` 페이지 접속
2. 발행할 기사 선택
3. 매거진 제목 입력
4. HTML 생성 클릭
5. 미리보기 확인
6. 이메일 발송 (선택)

---

## 7. 개발 팁

### API 통신 에러 핸들링
```typescript
// components/error-boundary.tsx
'use client';

import { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert variant="destructive">
      <AlertDescription>
        Something went wrong: {error.message}
      </AlertDescription>
    </Alert>
  );
}
```

### 로딩 상태 관리
```typescript
// app/articles/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

### SSE 연결 상태 표시
```typescript
{isConnected ? (
  <Badge variant="success">Connected</Badge>
) : (
  <Badge variant="secondary">Disconnected</Badge>
)}
```

---

## 8. 완료 조건

✅ UI 구현 완료 기준:
1. [x] 4개 주요 페이지 모두 구현 (/scrape, /articles, /translate, /publish)
2. [x] SSE를 통한 실시간 진행률 표시 구현
3. [ ] Excel 업로드 → 스크랩 → 기사 조회 → 번역 → 발행 전체 플로우 테스트 성공
4. [x] 에러 핸들링 및 로딩 상태 적용
5. [x] shadcn/ui 컴포넌트로 일관된 디자인 적용
6. [x] TypeScript 타입 안정성 확보
7. [ ] 반응형 디자인 확인 및 개선

---

## 9. 참고 자료

- Next.js 15 App Router: https://nextjs.org/docs/app
- shadcn/ui 컴포넌트: https://ui.shadcn.com/docs/components
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Tailwind CSS v4: https://tailwindcss.com/docs

---

## 다음 단계

UI 구현 완료 후:
1. E2E 테스트 작성 (Playwright)
2. 성능 최적화 (React Query, SWR)
3. 배포 준비 (Vercel, Docker)
4. 사용자 매뉴얼 작성
