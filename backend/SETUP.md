# Backend 서버 실행 가이드

## 사전 요구사항

- Python 3.11 이상
- pip (Python 패키지 관리자)

## 설치 및 실행 단계

### 1. Python 환경 확인

```bash
python --version
# 또는
python3 --version
```

Python 3.11 이상이어야 합니다.

### 2. 가상환경 생성 (권장)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. 의존성 설치

```bash
cd backend
pip install -r requirements.txt
```

설치되는 패키지:
- FastAPI 0.115.13
- Uvicorn (ASGI 서버)
- SQLAlchemy 2.0.36 (async)
- Pydantic 2.10.6
- 그 외 23개 패키지

### 4. 환경변수 설정

`.env` 파일이 이미 생성되어 있습니다. 실제 API 키를 입력하세요:

```bash
# .env 파일 편집
FIRECRAWL_API_KEY=your-actual-firecrawl-key
OPENAI_API_KEY=your-actual-openai-key
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
```

### 5. 서버 실행

#### 방법 1: Uvicorn 직접 실행 (권장)

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 방법 2: Python 스크립트 실행

```bash
cd backend
python -m app.main
```

#### 방법 3: 직접 실행

```bash
cd backend
python app/main.py
```

### 6. 서버 접속 확인

서버가 시작되면 다음 URL로 접속하세요:

- **Health Check**: http://localhost:8000/health
- **API Documentation (Swagger)**: http://localhost:8000/docs
- **API Documentation (ReDoc)**: http://localhost:8000/redoc

### 7. 동작 확인

#### Health Check 테스트

```bash
curl http://localhost:8000/health
```

예상 응답:
```json
{
  "status": "healthy",
  "service": "radio-scrap-backend",
  "version": "1.0.0"
}
```

#### API 엔드포인트 확인

Swagger UI (http://localhost:8000/docs)에서 다음 엔드포인트들을 확인할 수 있습니다:

**Scraping**
- `POST /api/scrape/upload` - Excel 업로드
- `POST /api/scrape/start` - 스크래핑 시작
- `GET /api/scrape/status/{job_id}` - 진행 상태

**Articles**
- `GET /api/articles` - 기사 목록
- `GET /api/articles/{id}` - 기사 상세
- `PATCH /api/articles/{id}` - 기사 수정

**Translation**
- `POST /api/translate/start` - 번역 시작
- `GET /api/translate/status/{job_id}` - 번역 상태

**Publishing**
- `POST /api/publish/html` - HTML 생성
- `POST /api/publish/email` - 이메일 발송
- `GET /api/publish/{id}` - 발행물 조회

**Attachments**
- `GET /api/attachments/{id}/download` - 파일 다운로드

### 8. 데이터베이스 확인

서버 시작 시 SQLite 데이터베이스가 자동으로 생성됩니다:

```bash
# database.db 파일 확인
ls -la backend/database.db

# SQLite 브라우저로 테이블 확인
sqlite3 backend/database.db
> .tables
# 예상 출력: articles  attachments  publications  scrape_jobs
> .schema articles
> .quit
```

## 문제 해결

### pip가 없는 경우

```bash
python -m ensurepip --upgrade
```

### 포트 8000이 이미 사용 중인 경우

다른 포트로 실행:
```bash
uvicorn app.main:app --reload --port 8001
```

### 모듈을 찾을 수 없는 경우

현재 디렉토리가 `backend/`인지 확인하고, 가상환경이 활성화되었는지 확인하세요.

### ImportError 발생 시

의존성을 다시 설치:
```bash
pip install --upgrade -r requirements.txt
```

## Phase 1 완료 체크리스트

서버 실행 후 다음을 확인하세요:

- [ ] `http://localhost:8000/health`에서 200 OK 응답
- [ ] `http://localhost:8000/docs`에서 Swagger UI 표시
- [ ] 14개 API 엔드포인트 확인 (스켈레톤, 501 Not Implemented 응답)
- [ ] `database.db` 파일 생성 확인
- [ ] SQLite에서 4개 테이블 확인 (articles, attachments, scrape_jobs, publications)
- [ ] 콘솔 로그에서 "🚀 Starting FastAPI application" 확인
- [ ] 콘솔 로그에서 "✅ Database initialized" 확인

모든 항목이 확인되면 Phase 1 완료입니다! 🎉

## 다음 단계

Phase 2에서 구현할 기능:
- Firecrawl API 통합 (실제 스크래핑)
- OpenAI GPT-4 번역
- Excel 파일 파싱
- 백그라운드 작업 큐
- SSE 진행 상태 스트리밍
