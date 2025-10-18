# Backend Phase 1: 기본 구조 구축 체크리스트

## 개요
FastAPI 프로젝트 초기 설정 및 데이터베이스 스키마 생성

---

## 1. 프로젝트 구조 생성

### 1.1 디렉토리 생성
- [x] `backend/` 루트 디렉토리 생성
- [x] `backend/app/` 애플리케이션 디렉토리 생성
- [x] `backend/app/api/` API 관련 디렉토리 생성
- [x] `backend/app/api/routes/` 라우트 파일 디렉토리 생성
- [x] `backend/app/services/` 비즈니스 로직 디렉토리 생성
- [x] `backend/app/models/` Pydantic 모델 디렉토리 생성
- [x] `backend/app/templates/` Jinja2 템플릿 디렉토리 생성
- [x] `backend/app/storage/` 파일 저장소 디렉토리 생성
- [x] `backend/app/storage/attachments/` 첨부파일 디렉토리 생성

### 1.2 설정 파일 생성
- [x] `backend/requirements.txt` 생성 (Python 의존성)
- [ ] `backend/pyproject.toml` 생성 (선택사항: Poetry 사용 시)
- [x] `backend/.env.example` 생성 (환경변수 템플릿)
- [x] `backend/.gitignore` 생성
- [ ] `backend/README.md` 생성 (백엔드 문서) - 사용자 요청시에만

---

## 2. Python 의존성 설치

### 2.1 Core 프레임워크
- [x] `fastapi` - 웹 프레임워크
- [x] `uvicorn[standard]` - ASGI 서버
- [x] `pydantic` - 데이터 검증
- [x] `pydantic-settings` - 환경변수 관리

### 2.2 데이터베이스
- [x] `sqlalchemy` - ORM
- [x] `aiosqlite` - 비동기 SQLite 드라이버
- [x] `alembic` - 데이터베이스 마이그레이션 (선택사항)

### 2.3 API 통합
- [x] `httpx` - 비동기 HTTP 클라이언트 (Firecrawl, OpenAI 호출용)
- [x] `openai` - OpenAI Python SDK
- [x] `firecrawl-py` - Firecrawl SDK (존재하는 경우)

### 2.4 데이터 처리
- [x] `pandas` - 데이터 처리
- [x] `openpyxl` - Excel 파일 파싱
- [x] `python-multipart` - 파일 업로드 처리

### 2.5 템플릿 & 이메일
- [x] `jinja2` - HTML 템플릿 엔진
- [x] `aiosmtplib` - 비동기 SMTP 클라이언트
- [x] `email-validator` - 이메일 검증

### 2.6 유틸리티
- [x] `python-dotenv` - .env 파일 로드
- [x] `python-jose[cryptography]` - JWT (인증 필요시)
- [x] `bcrypt` - 비밀번호 해싱 (인증 필요시)

### 2.7 개발 도구
- [x] `pytest` - 테스트 프레임워크
- [x] `pytest-asyncio` - 비동기 테스트
- [x] `black` - 코드 포맷터
- [x] `ruff` - 린터
- [x] `mypy` - 타입 체커

---

## 3. FastAPI 애플리케이션 초기화

### 3.1 메인 애플리케이션 (`backend/app/main.py`)
- [x] FastAPI 앱 인스턴스 생성
- [x] CORS 미들웨어 설정
- [x] 환경변수 로드 (pydantic-settings 사용)
- [x] 앱 시작/종료 이벤트 핸들러 정의 (lifespan context manager)
- [x] 헬스체크 엔드포인트 (`GET /health`) 생성
- [x] API 라우터 등록 준비

### 3.2 설정 모듈 (`backend/app/config.py`)
- [x] `Settings` 클래스 정의 (BaseSettings 상속)
- [x] 환경변수 정의:
  - [x] `FIRECRAWL_API_KEY`
  - [x] `OPENAI_API_KEY`
  - [x] `DATABASE_URL`
  - [x] `ATTACHMENT_DIR`
  - [x] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  - [x] `CORS_ORIGINS` (리스트)
- [x] 설정 인스턴스 export (`settings = Settings()`) + lru_cache 적용

### 3.3 데이터베이스 연결 (`backend/app/database.py`)
- [x] SQLAlchemy 엔진 생성 (비동기)
- [x] `AsyncSession` 팩토리 생성 (async_sessionmaker + expire_on_commit=False)
- [x] 의존성 주입용 `get_db()` 함수 정의
- [x] 데이터베이스 초기화 함수 (`init_db()`) 정의

---

## 4. SQLite 스키마 생성

### 4.1 SQLAlchemy 모델 정의 (`backend/app/db/models.py`)

#### 4.1.1 `ArticleModel` 테이블
- [x] `id` (String, PK, UUID)
- [x] `url` (String, UNIQUE, NOT NULL, INDEX)
- [x] `title` (String, nullable)
- [x] `title_ko` (String, nullable)
- [x] `content` (Text, nullable)
- [x] `content_ko` (Text, nullable)
- [x] `source` (String, nullable)
- [x] `country_code` (String, nullable, INDEX)
- [x] `published_date` (Date, nullable, INDEX)
- [x] `scraped_at` (DateTime, default=now)
- [x] `translated_at` (DateTime, nullable)
- [x] `status` (String: 'scraped', 'translated', INDEX)
- [x] `attachments` relationship (one-to-many)

#### 4.1.2 `AttachmentModel` 테이블
- [x] `id` (Integer, PK, AUTOINCREMENT)
- [x] `article_id` (String, FK → articles.id, INDEX)
- [x] `filename` (String, NOT NULL)
- [x] `file_path` (String, NOT NULL)
- [x] `file_url` (String, nullable)
- [x] `downloaded_at` (DateTime, default=now)
- [x] `article` relationship (many-to-one)

#### 4.1.3 `ScrapeJobModel` 테이블
- [x] `job_id` (String, PK, UUID)
- [x] `status` (String: 'pending', 'processing', 'completed', 'failed', INDEX)
- [x] `total_urls` (Integer, NOT NULL)
- [x] `processed_urls` (Integer, default=0)
- [x] `created_at` (DateTime, default=now)
- [x] `updated_at` (DateTime, onupdate=now)

#### 4.1.4 `PublicationModel` 테이블
- [x] `id` (String, PK, UUID)
- [x] `title` (String, NOT NULL)
- [x] `article_ids` (JSON, NOT NULL)
- [x] `html_path` (String, NOT NULL)
- [x] `created_at` (DateTime, default=now)
- [x] `sent_at` (DateTime, nullable)

### 4.2 테이블 생성 스크립트
- [x] `Base.metadata.create_all()` 호출 함수 작성 (database.py의 init_db)
- [ ] 초기 마이그레이션 (선택사항: Alembic 사용)
- [ ] 테스트 데이터 시딩 스크립트 (선택사항)

---

## 5. Pydantic 모델 정의

### 5.1 공통 모델 (`backend/app/models/common.py`)
- [x] `StatusEnum` (scraped, translated)
- [x] `JobStatusEnum` (pending, processing, completed, failed)
- [x] `CountryCodeEnum` (KR, US, UK, JP)

### 5.2 Attachment 모델 (`backend/app/models/attachment.py`)
- [x] `AttachmentBase` (공통 필드)
- [x] `AttachmentCreate` (생성용)
- [x] `Attachment` (응답용, id 포함)

### 5.3 Article 모델 (`backend/app/models/article.py`)
- [x] `ArticleBase` (공통 필드)
- [x] `ArticleCreate` (생성용)
- [x] `ArticleUpdate` (수정용, 모든 필드 Optional)
- [x] `Article` (응답용, id, timestamps, attachments 포함)
- [x] `ArticleList` (목록용, 간소화된 필드)

### 5.4 ScrapeJob 모델 (`backend/app/models/scrape_job.py`)
- [x] `ScrapeJobBase` (공통 필드)
- [x] `ScrapeJobCreate` (생성용)
- [x] `ScrapeJob` (응답용)
- [x] `ScrapeJobStatus` (진행 상태용, processed_urls, total_urls 포함)

### 5.5 Publication 모델 (`backend/app/models/publication.py`)
- [x] `PublicationBase` (공통 필드)
- [x] `PublicationCreate` (생성용)
- [x] `Publication` (응답용)

### 5.6 요청/응답 모델 (`backend/app/models/requests.py`, `responses.py`)
- [x] `StartScrapeRequest` (job_id)
- [x] `TranslateRequest` (article_ids 배열)
- [x] `PublishHTMLRequest` (article_ids, title)
- [x] `SendEmailRequest` (publication_id, recipients, subject)
- [x] `SuccessResponse` (공통 성공 응답)
- [x] `ErrorResponse` (공통 에러 응답)

---

## 6. 기본 라우터 스켈레톤 생성

### 6.1 라우터 파일 생성 (빈 함수로 시작)
- [x] `backend/app/api/routes/scrape.py`
  - [x] `POST /api/scrape/upload` 스켈레톤
  - [x] `POST /api/scrape/start` 스켈레톤
  - [x] `GET /api/scrape/status/{job_id}` 스켈레톤

- [x] `backend/app/api/routes/articles.py`
  - [x] `GET /api/articles` 스켈레톤
  - [x] `GET /api/articles/{id}` 스켈레톤
  - [x] `PATCH /api/articles/{id}` 스켈레톤

- [x] `backend/app/api/routes/attachments.py`
  - [x] `GET /api/attachments/{id}/download` 스켈레톤

- [x] `backend/app/api/routes/translate.py`
  - [x] `POST /api/translate/start` 스켈레톤
  - [x] `GET /api/translate/status/{job_id}` 스켈레톤

- [x] `backend/app/api/routes/publish.py`
  - [x] `POST /api/publish/html` 스켈레톤
  - [x] `POST /api/publish/email` 스켈레톤
  - [x] `GET /api/publish/{id}` 스켈레톤

### 6.2 라우터 등록
- [x] `backend/app/api/__init__.py` 생성
- [x] `APIRouter` 인스턴스로 모든 라우터 통합
- [x] `main.py`에서 `app.include_router()` 호출

---

## 7. 유틸리티 함수 작성

### 7.1 UUID 생성 (`backend/app/utils/id_generator.py`)
- [x] `generate_article_id()` 함수
- [x] `generate_job_id()` 함수
- [x] `generate_publication_id()` 함수

### 7.2 날짜/시간 유틸리티 (`backend/app/utils/datetime_utils.py`)
- [x] `get_current_utc()` - 현재 UTC 시간
- [x] `parse_date_string()` - 문자열 → datetime 변환

### 7.3 파일 유틸리티 (`backend/app/utils/file.py`)
- [x] `ensure_directory()` - 디렉토리 존재 확인/생성
- [x] `sanitize_filename()` - 파일명 정제
- [x] `get_file_extension()` - 확장자 추출

---

## 8. 환경변수 설정

### 8.1 `.env.example` 템플릿 작성
```bash
# API Keys
FIRECRAWL_API_KEY=fc-your-key-here
OPENAI_API_KEY=sk-your-key-here

# Database
DATABASE_URL=sqlite+aiosqlite:///./database.db

# Storage
ATTACHMENT_DIR=./storage/attachments

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# App
DEBUG=true
```

### 8.2 실제 `.env` 파일 생성
- [x] `.env.example` 복사 → `.env`
- [x] 실제 API 키 입력 (테스트용)

---

## 9. 기본 테스트 작성

### 9.1 테스트 설정 (`backend/tests/conftest.py`)
- [ ] Pytest fixture 정의
- [ ] 테스트 데이터베이스 설정 (in-memory SQLite)
- [ ] FastAPI 테스트 클라이언트 fixture

### 9.2 단위 테스트
- [ ] `tests/test_models.py` - Pydantic 모델 검증
- [ ] `tests/test_database.py` - DB CRUD 기본 테스트
- [ ] `tests/test_config.py` - 환경변수 로드 테스트

### 9.3 통합 테스트
- [ ] `tests/test_main.py` - 헬스체크 엔드포인트 테스트
- [ ] `tests/test_routes.py` - 각 라우터 스켈레톤 테스트 (404 확인)

---

## 10. 개발 서버 실행 및 검증

### 10.1 서버 실행
- [x] 서버 실행 명령 준비 (`uvicorn app.main:app --reload`)
- [x] 구조 검증 완료 (24개 Python 파일 생성)
- [x] SETUP.md 가이드 작성

### 10.2 기본 동작 검증 (사용자가 Python 환경에서 실행 필요)
- [ ] `http://localhost:8000/health` 접속 확인
- [ ] `http://localhost:8000/docs` Swagger UI 확인
- [ ] `http://localhost:8000/redoc` ReDoc 확인
- [ ] `/health` 엔드포인트 호출 (200 OK 확인)
- [ ] 데이터베이스 파일 생성 확인 (`database.db`)
- [ ] 테이블 생성 확인 (4개: articles, attachments, scrape_jobs, publications)
- [ ] 환경변수 로드 확인 (로그 출력)

---

## 11. 문서화

### 11.1 코드 문서화
- [x] 각 모듈에 docstring 추가
- [x] 복잡한 함수에 주석 추가
- [x] 타입 힌트 전체 적용

### 11.2 README 작성 (`backend/README.md`)
- [ ] 프로젝트 개요 (사용자 요청시에만)
- [ ] 설치 방법 (`pip install -r requirements.txt`)
- [ ] 환경변수 설정 가이드
- [ ] 개발 서버 실행 방법
- [ ] 테스트 실행 방법 (`pytest`)
- [ ] API 문서 링크 (`/docs`)

---

## 12. Git Commit

### 12.1 변경사항 커밋
- [ ] `.gitignore`에 다음 추가:
  - `backend/.env`
  - `backend/database.db`
  - `backend/storage/attachments/*`
  - `backend/__pycache__/`
  - `backend/.pytest_cache/`
- [ ] `git add backend/`
- [ ] `git commit -m "feat: initialize FastAPI backend structure with SQLite schema"`

---

## 완료 기준

다음 항목이 모두 확인되면 Phase 1 완료:

✅ FastAPI 서버가 `http://localhost:8000`에서 정상 실행
✅ `/docs`에서 모든 API 엔드포인트 확인 가능 (스켈레톤)
✅ SQLite 데이터베이스 파일 생성 및 4개 테이블 존재
✅ 환경변수 정상 로드
✅ 모든 단위 테스트 통과 (`pytest`)
✅ Git에 커밋 완료

---

## 다음 단계

Phase 2: 스크랩 기능 구현 (`prompts/backend-phase2-checklist.md`)
