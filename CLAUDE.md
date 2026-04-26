# CLAUDE.md

> 이 문서는 **본 fork (`korean-law-alio-mcp`, 2026-04-25 fork by scvcoder)** 의 현재 코드 가이드입니다.
> AI 코딩 어시스턴트(Claude Code 등)와 외부 기여자를 위한 개발 가이드.
>
> - 사용자용 설치/실행 안내는 [README.md](./README.md), 도구 레퍼런스는 [docs/API.md](./docs/API.md)
> - 본 fork 의 변경 동기와 향후 계획은 [ROADMAP.md](./ROADMAP.md), 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)
> - **원작자(@chrisryugj/@Mongmini)의 v2.2 시점 원문 가이드**는 [CLAUDE-UPSTREAM.md](./CLAUDE-UPSTREAM.md) 에 그대로 보존되어 있습니다.

**Korean Law + ALIO MCP Server** — 법제처 OpenAPI(법령·판례·행정규칙·자치법규·해석례 등) 87개 도구 + ALIO 공공기관 내부규정 23개 도구 = **총 110개 MCP 도구** + 자연어 CLI.

## Structure

```
src/
├── index.ts              # 엔트리포인트 (STDIO/HTTP 모드 선택)
├── cli.ts                # CLI v2 — 자연어 라우팅 + REPL
├── tool-registry.ts      # 모든 도구(법제처 87 + ALIO 10) 정의/등록
├── tools/                # 도구 구현 (각 ~200줄 목표)
│   └── alio/             # ALIO 공공기관 규정 도구 10개
├── scripts/
│   └── alio-sync.ts      # ALIO 일괄 수집 배치 (npm run alio:sync)
├── lib/                  # 공통 유틸/파서/클라이언트
│   └── alio/             # ALIO 도메인 모듈 (client/manifest/index-loader/config 등)
└── server/               # HTTP/SSE 서버
```

자세한 모듈 책임은 아래 [Key Files](#key-files) 참고.

## Commands

```bash
npm install           # 의존성 설치
npm run build         # TypeScript 빌드
npm run watch         # 개발 모드 (tsc --watch)
LAW_OC=키 node build/index.js  # MCP 서버 실행 (STDIO 모드)

# ALIO 공공기관 내부규정 일괄 수집 (배치)
npm run alio:sync                              # ALIO 공시 전체 기관
npm run alio:sync -- --only C0xxx              # 단일 기관 (apbaId 지정)
npm run alio:sync -- --only C0xxx --limit 10   # smoke test
npm run alio:sync -- --resume                  # 실패 기관만 재시도
npm run alio:sync -- --retry-failed            # parseError 가 남은 규정만 재시도
npm run alio:sync -- --retry-fallback          # 기존 fallback 결과를 새 엔진으로 재생성
npm run alio:sync -- --docling-fallback        # 스캔 이미지 PDF 를 docling OCR 로 복구
npm run alio:sync -- --concurrency 3 --keep-raw
```

### docling OCR fallback (선택)

kordoc 이 "이미지 기반 PDF" 로 판정한 스캔본만 docling 에 재위임. 외부 CLI 가 필요한 선택 기능.

```bash
brew install docling tesseract tesseract-lang
```

OCR 엔진 비교 (단일 샘플 기준 — 환경에 따라 다름):
- `tesseract` (기본, 한글 자간 후처리 포함) — 가장 안정
- `ocrmac` (macOS 전용) — 정확도 높지만 플랫폼 종속
- `easyocr` — 정확도 낮음

엔진 전환은 환경변수로 — `.env.example` 참고.
manifest entry 에 `fallbackParser: "docling"`, MD 상단 주석 `<!-- parsed by docling/<engine> -->` 로 출처 기록.

## ALIO 데이터 구조

```
data/alio/                              # .gitignore 됨 (재생성 가능)
├── institutions.json                   # 공공기관 메타 (sync 결과)
├── sync-state.json                     # 마지막 sync 시각/실패 로그
└── {apbaId}/                           # 예: C0xxx (기관코드)
    ├── manifest.json                   # 규정 목록 + 개정이력 + 콘텐츠 해시
    └── regulations/
        ├── {regId}.md                  # kordoc 변환 markdown
        └── {regId}.raw.hwp             # (--keep-raw 시) 원본 보존
```

`apbaId` 형식: `C` + 4자리 숫자. 정확한 매핑은 sync 후 `data/alio/institutions.json` 참고.
`regId` = ALIO 내부의 `idx` 값. manifest 의 `primaryFileNo` + `revisions[]` 로 개정 이력 추적.

## Environment

| 변수 | 필수 | 용도 |
|------|------|------|
| `LAW_OC` | ✅ | 법제처 OpenAPI 신청자 ID — https://open.law.go.kr/LSO/openApi/guideResult.do (무료, 이메일 ID 등록) |
| `ALIO_DATA_DIR` | ❌ | `data/alio/` 경로 override |
| `ALIO_INSTITUTION_ALIASES` | ❌ | 자연어 라우팅용 약어 매핑 (JSON object) |
| `DOCLING_*` | ❌ | OCR fallback 엔진/언어/디바이스 등 — `.env.example` 참고 |

전체 변수 + 예시값은 [`.env.example`](./.env.example) 참고.

### ALIO 비교 도구의 비교 대상 결정

- 호출 시 `institutions`/`peers` 인자가 있으면 그대로 사용 — 사용자가 자연어로 "A·B·C 기관과 비교" 같이 지목하면 LLM 이 해당 명칭/코드를 배열로 전달
- 인자가 없으면 **수집된 전체 기관 자동** — 사용자가 토픽만 던지거나 "랜덤/전체" 의도일 때

→ 환경변수에 비교 세트를 박아두지 않음. 사용자 자연어 질문 그대로 LLM 이 해석해서 도구 호출.
자연어 라우팅에서 사용자 정의 약어를 인식시키려면 `ALIO_INSTITUTION_ALIASES` 등록 필요. 미등록 시에도 `C\d{4}` 코드와 정식 기관명, 일반 키워드(`공공기관 규정 비교` 등)는 그대로 동작.

## CLI Usage

```bash
korean-law "민법 제1조"                # 자연어 → 자동 라우팅
korean-law search_law --query "민법"   # 도구 직접 호출
korean-law                             # REPL 모드
```

상세 사용 예시는 [README.md](./README.md) 참고.

## Domain Knowledge

### 법제처 JO Code (조문번호 6자리)

`AAAABB` 형식 — `AAAA` = 조번호 (zero-padded), `BB` = 의X 번호 (없으면 `00`).
- 제38조 → `003800`
- 제10조의2 → `001002`

### 자치법규 → 상위법령 Fallback 패턴

자치법규(조례/규칙)에 원하는 조항이 없을 때 상위법령으로 검색 우회:

| 키워드 | 상위법령 | 주요 조문 |
|--------|----------|-----------|
| 휴직, 복무, 징계 | 지방공무원법 | 제63조(휴직), 제48조(복무), 제69조(징계) |
| 인사, 임용 | 지방공무원 임용령 | - |
| 급여, 수당 | 지방공무원 보수규정 | - |

검색 체인 예시:
```
search_ordinance("○○구 휴직") → 결과 없음
  ↓
search_law("지방공무원법") → MST 획득
  ↓
get_law_text(mst, jo="006300") → 제63조(휴직) 조회
```

## Critical Rules (코드 기여자용)

1. **법제처 도메인 코드는 신중히 수정** — `search-normalizer.ts`, `law-parser.ts`, `three-tier-parser.ts`, `tools/historical-law.ts` 4개 파일은 본 fork 의 라이선스 위생 작업으로 caller 시그니처 + 법제처 OpenAPI 공개 명세만 참조해 **clean-room 재작성**됨. 수정 시 응답 스키마 재확인 필수 (BSL/Source-Available 코드 도입 금지).
2. **파일 크기 200줄 미만 권장** — 초과 시 `src/lib/`로 분리 (예외: `risk-rules.ts` 는 데이터 선언 위주라 500줄까지 허용).
3. **Zod 스키마 필수** — 모든 도구의 입력은 Zod 로 검증.
4. **도구 추가 시** — `tool-registry.ts` 의 `allTools` 배열에 등록.
5. **`truncateResponse()` 필수** — 모든 도구의 최종 출력은 50KB 제한 적용.
6. **단일 객체 정규화** — 법제처 API 응답의 배열 필드가 단일 객체로 올 수 있음. `Array.isArray(x) ? x : [x]` 패턴 사용.
7. **`cleanHtml()` 재사용** — HTML 엔티티 디코딩은 `article-parser.ts`의 `cleanHtml()` 사용 (수동 디코딩 금지).
8. **`console.log/error` 금지** — STDIO 모드에서 MCP 프레임 간섭 방지. 에러는 `throw` 로 전파.
9. **`String()` 방어 코딩** — MCP 클라이언트가 숫자를 보낼 수 있음. `URLSearchParams.append(key, String(value))` 사용.
10. **캐시 키 분리** — `lawtext:` (law-text.ts, 문자열 캐시), `batch:` (batch-articles.ts, JSON 객체 캐시) — 타입 충돌 금지.
11. **ALIO 런타임은 순수 로컬** — `src/tools/alio/*` 는 네트워크 I/O 금지. 디스크의 manifest/MD 만 읽기. 외부 fetch 는 `npm run alio:sync` 배치에서만.
12. **ALIO 식별자 규칙** — 기관은 `apbaId` (C + 4자리), 규정은 `regId` (= ALIO `idx`). manifest 에 `primaryFileNo` + `revisions[]` 기록.

## Key Files

| 파일 | 역할 |
|------|------|
| `cli.ts` | CLI v2 — 자연어 라우팅 + REPL |
| `tool-registry.ts` | 110개 도구 정의/등록 |
| `lib/query-router.ts` | 자연어 → 도구 자동 라우팅 엔진 |
| `lib/api-client.ts` | 법제처 OpenAPI 클라이언트 |
| `lib/fetch-with-retry.ts` | 30초 타임아웃, 3회 재시도 |
| `lib/session-state.ts` | 멀티세션 API 키 격리 |
| `lib/xml-parser.ts` | 6개 도메인별 XML 파서 |
| `lib/article-parser.ts` | 조문 파서 (`cleanHtml`, `extractHangContent`) |
| `lib/annex-file-parser.ts` | 별표 파일 파싱 — kordoc 통합 위임 (HWPX/HWP/PDF/DOCX/XLSX) |
| `lib/schemas.ts` | `truncateResponse()` (50KB 제한) |
| `lib/alio/client.ts` | ALIO HTTP 클라이언트 (sync 배치 전용) |
| `lib/alio/index-loader.ts` | 런타임 인덱서 (메모리 캐시, TTL 10분) + `findInstitution`, `getCollectedInstitutions` |
| `lib/alio/manifest.ts` | manifest.json 읽기/쓰기 + 콘텐츠 해시 incremental |
| `lib/alio/config.ts` | ALIO 자연어 약어 매핑 환경변수 파싱 (`ALIO_INSTITUTION_ALIASES`) |
| `lib/alio/compare.ts` | 제목 유사도 + 토픽 키워드 확장 |

## Contributing

이슈/PR 환영합니다. 인적 기여 감사글은 [ROADMAP.md § 감사의 말](./ROADMAP.md#-감사의-말) 참고.

## Docs

- [README.md](./README.md) — 사용자 설치/실행/예시 (한글 메인)
- [README-EN.md](./README-EN.md) — English version
- [ROADMAP.md](./ROADMAP.md) — 본 fork 의 변경 동기 + 향후 계획 + 감사의 말
- [CHANGELOG.md](./CHANGELOG.md) — 본 fork 의 변경 이력
- [docs/API.md](./docs/API.md) — 110개 도구 레퍼런스
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 시스템 설계
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 개발 가이드
- [LICENSE](./LICENSE) — MIT
- [NOTICE](./NOTICE) — 의존성 attribution
- **원작자 보존 문서**:
  - [CLAUDE-UPSTREAM.md](./CLAUDE-UPSTREAM.md) — 원작자의 v2.2 시점 CLAUDE.md 원문
  - [CHANGELOG-UPSTREAM.md](./CHANGELOG-UPSTREAM.md) — v2.2.0 까지의 변경 이력
  - [ROADMAP-UPSTREAM.md](./ROADMAP-UPSTREAM.md) — v1.3.0 까지의 로드맵
