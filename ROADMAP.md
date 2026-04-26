# Roadmap — `korean-law-alio-mcp`

> 본 프로젝트는 2026-04-25 일자로 [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) 에서 fork 되었습니다. [chrisryugj](https://github.com/chrisryugj) 님께 다시 한번 감사를 표합니다. 본 문서는 fork 이후의 작업과 향후 계획을 담습니다.

상세 변경 내역은 [CHANGELOG.md](./CHANGELOG.md), 코드 가이드는 [CLAUDE.md](./CLAUDE.md) 참고.

---

## ✅ 완료 — fork 일자(2026-04-25) 기준 수정·개선·강화

원작자가 완성한 87개 법제처 도구 위에, 본 fork 가 다음을 더했습니다.

### ➕ 추가 — ALIO 공공기관 내부규정 통합

- **데이터 파이프라인** (`npm run alio:sync`)
  - ALIO 공시 전체 ~344개 공공기관 / 35,208건 내부규정 수집
  - manifest.json 기반 incremental sync (콘텐츠 해시 비교)
  - 실패/재시도/중단복구 (`--resume`, `--retry-failed`, `--retry-fallback`)
- **ALIO MCP 도구 23개** — 법제처 87개 도구 패턴을 ALIO 데이터에 적용. 판례/해석례/위원회 등 중복 도메인은 법제처 도구 그대로 재사용 (중복 개발 0).

  *조회·검색·자동완성*
  - `search_institution` — 기관명⇄apbaId 양방향 검색
  - `list_alio_regulations` — 기관별 규정 목록
  - `get_alio_regulation` — 규정 본문 / 특정 조문 조회
  - `search_alio_regulation_text` — 전체 규정 본문 키워드 전문검색
  - `suggest_alio_regulation_names` — 규정 제목 자동완성
  - `advanced_alio_search` — 분류·기관유형·주무부처·기간·키워드 복합 필터

  *비교·분석*
  - `compare_alio_regulations` — 토픽 기준 N:N 비교
  - `compare_alio_articles` — 두 규정의 같은 조문 1:1 정밀 비교
  - `compare_regulation_timeline` — 기관간 개정 이력 비교
  - `find_similar_regulations` — 기준 규정 1건과 유사한 다른 기관 규정 1:N
  - `suggest_alio_benchmark` — 우리 기관에 없는 동종 기관 규정 제안

  *이력·변경 모니터링*
  - `get_alio_regulation_history` — 규정 개정 이력
  - `get_recent_alio_revisions` — 최근 N일 내 개정 규정 타임라인

  *법령 연계*
  - `analyze_regulation_delegation` — 상위 법령 자동 추출 + 법제처 검색 연계
  - `find_regulations_by_upper_law` — 상위 법령 역방향 검색

  *데이터 개관·메타*
  - `get_alio_statistics` — 수집 데이터 통계
  - `get_alio_institution_profile` — 한 기관의 규정 체계 요약
  - `analyze_alio_regulation` — 한 규정의 메타 + 구조 + 목차

  *본문 구조·연결*
  - `get_alio_annexes` — 본문에서 [별표 N] 추출
  - `parse_alio_article_links` — 본문 "제N조" 참조 추출 + 위치 매칭
  - `get_alio_external_links` — ALIO 원본 페이지 + 첨부 다운로드 링크
  - `get_batch_alio_regulations` — 여러 규정/조문 일괄 조회

  *체인*
  - `chain_alio_benchmark` — 프로파일 + 토픽 매칭 + 동종 기관 갭 분석 종합
- **6단계 파싱 폴백 체인**
  1. kordoc 직접 (HWP/HWPX/PDF) — 일반 케이스 34,908건
  2. docling + tesseract OCR — 스캔 이미지 PDF 261건
  3. soffice + docling DOCX — HWP 3.0 구포맷 10건
  4. soffice + docling XLSX — Excel 별표 1건
  5. JSZip 재귀 언랩 — 묶음 ZIP 1건
  6. parseError 기록 — 24건 (DRM·빈 스캔본 한계)
  - **최종 파싱 성공률: 99.923%** (35,181 / 35,208)
- **OCR 출처 배지** — MCP 응답에 `[OCR:docling]` 등 변환 출처 표시 (사용자가 원문 신뢰도 판단 가능)

### 🔧 수정·개선 — 사용자 자연어 중심 동작

어떤 공공기관도, 어떤 주제도 자유롭게 다룰 수 있도록 ALIO 비교 도구를 정비:

- **사용자 질문 그대로 동작** — 비교 대상은 호출 시 `institutions` 인자(사용자가 자연어로 지목한 기관)이거나, 미지정 시 수집된 전체 기관 자동. 환경변수에 비교 세트를 박아두지 않음.
- **자연어 라우터 동적 패턴** — `ALIO_INSTITUTION_ALIASES` 환경변수로 약어 매핑 등록 시 정규식 동적 빌드. 미등록 시에도 apbaId 코드(`C\d{4}`) + 정식 기관명 + 일반 키워드는 정상 동작.
- **양방향 lookup** — `search_institution` 이 기관명⇄apbaId 모두 받음. LLM 입장에서 "어느 기관이 있는지" 몰라도 자유 호출 가능.
- **광범위 → 자동 좁힘** — 토픽 매칭 없는 기관은 결과에서 자동 제외되어 응답 폭발 방지.

### 🛡️ 강화 — 라이선스 위생 (clean-room 재작성)

BSL 1.1 라이선스 코드와의 결합을 회피하기 위해 4개 도메인 파일을 caller 시그니처 + 법제처 OpenAPI 공개 명세만 참조하여 처음부터 재작성:

- [src/lib/search-normalizer.ts](./src/lib/search-normalizer.ts) — 검색어 정규화·약칭 해결
- [src/lib/law-parser.ts](./src/lib/law-parser.ts) — JO 코드 변환
- [src/lib/three-tier-parser.ts](./src/lib/three-tier-parser.ts) — 3단비교 응답 파서
- [src/tools/historical-law.ts](./src/tools/historical-law.ts) — 연혁법령 검색·본문 조회

→ 본 프로젝트의 모든 자체 코드는 **MIT** 단일 라이선스. 외부 라이선스 및 데이터 출처는 [NOTICE](./NOTICE) 참고.

### 📦 의존성 정비

- **kordoc 메이저 업그레이드** `1.6.1` → `2.5.2` (PDF 버그 다수 수정 + DOCX/XLSX 추가 지원)
- **자체 파서 5개 → kordoc 통합 파서로 교체** (`hwpx-parser.ts`, `hwp5-parser.ts`, `pdf-parser.ts` 등 제거)
- **외부 도구 의존성 (선택)**
  - LibreOffice (`soffice`) — HWP 3.0 / Excel 변환
  - docling (Python CLI) — OCR / DOCX / XLSX 파싱
  - tesseract + tesseract-lang — OCR 엔진 (한글)

### 📚 문서 정비

- 한글 README 기본화 (README.md = 한글, README-EN.md = English)
- 환경변수 표 + ALIO 비교 결정 흐름 명시 ([CLAUDE.md](./CLAUDE.md))
- 기타 문서들 정비

---

## 🚀 향후 계획

사용 사례와 피드백을 반영하며 점진적으로 발전시킬 예정입니다.
