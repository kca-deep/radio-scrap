# Radio Policy Magazine - Implementation Plan

## Legacy 프로세스 분석

### 1단계: 데이터 수집
- Excel 파일 입력: `YYYYMMDD_policysearching.xlsx`
- 컬럼: title, date, link, content, source

### 2단계: GPT 리라이팅
- OpenAI API 호출 (gpt-4o / gpt-5)
- 영문 기사 → 한글 제목/본문 변환
- 최근 N일 필터링
- 월간 종합 요약 생성
- 출력: `YYYYMMDD_HHMMSS_rewritten.xlsx` (Articles, Recent, Monthly 시트)

### 3단계: HTML 시각화
- Jinja2 템플릿 렌더링
- 국가별 필터링 (KR/US/UK/JP)
- 출력: `YYYYMMDD_HHMMSS_mag.html`

---

## Next.js + FastAPI 아키텍처

### 기술 스택
- Frontend: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- Backend: FastAPI, Python 3.11+
- API: OpenAI GPT-4o/GPT-5
- Data: pandas, openpyxl
- State: React Query, Zustand
- Storage: 로컬 파일 시스템 (MVP), SQLite (메타데이터)

---

## 디렉토리 구조

```
/app (Next.js)
  /api
    /[...fastapi]          # FastAPI 프록시
  /upload                  # 파일 업로드 페이지
  /process/[jobId]         # 처리 상태 페이지
  /magazine/[jobId]        # 매거진 뷰어
  /components
    /ui                    # shadcn/ui 컴포넌트
    FileUploader.tsx
    ArticleCard.tsx
    ProcessingStatus.tsx
    CountryFilter.tsx
    SummarySection.tsx
    DateRangeFilter.tsx
  /lib
    api-client.ts          # FastAPI 호출 함수
    types.ts               # TypeScript 타입 정의

/backend
  /app
    main.py                # FastAPI 앱 진입점
    /api
      /routes
        upload.py          # POST /upload
        process.py         # POST /process, GET /status/{job_id}
        articles.py        # GET /articles, GET /summary/{job_id}
        export.py          # GET /export/{job_id}
      /services
        excel_parser.py    # Excel 파싱
        gpt_rewriter.py    # GPT 리라이팅
        summarizer.py      # 월간 요약 생성
        country_mapper.py  # 국가별 그룹핑
        job_manager.py     # 작업 상태 추적
        export_service.py  # Excel 출력
      /models
        article.py         # Pydantic 모델
        job.py             # Job 상태 모델
      /utils
        openai_client.py   # OpenAI API 래퍼
    /storage
      /uploads             # 업로드 파일
      /results             # 처리 결과
```

---

## API 엔드포인트

### FastAPI Backend

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/upload` | Excel 업로드, 파싱, 검증 → job_id 반환 |
| POST | `/api/process` | GPT 리라이팅 시작 (백그라운드) |
| GET | `/api/status/{job_id}` | 처리 진행 상태 (SSE) |
| GET | `/api/articles` | 처리된 기사 목록 (필터: country, date_from, date_to) |
| GET | `/api/summary/{job_id}` | 월간 종합 요약 |
| GET | `/api/export/{job_id}` | Excel 다운로드 |

### Next.js Frontend

| Route | 페이지 |
|-------|--------|
| `/upload` | 파일 업로드 UI |
| `/process/[jobId]` | 처리 진행 상태 (진행률, 로그) |
| `/magazine/[jobId]` | 매거진 뷰어 (필터링, 카드 뷰) |

---

## 핵심 모듈 매핑 (Legacy → FastAPI)

### 1. excel_parser.py
```
load_df() → parse_excel_articles()
- 컬럼 검증: title, date, link, content, source
- 날짜 파싱: pd.to_datetime()
- 반환: List[Article]
```

### 2. gpt_rewriter.py
```
gpt_rewrite() → rewrite_article()
- SYSTEM_PROMPT 유지 (한글 리라이팅 규칙)
- chat_create() 래퍼 (gpt-4o, gpt-5 호환)
- 비동기 처리: async def + httpx.AsyncClient
- parse_block() → 제목/본문 추출
```

### 3. summarizer.py
```
policy_summary_all() → generate_monthly_summary()
- filter_recent_articles(days=45)
- 월간 요약 프롬프트 (국가별 1-2개 핵심 정책)
- 반환: str (한 문단)
```

### 4. country_mapper.py
```
to_group_code() → map_country_code()
- source 필드 → KR/US/UK/JP 매핑
- FCC/NTIA → US
- Ofcom → UK
- 総務省/MIC → JP
- 과기정통부 → KR
```

### 5. job_manager.py (신규)
```
jobs: Dict[str, JobStatus] = {}
- create_job() → UUID 생성
- update_progress(job_id, progress, message)
- get_status(job_id) → JobStatus
- SSE 이벤트 발행
```

### 6. export_service.py (신규)
```
generate_excel(articles, summary)
- Articles 시트: 전체 기사
- Recent 시트: 최근 N일
- Monthly 시트: 종합 요약
- openpyxl 서식 적용 (줄바꿈, 열너비)
```

---

## 데이터 모델

### Article (Pydantic)
```python
class Article(BaseModel):
    id: str
    title: str
    date: date
    link: str
    content: str
    source: str
    source_raw: str
    title_ko: str | None
    content_ko: str | None
    country_code: str | None  # KR/US/UK/JP
```

### JobStatus
```python
class JobStatus(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    progress: int  # 0-100
    total_articles: int
    processed_articles: int
    message: str
    created_at: datetime
    updated_at: datetime
```

---

## 처리 플로우

### 1. 파일 업로드
```
User → POST /api/upload (Excel)
  → parse_excel_articles()
  → save to /storage/uploads/{job_id}.xlsx
  → return {job_id, total_articles}
```

### 2. GPT 리라이팅 (비동기)
```
User → POST /api/process {job_id}
  → BackgroundTasks.add_task(process_articles, job_id)
  → for article in articles:
      - rewrite_article(article)
      - update_progress(job_id, i/total * 100)
      - sleep(1)  # rate limit
  → generate_monthly_summary()
  → save to /storage/results/{job_id}.json
  → update_status("completed")
```

### 3. 진행 상태 모니터링
```
User → GET /api/status/{job_id} (SSE)
  → yield job_status every 1s
```

### 4. 매거진 뷰어
```
User → GET /api/articles?job_id={job_id}&country=KR&date_from=2025-09-01
  → load from /storage/results/{job_id}.json
  → filter by country, date
  → return List[Article]
```

### 5. Excel 다운로드
```
User → GET /api/export/{job_id}
  → generate_excel()
  → return FileResponse
```

---

## 프론트엔드 컴포넌트

### 1. FileUploader
- drag & drop 업로드
- Excel 검증 (.xlsx)
- shadcn/ui: button, input, card

### 2. ProcessingStatus
- 진행률 표시 (progress bar)
- 실시간 로그 (SSE 연결)
- shadcn/ui: progress, badge, card

### 3. ArticleCard
- 제목, 날짜, 국가, 본문 요약
- 원문 링크
- shadcn/ui: card, typography

### 4. CountryFilter
- All / 한국 / 미국 / 영국 / 일본
- 탭 또는 사이드바
- shadcn/ui: tabs or sidebar

### 5. SummarySection
- 월간 종합 요약 (최상단)
- shadcn/ui: alert, card

### 6. DateRangeFilter
- 시작일, 종료일 선택
- shadcn/ui: date-picker

---

## 상태 관리

### React Query
```typescript
useQuery(['articles', jobId, filters])
useQuery(['summary', jobId])
useMutation(uploadFile)
useMutation(startProcessing)
```

### Zustand (필터 상태)
```typescript
interface FilterStore {
  country: string | null
  dateFrom: Date | null
  dateTo: Date | null
  setCountry: (country: string | null) => void
  setDateRange: (from: Date | null, to: Date | null) => void
}
```

### SSE (실시간 진행 상태)
```typescript
useEffect(() => {
  const eventSource = new EventSource(`/api/status/${jobId}`)
  eventSource.onmessage = (e) => {
    const status = JSON.parse(e.data)
    setProgress(status.progress)
  }
}, [jobId])
```

---

## 환경 설정

### .env (Next.js)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### .env (FastAPI)
```
OPENAI_API_KEY=sk-...
UPLOAD_DIR=/app/storage/uploads
RESULT_DIR=/app/storage/results
RECENT_DAYS=45
```

### CORS 설정 (FastAPI)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 개발 순서

1. Backend 초기 설정
   - FastAPI 프로젝트 구조 생성
   - OpenAI 클라이언트 래퍼
   - Excel 파싱 모듈

2. 핵심 비즈니스 로직
   - gpt_rewriter.py (legacy 이식)
   - summarizer.py (legacy 이식)
   - country_mapper.py

3. API 엔드포인트
   - upload, process, status (SSE)
   - articles, summary, export

4. Frontend 기본 구조
   - shadcn/ui 설정
   - 페이지 라우팅
   - API 클라이언트

5. UI 컴포넌트
   - FileUploader
   - ProcessingStatus (SSE 연결)
   - ArticleCard, CountryFilter

6. 매거진 뷰어
   - 필터링 로직
   - 페이지네이션
   - Excel 다운로드

7. 테스트 및 최적화
   - GPT API 에러 핸들링
   - rate limit 처리
   - 대용량 파일 처리

---

## 배포 고려사항

- Next.js: Vercel (환경변수 설정)
- FastAPI: Docker + Cloud Run / Railway
- 파일 저장소: S3 / GCS (로컬 파일 시스템 대체)
- 작업 큐: Redis + Celery (스케일링 시)
- DB: PostgreSQL (메타데이터 영속화)
