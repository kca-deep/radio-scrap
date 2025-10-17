# Radio Policy Magazine - Implementation Plan (Revised)

## 워크플로우

### 1단계: 웹 스크랩
- URL 목록 Excel 업로드 (title, date, link, source)
- Firecrawl API로 각 URL 스크랩 (markdown + metadata)
- 첨부파일 자동 다운로드
- 원문 → SQLite 저장 (status: scraped)

### 2단계: GPT 번역
- 스크랩된 기사 선택
- GPT API로 영문 → 한글 번역 (제목/본문)
- 번역문 → SQLite 업데이트 (status: translated)

### 3단계: 퍼블리싱
- 번역 완료 기사 선택
- HTML 매거진 생성 (Jinja2 템플릿)
- 이메일 발송 또는 다운로드

---

## 기술 스택

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- Backend: FastAPI, Python 3.11+
- API: Firecrawl, OpenAI GPT-4o
- Database: SQLite
- Data: pandas, openpyxl
- Email: SMTP / SendGrid
- State: React Query, Zustand

---

## 디렉토리 구조

```
/app
  /scrape              # 스크랩 관리
  /articles            # 기사 관리 (테이블 뷰)
  /translate/[jobId]   # 번역 진행 상태
  /publish             # 퍼블리싱 (선택/미리보기/발송)
  /magazine/[id]       # 매거진 뷰어
  /components
    /ui                # shadcn/ui
    URLUploader.tsx
    ScrapeStatus.tsx
    ArticleTable.tsx
    TranslateStatus.tsx
    PublishForm.tsx
    MagazineViewer.tsx
  /lib
    api-client.ts
    types.ts

/backend
  /app
    main.py
    /api/routes
      scrape.py        # POST /scrape/upload, /scrape/start, GET /scrape/status/{job_id}
      articles.py      # GET /articles, GET /articles/{id}, PATCH /articles/{id}
      attachments.py   # GET /attachments/{id}/download
      translate.py     # POST /translate/start, GET /translate/status/{job_id}
      publish.py       # POST /publish/html, /publish/email, GET /publish/{id}
    /services
      firecrawl_service.py
      scraper.py
      translator.py
      db_service.py
      html_generator.py
      email_service.py
      country_mapper.py
    /models
      article.py
      scrape_job.py
      publication.py
    /templates
      magazine.html    # Jinja2 템플릿
    database.db        # SQLite
    /storage
      /attachments     # 다운로드된 첨부파일
```

---

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/scrape/upload` | URL 목록 Excel 업로드 → job_id |
| POST | `/api/scrape/start` | Firecrawl 스크랩 시작 (백그라운드) |
| GET | `/api/scrape/status/{job_id}` | 스크랩 진행 상태 (SSE) |
| GET | `/api/articles` | 기사 목록 (필터: country, status, date) + attachments |
| GET | `/api/articles/{id}` | 기사 상세 + attachments |
| PATCH | `/api/articles/{id}` | 기사 수정 |
| GET | `/api/attachments/{id}/download` | 첨부파일 다운로드 |
| POST | `/api/translate/start` | 선택 기사들 번역 시작 |
| GET | `/api/translate/status/{job_id}` | 번역 진행 상태 (SSE) |
| POST | `/api/publish/html` | 선택 기사들 HTML 생성 → publication_id |
| POST | `/api/publish/email` | 이메일 발송 (recipients, publication_id) |
| GET | `/api/publish/{id}` | 퍼블리시된 매거진 HTML |

---

## 데이터베이스 스키마

### articles
```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  title_ko TEXT,
  content TEXT,
  content_ko TEXT,
  source TEXT,
  country_code TEXT,  -- KR/US/UK/JP
  published_date DATE,
  scraped_at TIMESTAMP,
  translated_at TIMESTAMP,
  status TEXT  -- scraped/translated
);
```

### attachments
```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT,
  filename TEXT,
  file_path TEXT,
  file_url TEXT,
  downloaded_at TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

### scrape_jobs
```sql
CREATE TABLE scrape_jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT,  -- pending/processing/completed/failed
  total_urls INTEGER,
  processed_urls INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### publications
```sql
CREATE TABLE publications (
  id TEXT PRIMARY KEY,
  title TEXT,
  article_ids TEXT,  -- JSON array
  html_path TEXT,
  created_at TIMESTAMP,
  sent_at TIMESTAMP
);
```

---

## 핵심 서비스

### 1. firecrawl_service.py
```python
async def scrape_url(url: str) -> dict:
    # Firecrawl API 호출
    # 반환: {markdown, metadata, links}

async def download_attachments(url: str, selectors: list) -> list:
    # 첨부파일 다운로드
    # 반환: [{filename, file_path, file_url}]
```

### 2. scraper.py
```python
async def process_url_list(job_id: str, urls: list):
    for url in urls:
        content = await firecrawl_service.scrape_url(url)
        attachments = await firecrawl_service.download_attachments(url)
        article = Article(url=url, content=content['markdown'], ...)
        db_service.save_article(article)
        db_service.save_attachments(article.id, attachments)
        update_job_progress(job_id)
```

### 3. translator.py
```python
async def translate_article(article: Article) -> Article:
    # legacy gpt_rewrite() 로직 이식
    # SYSTEM_PROMPT 유지
    title_ko, content_ko = await gpt_translate(article.title, article.content)
    article.title_ko = title_ko
    article.content_ko = content_ko
    article.status = "translated"
    return article
```

### 4. db_service.py
```python
def save_article(article: Article):
    # SQLite INSERT/UPDATE

def save_attachments(article_id: str, attachments: list[dict]):
    # INSERT INTO attachments

def get_articles(filters: dict) -> list[Article]:
    # SELECT articles with JOIN attachments
    # 각 Article 객체에 attachments 포함

def get_article_by_id(id: str) -> Article:
    # SELECT with attachments

def update_article(id: str, updates: dict):
    # UPDATE
```

### 5. html_generator.py
```python
def generate_magazine(article_ids: list[str]) -> str:
    articles = db_service.get_articles_by_ids(article_ids)
    # 각 article에 attachments 포함
    # legacy Jinja2 템플릿 재사용
    # 템플릿에서 첨부파일 링크 표시
    html = template.render(articles=articles, ...)
    publication_id = save_publication(html)
    return publication_id, html
```

### 6. email_service.py
```python
def send_html_email(recipients: list[str], html: str, subject: str):
    # SMTP 또는 SendGrid API
    msg = MIMEMultipart()
    msg.attach(MIMEText(html, 'html'))
    smtp.send(msg)
```

### 7. country_mapper.py
```python
def map_country_code(source: str) -> str:
    # legacy to_group_code() 로직 유지
    # FCC/NTIA → US, Ofcom → UK, 総務省 → JP, 과기정통부 → KR
```

---

## Pydantic 모델

### Attachment
```python
class Attachment(BaseModel):
    id: int
    article_id: str
    filename: str
    file_path: str
    file_url: str
    downloaded_at: datetime
```

### Article
```python
class Article(BaseModel):
    id: str
    url: str
    title: str
    title_ko: str | None
    content: str
    content_ko: str | None
    source: str
    country_code: str | None
    published_date: date | None
    scraped_at: datetime
    translated_at: datetime | None
    status: Literal["scraped", "translated"]
    attachments: list[Attachment] = []  # 첨부파일 목록
```

### ScrapeJob
```python
class ScrapeJob(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    total_urls: int
    processed_urls: int
    created_at: datetime
    updated_at: datetime
```

### Publication
```python
class Publication(BaseModel):
    id: str
    title: str
    article_ids: list[str]
    html_path: str
    created_at: datetime
    sent_at: datetime | None
```

---

## 처리 플로우

### 1. 스크랩
```
User → POST /api/scrape/upload (Excel with URLs)
  → Parse URLs → Save to scrape_jobs
  → return {job_id, total_urls}

User → POST /api/scrape/start {job_id}
  → BackgroundTasks.add_task(scraper.process_url_list)
  → for each URL:
      - Firecrawl scrape
      - Download attachments
      - Save to articles (status: scraped)
      - Update scrape_job progress
  → Send SSE events
```

### 2. 번역
```
User → POST /api/translate/start {article_ids}
  → BackgroundTasks.add_task(translate_articles)
  → for each article:
      - translator.translate_article()
      - db_service.update_article(status: translated)
      - Update progress
  → Send SSE events
```

### 3. 퍼블리싱
```
User → POST /api/publish/html {article_ids, title}
  → db_service.get_articles_by_ids(article_ids)  # attachments 포함
  → html_generator.generate_magazine()
  → 템플릿에서 각 기사의 첨부파일 링크 렌더링
  → Save to publications
  → return {publication_id, html}

User → POST /api/publish/email {publication_id, recipients, subject}
  → email_service.send_html_email()
  → Update publications.sent_at

User → GET /api/attachments/{id}/download
  → FileResponse(file_path)
```

---

## 프론트엔드 페이지

### /scrape
- URLUploader: Excel 업로드
- ScrapeStatus: 진행률, 성공/실패 로그 (SSE)
- shadcn/ui: button, card, progress, badge

### /articles
- ArticleTable: 제목, 날짜, 국가, 상태, 첨부파일 수 컬럼
- 필터: 국가, 번역 상태, 날짜 범위
- 일괄 선택 → "번역 시작" 버튼
- 개별 편집 버튼 → 모달 (첨부파일 목록 표시)
- shadcn/ui: table, checkbox, dialog, select, badge

### /translate/[jobId]
- TranslateStatus: 진행률, 현재 번역 중인 기사
- shadcn/ui: progress, card

### /publish
- 번역 완료 기사 목록 (체크박스)
- HTML 미리보기 버튼
- 이메일 설정: 수신자, 제목
- 다운로드 / 발송 버튼
- shadcn/ui: checkbox, input, textarea, button

### /magazine/[id]
- MagazineViewer: 생성된 HTML 표시
- 각 기사마다 첨부파일 링크 표시
- 첨부파일 다운로드 버튼
- 국가별 필터 탭
- shadcn/ui: tabs, card, button, link

---

## 환경 설정

### .env (Next.js)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### .env (FastAPI)
```
FIRECRAWL_API_KEY=fc-...
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./database.db
ATTACHMENT_DIR=./storage/attachments
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

---

## 개발 순서

1. **Backend 기본 구조**
   - FastAPI 프로젝트 생성
   - SQLite 스키마 생성
   - Pydantic 모델

2. **스크랩 기능**
   - Firecrawl API 통합
   - URL 파싱 및 DB 저장
   - 첨부파일 다운로드
   - SSE 진행 상태

3. **번역 기능**
   - legacy gpt_rewriter 이식
   - 비동기 처리
   - DB 업데이트

4. **퍼블리싱 기능**
   - HTML 생성 (Jinja2)
   - 이메일 발송 (SMTP)

5. **Frontend 기본 구조**
   - 페이지 라우팅
   - API 클라이언트
   - shadcn/ui 컴포넌트

6. **UI 구현**
   - URLUploader, ScrapeStatus
   - ArticleTable (필터링, 편집)
   - PublishForm, MagazineViewer

7. **테스트 & 최적화**
   - Firecrawl rate limit 처리
   - GPT API 에러 핸들링
   - 대용량 스크랩 처리

---

## 배포

- Next.js: Vercel
- FastAPI: Docker + Cloud Run / Railway
- SQLite: 볼륨 마운트 또는 PostgreSQL 마이그레이션
- 첨부파일: S3 / GCS
