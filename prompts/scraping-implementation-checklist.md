# 스크랩 기능 구현 체크리스트

## 개요
Phase 1에서 구축한 Backend 기본 구조 위에 Firecrawl API 기반 웹 스크랩 시스템을 구현합니다.
URL 목록 업로드 → Firecrawl 스크랩 → 첨부파일 다운로드 → SQLite 저장 → SSE 진행 상태 전송

---

## 1. 환경 설정

### 1.1 Firecrawl API 설정
- [x] `.env`에 Firecrawl API 키 확인
  ```
  FIRECRAWL_API_KEY=fc-...
  ```
- [x] `config.py`에 Firecrawl 설정 확인

### 1.2 Storage 디렉토리 생성
- [x] `backend/storage/attachments` 디렉토리 생성
  ```bash
  mkdir -p backend/storage/attachments
  ```

---

## 2. Firecrawl Service 구현

### 2.1 `backend/app/services/firecrawl_service.py`
- [x] Firecrawl API 클라이언트 초기화
- [x] `async def scrape_url(url: str) -> dict`
  - Firecrawl API 호출 (`/v1/scrape` 엔드포인트)
  - 반환: `{markdown: str, metadata: dict, links: list}`
  - 에러 핸들링 (401, 429, 500)
  - 재시도 로직 (exponential backoff)
- [x] `async def extract_attachment_links(html: str, base_url: str) -> list[dict]`
  - HTML에서 첨부파일 링크 추출 (PDF, DOC, XLS 등)
  - 절대 URL로 변환
- [x] `async def download_attachment(url: str, save_dir: str) -> dict`
  - 첨부파일 다운로드
  - 파일명 sanitize (특수문자 제거)
  - 반환: `{filename: str, file_path: str, file_url: str}`
- [x] Rate limiting 처리 (분당 요청 수 제한)

---

## 3. Country Mapper Service

### 3.1 `backend/app/services/country_mapper.py`
- [x] Legacy `to_group_code()` 로직 이식
- [x] `def map_country_code(source: str) -> str`
  - FCC, NTIA → US
  - Ofcom → UK
  - 総務省, 総務省 → JP
  - 과기정통부, 방통위 → KR
  - 기타 → None
- [x] 대소문자 및 공백 처리
- [ ] 테스트 케이스 추가

---

## 4. Scraper Service (핵심 로직)

### 4.1 `backend/app/services/scraper.py`
- [x] `async def process_url_list(job_id: str, urls: list[dict])`
  ```python
  async def process_url_list(job_id: str, urls: list[dict]):
      """
      Args:
          job_id: ScrapeJob ID
          urls: [{title, date, link, source}, ...]
      """
      total = len(urls)
      for idx, url_data in enumerate(urls, 1):
          try:
              # 1. Firecrawl로 스크랩
              content = await firecrawl_service.scrape_url(url_data['link'])

              # 2. 국가 코드 매핑
              country_code = country_mapper.map_country_code(url_data['source'])

              # 3. Article 생성 및 저장
              article = Article(
                  id=generate_id(),
                  url=url_data['link'],
                  title=url_data['title'],
                  content=content['markdown'],
                  source=url_data['source'],
                  country_code=country_code,
                  published_date=url_data['date'],
                  status='scraped',
                  scraped_at=datetime.utcnow()
              )
              article_id = await db_service.save_article(article)

              # 4. 첨부파일 추출 및 다운로드
              attachment_links = await firecrawl_service.extract_attachment_links(
                  content.get('html', ''),
                  url_data['link']
              )

              attachments = []
              for link in attachment_links:
                  att = await firecrawl_service.download_attachment(
                      link['url'],
                      settings.ATTACHMENT_DIR
                  )
                  attachments.append(att)

              # 5. 첨부파일 저장
              if attachments:
                  await db_service.save_attachments(article_id, attachments)

              # 6. 진행 상태 업데이트
              await update_scrape_job_progress(job_id, idx, total)
              await send_sse_event(job_id, {
                  'processed': idx,
                  'total': total,
                  'current_url': url_data['link'],
                  'article_id': article_id
              })

          except Exception as e:
              logger.error(f"Failed to scrape {url_data['link']}: {e}")
              await send_sse_event(job_id, {
                  'processed': idx,
                  'total': total,
                  'error': str(e),
                  'url': url_data['link']
              })

      # 완료
      await update_scrape_job_status(job_id, 'completed')
      await send_sse_event(job_id, {'status': 'completed'})
  ```

---

## 5. Database Service 확장

### 5.1 `backend/app/services/db_service.py`
- [x] `async def save_article(article: Article) -> str`
  - INSERT INTO articles
  - 반환: article_id
- [x] `async def save_attachments(article_id: str, attachments: list[dict])`
  - INSERT INTO attachments
  - Bulk insert 최적화
- [x] `async def create_scrape_job(total_urls: int) -> str`
  - INSERT INTO scrape_jobs
  - 반환: job_id
- [x] `async def update_scrape_job_progress(job_id: str, processed: int, total: int)`
  - UPDATE scrape_jobs SET processed_urls = ?
- [x] `async def update_scrape_job_status(job_id: str, status: str)`
  - UPDATE scrape_jobs SET status = ?
- [x] `async def get_scrape_job(job_id: str) -> ScrapeJob`
  - SELECT FROM scrape_jobs

---

## 6. SSE Event Store

### 6.1 In-memory Event Queue
- [x] `backend/app/services/sse_service.py` 생성
  ```python
  from collections import defaultdict, deque

  # job_id -> deque of events
  event_queues: dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

  async def send_sse_event(job_id: str, event: dict):
      """SSE 이벤트 큐에 추가"""
      event_queues[job_id].append(event)

  async def get_sse_events(job_id: str) -> list[dict]:
      """SSE 이벤트 조회 및 소비"""
      if job_id in event_queues:
          events = list(event_queues[job_id])
          event_queues[job_id].clear()
          return events
      return []
  ```

---

## 7. API Routes 구현

### 7.1 `backend/app/api/routes/scrape.py`
- [x] `POST /api/scrape/upload`
  ```python
  @router.post("/upload")
  async def upload_url_list(file: UploadFile):
      """
      Excel 파일 업로드 및 파싱
      Returns: {job_id, total_urls}
      """
      # 1. Excel 파일 파싱 (pandas/openpyxl)
      # 2. URL 목록 추출 및 검증
      # 3. ScrapeJob 생성
      # 4. 반환
  ```
- [x] `POST /api/scrape/start`
  ```python
  @router.post("/start")
  async def start_scraping(
      request: ScrapeStartRequest,
      background_tasks: BackgroundTasks
  ):
      """
      스크랩 작업 시작 (백그라운드)
      Request: {job_id}
      Returns: {status: 'started'}
      """
      # 1. job_id 검증
      # 2. URL 목록 조회
      # 3. BackgroundTasks.add_task(scraper.process_url_list)
      # 4. 반환
  ```
- [x] `GET /api/scrape/status/{job_id}` (REST endpoint)
- [x] `GET /api/scrape/stream/{job_id}` (SSE stream)
  ```python
  @router.get("/status/{job_id}")
  async def get_scrape_status(job_id: str):
      """
      SSE 스트림으로 진행 상태 전송
      """
      async def event_generator():
          while True:
              events = await sse_service.get_sse_events(job_id)
              for event in events:
                  yield f"data: {json.dumps(event)}\n\n"
                  if event.get('status') == 'completed':
                      return
              await asyncio.sleep(1)

      return StreamingResponse(
          event_generator(),
          media_type="text/event-stream"
      )
  ```

### 7.2 Request/Response Models
- [x] `ScrapeStartRequest(BaseModel)`
  - job_id: str
- [x] `ScrapeJobStatus(BaseModel)`
  - job_id, status, progress, processed_urls, total_urls
- [x] Job store service created for temporary URL storage

---

## 8. Excel 파싱 유틸리티

### 8.1 `backend/app/utils/excel_parser.py`
- [x] `def parse_url_excel(file_path: str) -> list[dict]`
  ```python
  def parse_url_excel(file_path: str) -> list[dict]:
      """
      Excel 파일에서 URL 목록 파싱
      Expected columns: title, date, link, source
      Returns: [{title, date, link, source}, ...]
      """
      df = pd.read_excel(file_path)

      # 컬럼 검증
      required_cols = {'title', 'date', 'link', 'source'}
      if not required_cols.issubset(df.columns):
          raise ValueError(f"Missing columns: {required_cols - set(df.columns)}")

      # 데이터 변환
      urls = []
      for _, row in df.iterrows():
          urls.append({
              'title': str(row['title']),
              'date': row['date'].date() if pd.notna(row['date']) else None,
              'link': str(row['link']),
              'source': str(row['source'])
          })

      return urls
  ```
- [x] URL 유효성 검증 (httpx URL validation)

---

## 9. Database Schema 적용

### 9.1 Alembic Migration
- [ ] `scrape_jobs` 테이블 생성 마이그레이션
  ```bash
  cd backend
  alembic revision --autogenerate -m "Add scrape_jobs table"
  alembic upgrade head
  ```

---

## 10. 에러 핸들링

### 10.1 Firecrawl API 에러
- [x] 401 Unauthorized → 즉시 실패 (API 키 오류)
- [x] 429 Rate Limit → 재시도 (Retry-After 헤더 확인)
- [x] 500 Server Error → 재시도 (최대 3회)
- [x] Timeout → 재시도 (최대 3회)
- [x] Implemented with tenacity library (exponential backoff)

### 10.2 첨부파일 다운로드 에러
- [x] 404 Not Found → 로그만 남기고 계속 진행
- [x] 403 Forbidden → 로그만 남기고 계속 진행
- [x] Disk full → HTTPStatusError 발생 및 로깅
- [x] Using asyncio.gather with return_exceptions=True

---

## 11. 테스트

### 11.1 Unit Tests
- [ ] `tests/test_firecrawl_service.py`
  - [ ] `test_scrape_url()` - 정상 케이스
  - [ ] `test_scrape_url_retry()` - 재시도 로직
  - [ ] `test_extract_attachment_links()` - 링크 추출
  - [ ] `test_download_attachment()` - 파일 다운로드
- [ ] `tests/test_country_mapper.py`
  - [ ] `test_map_country_code()` - 각 국가 매핑
  - [ ] `test_map_country_code_unknown()` - 알 수 없는 소스
- [ ] `tests/test_excel_parser.py`
  - [ ] `test_parse_url_excel()` - 정상 파일
  - [ ] `test_parse_url_excel_invalid()` - 잘못된 컬럼

### 11.2 Integration Tests
- [ ] `tests/test_scrape_endpoints.py`
  - [ ] `test_upload_excel()` - Excel 업로드
  - [ ] `test_start_scraping()` - 스크랩 시작
  - [ ] `test_scrape_status_sse()` - SSE 스트림

### 11.3 Manual Testing
- [ ] Postman/Insomnia로 API 테스트
- [ ] 실제 Excel 파일 업로드 (3-5개 URL)
- [ ] SSE 스트림 확인 (EventSource 브라우저 테스트)
- [ ] 첨부파일 다운로드 확인

---

## 12. 프론트엔드 연동 준비

### 12.1 TypeScript 타입 정의
- [ ] `lib/types.ts`에 추가:
  ```typescript
  export interface ScrapeJob {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
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
    error?: string;
    status?: 'completed' | 'failed';
  }
  ```

### 12.2 API 클라이언트
- [ ] `lib/api-client.ts`에 함수 추가:
  ```typescript
  export async function uploadUrlList(
    file: File
  ): Promise<ScrapeUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/api/scrape/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Failed to upload file');
    return res.json();
  }

  export async function startScraping(
    jobId: string
  ): Promise<void> {
    const res = await fetch(`${API_URL}/api/scrape/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId })
    });
    if (!res.ok) throw new Error('Failed to start scraping');
  }

  export function subscribeScrapeProgress(
    jobId: string,
    onEvent: (event: ScrapeProgressEvent) => void
  ): EventSource {
    const eventSource = new EventSource(
      `${API_URL}/api/scrape/status/${jobId}`
    );
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onEvent(data);
    };
    return eventSource;
  }
  ```

---

## 13. 성능 최적화

### 13.1 동시 처리
- [x] `asyncio.Semaphore`로 동시 스크랩 수 제어 (최대 3개)
- [x] 첨부파일 다운로드 병렬 처리 (asyncio.gather)

### 13.2 Rate Limiting
- [x] Firecrawl API rate limit 준수 (Semaphore)
- [x] 백오프 전략 (exponential backoff with tenacity)

### 13.3 메모리 관리
- [x] Excel 파일 임시 저장 후 즉시 삭제
- [x] SSE 이벤트 큐 크기 제한 (maxlen=100)

---

## 14. 로깅 및 모니터링

### 14.1 로깅
- [x] 각 URL 스크랩 시작/완료 로그
- [x] 에러 로그 (스택 트레이스 포함, exc_info=True)
- [x] 진행률 로그 (매 URL마다, SSE로 전송)

### 14.2 메트릭
- [ ] 총 스크랩 시간
- [ ] URL당 평균 스크랩 시간
- [ ] 성공/실패 URL 수
- [ ] 다운로드된 첨부파일 수 및 총 크기

---

## 15. 문서화

### 15.1 API 문서
- [x] FastAPI `/docs` 엔드포인트 확인 (http://localhost:8000/docs)
- [x] Request/Response 예시 추가 (docstrings)
- [x] 에러 코드 및 메시지 문서화 (HTTPException)

### 15.2 코드 주석
- [x] 각 서비스 함수 docstring (Google style)
- [x] 복잡한 로직 inline 주석

---

## 완료 조건

✅ 스크랩 기능 완료 기준:
1. [ ] 모든 체크리스트 항목 완료
2. [ ] Unit tests 통과율 90% 이상
3. [ ] 실제 URL 10개 스크랩 성공
4. [ ] SSE 스트림이 정상 작동 (실시간 진행률 확인)
5. [ ] 첨부파일 자동 다운로드 동작 확인
6. [ ] DB에 `scraped` 상태 기사가 올바르게 저장됨
7. [ ] 국가 코드 매핑이 정확히 동작

---

## 다음 단계: 번역 기능

스크랩 기능 완료 후:
- OpenAI GPT-4o 번역 서비스
- 배치 번역 처리
- SSE 진행 상태
- 번역 품질 검증

---

## 참고 자료

- Firecrawl API 문서: https://docs.firecrawl.dev
- FastAPI BackgroundTasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
- SSE 가이드: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- pandas Excel 읽기: https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html
