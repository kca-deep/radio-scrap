# -*- coding: utf-8 -*-
"""
Excel → HTML 매거진 (v12, patched+JP) : 한국/미국/영국/일본, 1번째 시트 사용, 질문/태그 제거
----------------------------------------------------------------
· 왼쪽 사이드바 : All 〉 한국 〉 미국 〉 영국 〉 일본
· 카드 필터 기준 : source 필드(KR/US/UK/JP)
· 원본 source 값은 source_raw 로 보존
· (변경) 최근 주파수 정책 종합 요약을 **세 번째 시트**에서 읽어 첫 카드로 삽입
   - 3번째 시트가 없거나 실패 시 "Monthly" 시트명으로 폴백
"""

import os, glob, pandas as pd
from collections import Counter
from datetime import datetime
from jinja2 import Environment, FileSystemLoader, select_autoescape

# ── 경로 설정 ───────────────────────────────────────────
DATA_DIR = r"C:\Users\cpryul68\OneDrive\전파정책(GPT)\데이터가공(GPT)"
TPL_DIR  = r"C:\Users\cpryul68\OneDrive\전파정책(GPT)\데이터시각화(tem)"
os.makedirs(TPL_DIR, exist_ok=True)

# ------------------------------------------------------------------
def latest_xlsx(folder, pattern="*_rewritten.xlsx"):
    paths = glob.glob(os.path.join(folder, pattern))
    return max(paths, key=os.path.getmtime) if paths else None

xlsx_path = latest_xlsx(DATA_DIR)
if not xlsx_path:
    raise FileNotFoundError("❌ 최근 *_rewritten.xlsx 파일이 없습니다")

# ── 데이터 로드 : 1번째 시트만 사용(Articles 가정) ───────────────
xl = pd.ExcelFile(xlsx_path)
first_sheet = xl.sheet_names[0]  # "Articles" 가정하되, 1번째 시트만 사용
df = pd.read_excel(xl, sheet_name=first_sheet)

# 필요한 컬럼만 골라서 없으면 빈값으로 보정
need_cols = ["title","date","link","content","source","title_ko","content_ko"]
for c in need_cols:
    if c not in df.columns:
        df[c] = ""
df = df[need_cols].copy()

# 날짜 문자열 변환
df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")

# ── 국가 그룹 매핑 ──────────────────────────────────────
# 원본 source 값 보존
df["source_raw"] = df["source"].fillna("")

def to_group_code(src: str) -> str | None:
    """
    source 문자열을 한국(KR)/미국(US)/영국(UK)/일본(JP) 중 하나로 맵핑. 없으면 None.
    요청 고정 매핑:
      - Soumu/総務省/MIC/Ministry of Internal Affairs and Communications → JP
      - FCC/NTIA → US
      - Ofcom → UK
      - 과학기술정보통신부 → KR
    """
    s = (src or "").strip()
    su = s.upper()

    # 직접 매핑(정확 일치 우선)
    direct = {
        # KR
        "MSIT": "KR", "KCC": "KR", "KCA": "KR", "RRA": "KR",
        "과기정통부": "KR", "과학기술정보통신부": "KR", "대한민국": "KR", "KOREA": "KR",

        # US
        "FCC": "US", "NTIA": "US", "UNITED STATES": "US", "USA": "US", "U.S.": "US",

        # UK
        "OFCOM": "UK", "UK": "UK", "U.K.": "UK", "UNITED KINGDOM": "UK", "DSIT": "UK",

        # JP
        "SOUMU": "JP", "総務省": "JP", "MIC": "JP",
        "JAPAN": "JP", "日本": "JP",
        "MINISTRY OF INTERNAL AFFAIRS AND COMMUNICATIONS": "JP",
    }
    # 정확 일치 체크(원문/대문자)
    if s in direct:  return direct[s]
    if su in direct: return direct[su]

    # 부분일치(포괄 규칙)
    # KR
    if any(k in su for k in ["MSIT","KCC","KCA","RRA","KOREA"]) or ("과기" in s) or ("과학기술정보통신부" in s) or ("대한민국" in s):
        return "KR"
    # US
    if any(k in su for k in ["FCC","NTIA","UNITED STATES","USA","U.S"]):
        return "US"
    # UK
    if any(k in su for k in ["OFCOM","UNITED KINGDOM","U.K"," DSIT"," UK "]):
        return "UK"
    # JP
    if any(k in su for k in ["SOUMU","MIC","JAPAN"]) or ("総務省" in s) or ("日本" in s) or ("MINISTRY OF INTERNAL AFFAIRS AND COMMUNICATIONS" in su):
        return "JP"

    # 그 외(예: ITU, EC, 일반 News 등)는 제외
    return None

df["group_code"]  = df["source"].apply(to_group_code)
label_map = {"KR":"한국", "US":"미국", "UK":"영국", "JP":"일본"}
df["group_label"] = df["group_code"].map(label_map)

# 한국/미국/영국/일본만 남기기
df_use = df[df["group_code"].isin(["KR","US","UK","JP"])].copy()
df_use = df_use.sort_values("date", ascending=False)

# ── 카드 목록 생성 ──────────────────────────────────────
def nz(x):  # NaN 방지
    return "" if pd.isna(x) else x

articles = [{
    "title"        : nz(r.title) or nz(r.title_ko),
    "title_ko"     : nz(r.title_ko),
    "content_ko"   : nz(r.content_ko) or nz(r.content),
    "date"         : nz(r.date),
    "source"       : nz(r.group_code),       # ← 필터용(KR/US/UK/JP)
    "source_label" : nz(r.group_label),      # ← 사람이 보는 라벨(한국/미국/영국/일본)
    "source_raw"   : nz(r.source_raw),       # ← 원래 소스명 보존
    "link"         : nz(r.link)
} for r in df_use.itertuples()]

# ── (유지) 세 번째 시트의 "최근 주파수 정책 종합 요약"을 첫 카드로 삽입 ─────
monthly_title = ""
monthly_content = ""
monthly_date = ""

# 1) 우선 3번째 시트(0-based index 2)를 시도
summary_sheet_name = None
if len(xl.sheet_names) >= 3:
    summary_sheet_name = xl.sheet_names[2]
# 2) 폴백: "Monthly"라는 시트명이 있으면 사용
elif "Monthly" in xl.sheet_names:
    summary_sheet_name = "Monthly"

if summary_sheet_name:
    try:
        mdf = pd.read_excel(xl, sheet_name=summary_sheet_name)
        # 컬럼명 정규화
        mdf.columns = [str(c).strip() for c in mdf.columns]

        # 대표 컬럼 탐색(유연 매핑)
        title_col_candidates   = [c for c in mdf.columns if c.lower().startswith("monthly") or "summary" in c.lower()]
        content_col_candidates = [c for c in mdf.columns if c.lower() in ("content","요약","내용","text") or "content" in c.lower()]

        title_col   = title_col_candidates[0]   if title_col_candidates else (mdf.columns[0] if len(mdf.columns) >= 1 else None)
        content_col = content_col_candidates[0] if content_col_candidates else (mdf.columns[1] if len(mdf.columns) >= 2 else None)

        # 내용이 있는 마지막 행 선택
        mdf_nz = mdf.dropna(how="all")
        if not mdf_nz.empty and title_col and content_col:
            row = mdf_nz.iloc[-1]
            monthly_title   = str(row.get(title_col, "")).strip() or "주파수 정책 종합 요약"
            monthly_content = str(row.get(content_col, "")).strip()

            # 날짜: 기사들 중 최신 날짜가 있으면 사용, 없으면 오늘
            try:
                dmax = pd.to_datetime(df_use["date"], errors="coerce").max()
                monthly_date = (dmax if pd.notna(dmax) else pd.Timestamp(datetime.now().date())).strftime("%Y-%m-%d")
            except Exception:
                monthly_date = datetime.now().strftime("%Y-%m-%d")
    except Exception:
        # 요약 시트 파싱 실패 시 요약 미삽입(기존 기능 유지)
        monthly_title = ""
        monthly_content = ""
        monthly_date = ""

# 총괄 내용이 있으면 첫 카드로 삽입
if monthly_content:
    articles.insert(0, {
        "title"        : monthly_title or "주파수 정책 종합 요약",
        "title_ko"     : monthly_title or "주파수 정책 종합 요약",
        "content_ko"   : monthly_content,
        "date"         : monthly_date,
        "source"       : "All",      # All 탭에서만 노출
        "source_label" : "전체",
        "source_raw"   : f"{summary_sheet_name or 'Monthly'}",
        "link"         : ""
    })

# ── 사이드바 구성(네 나라 고정) ─────────────────────────
cnt = Counter([a["source"] for a in articles])  # {'KR': n, 'US': n, 'UK': n, 'JP': n, 'All': 1(요약)}
sidebar = [("All", "All", len(articles))]
for code in ("KR","US","UK","JP"):
    sidebar.append((code, label_map[code], cnt.get(code, 0)))

# ── 템플릿 렌더링 ───────────────────────────────────────
env = Environment(
    loader=FileSystemLoader(TPL_DIR),
    autoescape=select_autoescape(["html"])
)
template = env.get_template("template_magv28.html")
html_out = template.render(
    today=datetime.now().strftime("%Y-%m-%d"),
    magazine_title="Monthly Spectrum Policy Magazine",
    articles=articles,
    sidebar_items=sidebar
)

# ── 결과 저장 ──────────────────────────────────────────
out_path = os.path.join(TPL_DIR, f"{datetime.now():%Y%m%d_%H%M%S}_mag.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html_out)

print(f"✅ HTML 매거진 생성 → {out_path}")
