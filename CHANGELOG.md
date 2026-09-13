# Changelog — `korean-law-alio-mcp`

---

## [1.3.1] - 2026-09-04

> **ALIO 데이터 전체 현행화 + 배포 채널 3종 릴리스**: 2026-06-06 수집분 이후 3개월간의 신규·개정 공시를 4개 카테고리 전체에 반영 (sync 2026-09-04). 도구 로직 변경 없음. 이어서 2026-09-13 에 버전 트랙을 1.3.1 로 통일하고 Fly.io · GitHub Release · npm 세 채널을 모두 이 데이터/버전으로 릴리스 완료.

### 전체 sync 결과 (355/355 기관, 기관 단위 실패 0)

| 카테고리 | 문서 수 (6/6 → 9/4) | 증감 | 갱신 MD |
|---|---|---|---|
| 내부규정 `regulations` | 35,725 → **35,878** | +153 | 3,633 |
| 단체협약 `labor-agreements` | 918 → **935** | +17 | 20 |
| 임금협약 `wage-agreements` | 1,592 → **1,610** | +18 | 19 |
| 노사협의회 `labor-council` | 6,979 → **7,323** | +344 | 364 |
| **합계** | 45,214 → **45,746** | **+532** | **4,036** |

- "갱신 MD" = 신규 + 개정 반영으로 다시 생성된 markdown. 순증 532건 외 나머지는 기존 문서의 개정본 반영.
- 런타임 로드 검증 — 내부규정 355기관/35,878건, 단체협약 271/935, 임금협약 279/1,610, 노사협의회 350/7,323.
- 소요 시간: 내부규정 약 4시간 20분, 보고서형 3종 25분 (concurrency 3).

### Changed

- **버전 트랙 통일** — `package.json` `1.0.8` → **`1.3.1`**. v1.1.0~v1.3.0 은 CHANGELOG 에만 기록되고 npm/git tag 는 1.0.8 에 머물러 두 트랙이 갈라져 있었음. 이번부터 package.json · git tag · npm · CHANGELOG 를 하나의 번호로 맞춤. README/README-EN 헤더도 v1.3.1 로 갱신.
- **배포 채널 3종 모두 현행화** — 2026-06 이후 코드(보고서형 15개 도구)와 데이터가 Fly.io 원격에만 반영되고 npm/Release 는 5/10 에 멈춰 있던 상태를 해소.
  | 채널 | 이전 | 이후 (2026-09-13 릴리스, 검증 완료) |
  |---|---|---|
  | Fly.io 원격 (`korean-law-alio-mcp.fly.dev`) | 데이터 9/4 (9/4 deploy, v9), 버전 표시 1.0.8 | 데이터 9/4, **1.3.1** (v10) — `GET /` → `"version":"1.3.1"` |
  | GitHub Release `alio-data.tar.gz` (`setup`/`fetch-data` 가 받는 파일) | v1.0.8 (**5/10, 303MB — 보고서형 3종 데이터 전무**) | **v1.3.1 (9/4 데이터, 1.32GB, 4개 카테고리 전체)** — `releases/latest` 가 새 자산으로 리다이렉트 확인 |
  | npm `korean-law-alio-mcp` | 1.0.8 (도구 110개, 5/10) | **1.3.1 (도구 125개)** — `dist-tags.latest = 1.3.1` 확인 |
  | git | tag `v1.0.8` | tag **`v1.3.1`** (`974e76a`) |
- **Dockerfile / .dockerignore 주석·패턴 정리** — 이미지 크기 주석 ~1.3GB → ~2.4GB, 도구 수 23 → 38 반영. `.dockerignore` 의 `data/sync-state.json` 이 실제 경로 `data/alio/sync-state.json` 과 달라 제외되지 않던 것을 수정.

### Fixed

- **ZIP 번들 규정 타임아웃 복구** — 한국마사회 `15505 전임직관리지침`, 한국수자원공사 `8030 계약업무규정` 2건이 규정 단위 5분 타임아웃(`ALIO_REG_TIMEOUT_MS` 기본값)을 초과해 수집 실패. `8030` 은 하위 13개 파일이 든 ZIP 번들이라 파싱에 5분 이상 소요. `ALIO_REG_TIMEOUT_MS=1800000` 으로 재수집해 두 건 모두 복구 (하위 파싱 13/13 성공).

### Known Issues

- **잔존 파싱 실패 28건** (6월 27건 → 28건, 전체의 0.06%). 신규 문서 중 스캔 이미지 PDF 증가분이 반영된 결과이며 docling(tesseract) + ocrmac(Apple Vision) 2단 OCR 로도 복구되지 않음.
  - 내부규정 8건 — HWPX 섹션 누락 1건, 미지원 파일 형식 7건
  - 임금협약 1건 / 노사협의회 19건 — 첨부 전체 파싱 실패 (여수광양항만공사 9건이 최다)
- **`test/law.test.mjs` 2건 실패 — 법제처 검색 순위 의존** — `search_law("민법")` 의 1순위 결과 MST 로 제1조를 요청하는데, 2026-09 현재 법제처 API 가 **난민법**(MST 188376) 을 1순위로 반환해 `get_law_text` / `get_article_detail` 케이스가 `EXTERNAL_API_ERROR` 로 실패. 코드 결함이 아닌 테스트의 외부 순위 의존 문제 (나머지 85건 + 빌드/라우터/CLI/ALIO 스위트 전부 통과). 정확 일치 결과를 고르거나 MST 를 고정하도록 테스트 수정 필요.
- **규정 단위 수집 실패는 sync-state 에 기록되지 않음** — `sync-state.json` 의 `perInstitution` 은 기관 단위 status 만 저장한다. 개별 규정이 네트워크/타임아웃으로 실패하면 기존 manifest entry 를 그대로 유지하므로([alio-sync.ts](./src/scripts/alio-sync.ts) `syncInstitution`) 데이터 유실은 없으나, `parseError` 가 남지 않아 `--retry-failed` 로도 재시도되지 않는다. 현재는 sync 로그의 `! {regId} "{title}" 실패:` 라인으로만 식별 가능.

### Notes

- **ALIO 데이터 배포 채널은 3개이며 서로 독립** — `npm run alio:sync` 만으로는 어느 채널도 갱신되지 않는다. 현행화 절차:
  1. `npm run alio:sync` (카테고리 4종) → CHANGELOG → 커밋 + `git tag vX.Y.Z` + push
  2. **Fly.io**: 로컬에서 `flyctl deploy`. [Dockerfile](./Dockerfile) 이 `COPY data ./data` 로 **로컬 `data/alio/` 를 이미지에 굽는다** (Mode B). `.gitignore` 와 무관하게 `.dockerignore` 가 포함 여부를 결정. 이미지 ~2.4GB, 15~25분.
  3. **GitHub Release**: `cd data && tar --exclude='.DS_Store' --exclude='*.raw.*' --exclude='*.hwp' --exclude='*.hwpx' --exclude='sync-state.json' -czf alio-data.tar.gz alio` → `gh release create vX.Y.Z alio-data.tar.gz --latest`. 최상위가 `alio/` 인 구조를 [setup.ts](./src/scripts/setup.ts) 가 기대함. GitHub 자산 한도 2GB (현재 1.32GB).
  4. **npm**: `npm publish` (코드만 263KB, 데이터 미포함). 계정 2FA 활성 → CLI `npm login` 대신 **Granular Access Token (Read and write + Bypass 2FA)** 을 발급해 임시 `.npmrc` 의 `${NODE_AUTH_TOKEN}` 참조로 publish. Bypass 2FA 없는 토큰은 `403 Two-factor authentication ... required`.
  - GitHub CI([ci.yml](./.github/workflows/ci.yml))는 build + test 만 수행하고 배포하지 않는다. 데이터가 git 에 없으므로 CI 에서 Docker 빌드/배포로 전환하려면 별도 데이터 공급 경로가 필요.
- **sync 소요 시간의 병목은 ALIO 서버 응답 시간** — TCP connect 0.02~0.04초 대비 TTFB 1.0~2.3초. incremental sync 라도 변경 여부 판정을 위해 문서마다 detail 페이지를 1회씩 조회해야 하므로(ALIO 에 "변경분 조회" API 없음) 문서 수 × TTFB ÷ concurrency 가 그대로 소요 시간이 된다. 절약되는 것은 파일 다운로드와 OCR 뿐.

---

## [1.3.0] - 2026-06-06

> **노사협의회 의결사항 카테고리 추가 + 보고서형 PoC 완료**: 단체협약·임금협약에 이어 세 번째 보고서형 카테고리 "노사협의회 의결사항" (reportFormRootNo=21028) 도입. 이로써 보고서형 3종 = 15개 도구 완비.

### Added

- **노사협의회 의결사항 5개 도구** (`reportFormRootNo=21028`, 보고서형) — `search_institution_labor_council` / `list_alio_labor_council` / `get_alio_labor_council` / `search_alio_labor_council_text` / `compare_alio_labor_council`. [descriptors.ts](./src/tools/alio-report/descriptors.ts) 에 descriptor 추가만으로 생성 (팩토리 재사용).
- **자연어 라우팅** — `"노사협의회 복리후생 검색"`, `"노사협의회 의결사항 비교"` 등 5패턴 (`reportCategoryRoutes` 로 생성).

### 전체 sync 검증 (docling OCR + ZIP unwrap)

- 355/355 기관, disclosure **6,975건** (보고서형 중 최대 규모). 첨부파일 단위 **9,080/9,156 성공 (99.2%)**, docling fallback 4,558건. 잔존 실패 76건 (대부분 docling 도 못 읽는 스캔 이미지 PDF).
- 런타임 로드: 343개 기관 / 6,975 entries.

### Changed

- **도구 수**: 120 → **125** (87 + 23 + 보고서형 15).

---

## [1.2.0] - 2026-06-06

> **임금협약 카테고리 추가 + 보고서형 도구 팩토리 통합**: 두 번째 보고서형 카테고리 "임금협약" (reportFormRootNo=21027) 도입. 동시에 단체협약/임금협약/노사협의회가 구조적으로 동일함을 활용해 5개 도구 로직을 단일 팩토리로 통합 — 카테고리당 코드 복제 제거.

### Added

- **임금협약 5개 도구** (`reportFormRootNo=21027`, 보고서형) — `search_institution_wage_agreements` / `list_alio_wage_agreements` / `get_alio_wage_agreement` / `search_alio_wage_agreement_text` / `compare_alio_wage_agreements`.
- **자연어 라우팅** — `"공공기관 임금협약 성과급 비교"`, `"임금협약 있는 공공기관"` 등 5패턴.

### Changed

- **보고서형 도구 팩토리화** ([src/tools/alio-report/](./src/tools/alio-report/)) — `category-tools.ts` 의 `buildReportCategoryTools(descriptor)` 가 카테고리 descriptor 를 받아 5개 도구(schema+handler) 생성. v1.1.0 의 `src/tools/alio-labor/` 개별 5파일(~600줄)을 팩토리로 통합, 단체협약도 동일 코드경로 사용.
- **라우팅 팩토리화** — `query-router.ts` 의 `reportCategoryRoutes()` 가 카테고리별 5개 라우팅 패턴 생성. 3개 카테고리 모두 동일 헬퍼로 생성.
- **도구 수**: 115 → **120** (임금협약 5개 추가).

### 전체 sync 검증 (docling OCR + ZIP unwrap)

- 355/355 기관, disclosure 1,592건. 첨부파일 단위 **2,503/2,533 성공 (98.8%)**, docling fallback 1,506건. 잔존 실패 30건. 런타임 로드: 278개 기관 / 1,573 entries.

---

## [1.1.0] - 2026-06-05

> **ALIO 공시 카테고리 확장 시작 — 단체협약 PoC**: 기존 "정관 및 내부규정" (reportFormRootNo=21110) 1개 카테고리만 지원하던 sync/도구 파이프라인을 일반화. 첫 신규 카테고리로 "단체협약" (21026) 도입. v1.2.0 임금협약, v1.3.0 노사협의회 의결사항 순차 확장 예정.

### Added

- **단체협약 (Collective Bargaining Agreements) 5개 도구** (v1.2.0 에서 [src/tools/alio-report/](./src/tools/alio-report/) 팩토리로 통합) — `reportFormRootNo=21026`, 보고서형 (`reportGbn=Y`, 연도별 보고서 + N개 첨부파일):
  - `search_institution_labor_agreements` — 단체협약 보유 기관 검색
  - `list_alio_labor_agreements` — 기관의 단체협약 목록
  - `get_alio_labor_agreement` — 단체협약 본문 (한 disclosure = 협약서 PDF + 주요내용 HWP + 신구대비표 등 모든 첨부 1개 MD 로 concat). `attachment` 인자로 특정 첨부 섹션만 추출 가능
  - `search_alio_labor_agreement_text` — 단체협약 본문 전문 검색
  - `compare_alio_labor_agreements` — 기관간 단체협약 토픽 비교 (휴가/수당/교섭 등)
- **`--category` CLI 옵션** ([src/scripts/alio-sync.ts](./src/scripts/alio-sync.ts)) — `npm run alio:sync -- --category labor-agreements` 로 단체협약 sync. default `regulations` (기존 동작 그대로).
- **자연어 라우팅 패턴 5개** ([src/lib/query-router.ts](./src/lib/query-router.ts)):
  - `"한국방송통신전파진흥원 단체협약"` → `list_alio_labor_agreements`
  - `"공공기관 단체협약 비교"` → `compare_alio_labor_agreements`
  - `"단체협약 시간외근로 검색"` → `search_alio_labor_agreement_text`
  - `"단체협약 있는 공공기관"` → `search_institution_labor_agreements`
  - 기관 식별자 (alias / apbaId) + 단체협약 조합도 동일 분기

### Changed

- **데이터 저장 구조 — 카테고리별 디렉터리 분리**:
  - 내부규정 (기존): `{apbaId}/manifest.json` + `{apbaId}/regulations/{regId}.md` (변경 없음 — backward compat)
  - 단체협약 (신규): `{apbaId}/labor-agreements/manifest.json` + `{apbaId}/labor-agreements/{disclosureNo}.md`
- **`ensureAlioData` / runtime 경로 해석**: regulations 디폴트로 위임해서 기존 23개 도구는 코드 변경 없이 동작. 신규 5개 도구는 `loadIndex("labor-agreements")` 명시.
- **README/CLAUDE.md 도구 수 갱신**: 110 → 115 (87 + 23 + 5).

### Internal

- `client.ts`: `listRegulations(apbaId, pageNo, apbaType, reportFormRootNo=21110)` — 마지막 인자 추가. 보고서형 전용 함수 신설 `getReportDisclosureFiles(disclosureNo)` + `downloadReportFile(fileNo, disclosureNo, submissionNo)`. URL 패턴: detail = `/item/itemReport.do?seq=...`, download = `/download/file.json?f=&d=&s=`.
- `paths.ts`: `AlioCategory` type + `categoryManifestPath(apbaId, category)` + `categoryDocMdPath(apbaId, docId, category)` helper. 기존 `manifestPath` / `regulationMdPath` 는 `regulations` default 로 위임.
- `types.ts`: `Manifest.category?: AlioCategory` 추가. `RegulationListItem` 에 `disclosureNo`/`submissionNo` 옵션 필드 추가 (보고서형용).
- `manifest.ts`: `readCategoryManifest` / `writeCategoryManifest` 추가.
- `index-loader.ts`: `loadIndex(category="regulations")` 로 카테고리별 인메모리 캐시 분리. `readCategoryDocMd` 추가.
- 테스트 기대값 갱신 (110 → 115, ALIO 23 → 28).

### 데이터 사이즈 — PoC 결과

KCA (C0187) 단일 기관 단체협약 1건 측정: 3개 첨부 (PDF 1.6MB + HWP 2개) → 1.8MB / 1 MD. 내부규정 대비 훨씬 작음 (기관당 ~1-3건). 전체 ~344개 기관 sync 시 예상 ~수십-수백 MB (내부규정 1.3GB 대비 매우 가벼움).

---

## [1.0.8] - 2026-05-10

> **Setup wizard 메시지 정리 + 안전성 강화 + README 개선**: 미감지 클라이언트 자동 등록 방지, 모드별 trade-off 명시, 방법 2 안내 callout + 스크린샷.

### Changed (Setup wizard)

- **Step 3 (클라이언트 선택) — 감지된 항목만 선택 가능** ([src/scripts/setup.ts](./src/scripts/setup.ts)) — 이전엔 미감지 항목도 입력 가능 (config 파일 없는 클라이언트에 등록 시 무의미). 이제 검증 통과 못 함 + `감지됨: 1,3` 명시. 감지 0건이면 prompt 없이 자동으로 수동 안내로 전환.
- **Banner subtitle 단순화**: `법제처 87 + ALIO 23 = 110개 도구 · 자연어 자동 라우팅 + cross-domain 브리지` → `법제처 법령과 ALIO 공공기관 내부규정의 데이터를 연계`.
- **Step 1**: `IP/도메인 등록은 비워두는 것을 권장` 부가 안내 줄 제거 (불필요).
- **Step 2 모드 설명에 trade-off 추가**:
  - 로컬: `자기 PC 에서 실행 - 안정적, 빠름`
  - 원격: `원격 서버에서 실행 - 약간 느림`
- **printComplete 로컬 모드 단순화**: `ALIO 데이터 위치 / 갱신 안내` 2줄 → `v{VERSION} 으로 설치가 완료되었습니다.` 한 줄.

### Changed (README)

- **방법 1 헤더**: `(가장 권장)` → `(안정적, 권장)`. 안정성 강조로 표현 정렬.
- **방법 2 헤더**: `⭐` 추가 + `(간편함, 권장)` → `(간편함)` + `Claude.ai 웹` → `https://claude.ai/ 웹` (풀 URL 표기). 권장 표시는 방법 1 만.
- **방법 2 등록 절차** — 5단계 절차를 GitHub `[!IMPORTANT]` callout (보라색 좌측 테두리 + 종 아이콘) 으로 강조.
- **방법 2 안내 스크린샷 첨부** ([claude-connector.png](./claude-connector.png)) — Claude.ai 의 "커스텀 커넥터 추가" 다이얼로그. HTML `<img width="400">` 로 표시 크기만 작게, 파일은 900px 유지 (선명함 보장).
- **방법 2 ⚠️ 주의사항 추가** — Claude Desktop 에서는 커스텀 커넥터로 추가 시 동작 오류 발생, 반드시 [방법 1](#method-1) 로 추가 권장. (`<a id="method-1"></a>` HTML 앵커로 안전한 jump link)
- **예시 섹션 헤더 명확화** — `두 영역을 잇는 자연어 질의` → `📜 법제처의 법률정보와 🏢 알리오의 공공기관 내부규정을 잇는 자연어 질의`. emoji 마커로 두 데이터 소스 시각 구분 (GitHub 가 임의 글자 색 변경 미지원).
- 한국어 + 영문 README 동기화.

### Internal

- `detectInstallMethod()` 함수 삭제 — printComplete 단순화로 npx vs global 분기 불필요.
- `printComplete(apiKey, mode, dataDir)` → `printComplete(apiKey, mode)` (인자 1개 제거).
- `alioDataDestination` 변수 삭제.
- `VERSION` import 추가 (printComplete 메시지의 버전 표시용).

---

## [1.0.7] - 2026-05-09

> **Setup wizard 입력 검증 강화** — 범위 밖 값을 조용히 무시/fallback 하던 동작을 명시적 재요청으로.

### Fixed

- **Step 2 (운영 모드)**: `1` / `2` 외 값 입력 시 이전엔 조용히 원격 모드로 fallback → 이제 빨간 경고 + 재요청. 로컬 빌드 미감지 + `1` 선택 시 `원격 모드 (로컬 빌드 미감지로 자동 전환)` 으로 명시적 안내.
- **Step 3 (MCP 클라이언트)**: `1,99,abc` 같이 잘못된 토큰 포함 입력 시 이전엔 유효한 `1` 만 살리고 나머지 무시 → 이제 어느 토큰이 유효 범위 밖인지 보여주고 전체 재요청. `^\d+$` 정규식 + `1 ~ clients.length` 범위 검증. `0` (수동 안내) 은 escape hatch 유지.

---

## [1.0.6] - 2026-05-09

> **`uninstall` 서브커맨드 신설**: 설치 흔적을 한 번에 정리할 수 있는 명령 추가 — 클라이언트 설정 / ALIO 데이터 / npx 캐시 일괄.

### Added

- **`uninstall` 서브커맨드** ([src/scripts/uninstall.ts](./src/scripts/uninstall.ts)) — 사용 예: `npx korean-law-alio-mcp@latest uninstall` 또는 `korean-law-alio-mcp uninstall` (글로벌 설치).

  동작:
  1. **검사** — 다음 영역 스캔 후 사용자에게 미리 보여줌
     - 모든 MCP 클라이언트 설정 파일 (Claude Desktop / Claude Code / Cursor / VS Code / Windsurf) 에서 `korean-law-alio` 항목 발견 여부
     - ALIO 데이터 디렉터리 (`~/.korean-law-alio-mcp/`)
     - 우리 패키지가 들어있는 모든 npx 캐시 (`~/.npm/_npx/*/`)
     - 회수 가능 사이즈 표시
  2. **확인 prompt** — 기본 `[y/N]`, 실수 방지로 No 가 default
  3. **제거 실행**:
     - 클라이언트 설정에서 `korean-law-alio` 키만 삭제 (다른 MCP 서버는 보존)
     - ALIO 데이터 디렉터리 통째 삭제
     - npx 캐시 디렉터리 통째 삭제 (단, 자기 자신이 실행 중인 캐시는 OS 가 사용 중이라 제외 → 안내 출력)
  4. **수동 정리 안내** — 현재 캐시 / 글로벌 설치 / `LAW_OC` 환경변수

### Changed

- **README 방법 1 끝에 참고사항 blockquote 추가** — `fetch-data` (데이터 갱신) + `uninstall` (제거) 명령 발견 가능하도록 노출. 한국어 + 영문 README 동기화.

### Internal

- `detectClients()` / `ClientConfig` 인터페이스를 setup.ts 에서 export — uninstall 이 같은 클라이언트 목록 재사용.

---

## [1.0.5] - 2026-05-09

> **Setup wizard UX 정리 + ALIO 데이터 갱신 인터랙션 추가**: 입력 필수화 / 디폴트값 자동 입력 / 기존 데이터 발견 시 prompt 갱신 / 잘못된 안내 정정.

### Changed

- **Setup wizard 입력 처리 강화**:
  - **Step 1 (API 키)**: 필수 입력 — Enter skip 제거, 빈 값이면 빨간 경고 + 재요청 (Ctrl+C 로만 종료)
  - **Step 2 (모드)**: `(기본 1)` → `[기본=1]` 표기 명확화
  - **Step 3 (클라이언트)**: 감지된 항목들이 자동 디폴트 (예: `[기본=감지된 1,3]`). Enter → 디폴트 사용. `0` 입력 시만 manual 안내. 빈/잘못된 입력은 재요청
- **ALIO 데이터 단계가 기존 데이터 발견 시 prompt 표시**:
  - 이전: 무조건 스킵 → 사용자가 갱신하려면 별도 명령 필요
  - 이후: `이전 ALIO 데이터가 있습니다. 최신 데이터로 갱신하겠습니까? [Y/n]:` (Enter / y / yes = 갱신, n / no / 아니오 = 기존 유지)
  - 안전장치: 다운로드 성공한 뒤에야 기존 데이터 wipe (실패 시 기존 보존)
- **`fetch-data` 항상 갱신**: 이전엔 데이터 있으면 스킵 → "rm + fetch-data" 두 단계 필요. 이후 fetch-data 호출 = 항상 갱신 (안전 교체).
- **printComplete 가 install method 감지** ([src/scripts/setup.ts](./src/scripts/setup.ts)) — `import.meta.url` 경로로 npx / global / dev clone 구분해 알맞은 갱신 명령 표시:
  - npx 사용자: `npx korean-law-alio-mcp@latest fetch-data`
  - 글로벌 사용자: `korean-law-alio-mcp fetch-data`
- **로컬 모드 안내 개선**: 실제 ALIO 데이터 destination 경로 표시 (이전엔 `data/alio/` 하드코딩)

### Fixed

- **도구 에러 메시지의 stale `npm run alio:sync` 안내 정정** (9개 파일) — npm install -g / npx 사용자에겐 동작 안 함. 모두 `korean-law-alio-mcp fetch-data` (또는 `npx ... fetch-data`) 로 정정. 영향 파일: recent-revisions, statistics, compare-timeline, compare-regulations, search-institution, suggest-benchmark, list-regulations, institution-profile, get-regulation.
- **README Highlights** (`npm run alio:sync` → `korean-law-alio-mcp fetch-data`) — KO/EN 동기화

### Internal

- `ensureAlioData(dataDir, options?)` → `ensureAlioData(dataDir)` — `force` 옵션 제거. 이제 함수는 항상 다운로드 후 안전 교체. 호출자가 "갱신할지" 결정한 뒤 부르는 함수로 단순화.
- `detectInstallMethod()` 헬퍼 신설 — printComplete 의 명령 표기에 사용.

---

## [1.0.4] - 2026-05-09

> **Setup wizard 가 ALIO 데이터를 npx 캐시 대신 사용자 홈에 받도록 — 버전 업그레이드마다 1.3GB 중복 다운로드 회피.**

### Changed

- **Setup wizard ALIO 데이터 destination 변경** ([src/scripts/setup.ts](./src/scripts/setup.ts)) — 이전엔 항상 패키지 루트 (`<pkgRoot>/data/alio`) 에 받음. npx 캐시는 새 버전마다 새 hash 디렉터리 (`~/.npm/_npx/<hash>/`) 라서 setup 마다 1.3GB 가 새로 받혀 누적됨.

  새 우선순위:
  1. **dev clone 감지** — 패키지 루트 `data/alio/institutions.json` 이 이미 있으면 그것 재사용
  2. **그 외 (npx / 글로벌 설치)** — `~/.korean-law-alio-mcp/data/alio/` (사용자 홈) 에 받음

  → npx 로 새 버전 setup 해도 이미 받아둔 user home 데이터 재사용 (skip). 디스크 절약. v1.0.3 의 `paths.ts` user home 폴백 로직과 짝을 이룸.

### Background

v1.0.3 까지 사용자 머신에 npx 캐시가 누적되는 문제 발견 — 예를 들어 v1.0.0 + v1.0.3 두 캐시가 각각 ~750MB / ~2.1GB 차지 (둘 다 ALIO 데이터 1.3GB 중복 포함). 본 변경으로 이후 release 부터는 새 캐시에 데이터 다운로드 안 함. **이전 캐시는 수동 정리 필요**: `rm -rf ~/.npm/_npx/<old-hash>` (기존 v1.0.0 ~ v1.0.3 캐시).

---

## [1.0.3] - 2026-05-09

> **`npm install -g` 사용자를 위한 ALIO 데이터 자동 받기 + README 다듬기**: `fetch-data` 서브커맨드 신설 — 글로벌 설치 후 코드와 별개로 ~300MB ALIO 데이터를 sudo 없이 사용자 홈에 받을 수 있게. README 도 v1.0.2 게시 후 누적된 정리 한꺼번에 반영.

### Added

- **`fetch-data` 서브커맨드 신설** ([src/scripts/fetch-data.ts](./src/scripts/fetch-data.ts)) — `npm install -g korean-law-alio-mcp` 만으로는 받지 못하던 ~300MB ALIO 데이터를 한 줄로 받게. 흐름:
  ```bash
  npm install -g korean-law-alio-mcp
  korean-law-alio-mcp fetch-data
  ```
  - 기본 다운로드 위치: `~/.korean-law-alio-mcp/data/alio/` (사용자 홈 — sudo 불필요)
  - `ALIO_DATA_DIR` 환경변수가 있으면 그 경로로
  - 이미 데이터가 있으면 다운로드 스킵
  - tar.gz 의 `alio/` 래퍼 자동 flatten — 716116b 와 동일 로직 재사용
- **runtime ALIO 경로 해석에 user home fallback 추가** ([src/lib/alio/paths.ts](./src/lib/alio/paths.ts)) — 우선순위:
  1. `ALIO_DATA_DIR` 환경변수
  2. 패키지 루트의 `data/alio/` (dev clone / npx 캐시 / docker baked)
  3. `~/.korean-law-alio-mcp/data/alio/` (npm install -g + fetch-data 시나리오)

  → `fetch-data` 후 별도 환경변수 설정 없이 CLI/MCP 가 알아서 사용자 홈을 찾아냄.

### Changed

- **README 방법 4 (터미널/CLI)**: `npx + alias` 패턴 → `npm install -g` + `fetch-data` 3 줄 흐름. 별칭 등록 부담 제거, 매일 쓰는 사용자에게 더 자연스러움.
- **README 방법 1 강조**: `npx korean-law-alio-mcp setup` 코드 블록을 GitHub `[!IMPORTANT]` callout 안에 임베드 — 보라색 좌측 테두리로 "설치 핵심" 시각 강조.
- **README 구조 정비** (v1.0.2 publish 후 누적):
  - 설치 가이드 5개 → 4개 (방법 4: 직접 설치 통합/제거)
  - "방법 1 — 데스크탑/IDE npx" 가 가장 권장 (⭐ 표시), Claude.ai 웹 (방법 2), Claude Code 플러그인 (방법 3), 터미널 CLI (방법 4) 순
  - 사전 준비 1: API 키 / 사전 준비 2: Node.js 설치 (권장) — 로컬 vs 원격 trade-off (속도/안정성) 명시
  - 위임범위 검토 시나리오로 예시 query 교체 — 컴플라이언스 검토에 더 적합
  - 헤더 `v1.0.2` → `v1.0.3`

### Internal

- `ensureAlioData(pkgRoot)` → `ensureAlioData(dataDir)` 로 시그니처 단순화 + export. 이제 setup wizard (패키지 루트) 와 fetch-data (사용자 홈) 양쪽이 같은 함수 재사용.
- `index.ts` 에 `fetch-data` 서브커맨드 분기 추가 — `setup` 과 같은 패턴.

---

## [1.0.2] - 2026-05-09

> **로컬 모드 우선 권장**: setup wizard 의 모드 선택 순서를 **1) 로컬 / 2) 원격** 으로 swap, Enter(기본) 입력 시 로컬이 선택되도록. 원격 모드는 Anthropic 측 [#211 버그](https://github.com/anthropics/claude-ai-mcp/issues/211) + fly.io auto-suspend 콜드스타트로 첫 호출 timeout 빈발 → 사용자 경험상 로컬을 권장하는 입장 반영. 코드 동작/도구 추가 없음 — wizard messaging 만 변경.

### Changed

- **모드 선택 순서 swap — 1) 로컬, 2) 원격** ([75faa81](https://github.com/scvcoder/korean-law-alio-mcp/commit/75faa81)) — Enter(기본) 입력 시 이전엔 원격이 선택됐으나 이제 로컬 선택. 로컬 빌드 미감지 시에는 자동 원격 fallback 유지 (else 분기) — `npx korean-law-alio-mcp setup` 같은 일회성 호출에선 여전히 원격이 자연스럽게 선택됨.
- **원격 모드 안내 문구 갱신** ([068c0aa](https://github.com/scvcoder/korean-law-alio-mcp/commit/068c0aa)) — 운영 책임/한계를 명시적으로:
  - 이전: `best-effort 사용 / 응답의 fetchedAt 으로 시점 확인 권장. 자세한 책임 분담은 NOTICE 참고`
  - 이후: `주기적으로 갱신하고 mcp 서버를 운영 / 운영비 문제로 종료 또는 서버가 변경될 수 있음`
- **로컬 모드 안내 간결화** ([b3086bd](https://github.com/scvcoder/korean-law-alio-mcp/commit/b3086bd)) — `(이 빌드)` 표기 제거 (사용자에게 의미 불명확), `자기 PC 에서 실행 — ALIO 데이터 별도 준비 필요` → `자기 PC 에서 실행` (716116b 부터 ALIO 데이터 자동 다운로드되어 별도 준비 불필요).

### Background

본 fork 의 운영자는 사용자에게 **로컬 모드를 권장하는 입장**. 원격 모드는 운영자 부담 + 안정성 한계 (#211, 콜드스타트 timeout) 가 있어 wizard 의 default 도 로컬로 정렬. 원격 안정성이 개선되면 (Anthropic fix 또는 우리 인프라 변경) 본 정책 재검토 가능.

---

## [1.0.1] - 2026-05-09

> **데스크탑 호환성 + 로컬 설치 자동화**: Claude.ai 원격 MCP / Claude Desktop 의 streamable-HTTP transport 호환성 이슈 해결, 로컬 모드 setup 의 마지막 수동 단계 (ALIO 데이터 다운로드) 자동화. 새 도구 추가 없음 — 호환성 + UX 개선.

### Fixed

- **HTTP transport 를 stateless 로 전환** ([bb7b115](https://github.com/scvcoder/korean-law-alio-mcp/commit/bb7b115)) — 세션 ID 기반 stateful 모드는 Fly.io `auto_stop_machines='suspend'` 와 상극. 머신이 잠들면 in-memory `sessions` Map 이 통째로 사라지고, Claude.ai 가 cached session ID 로 재호출하면 404 → "Tool result could not be submitted" 에러. 매 POST 요청마다 fresh `Server` + `Transport` 생성, `AsyncLocalStorage` 의 `requestContext` 로 API 키 격리. 세션 Map / EventStore / idle cleanup 전부 제거 → 재시작/스케일아웃/OOM 내성. dead code 였던 `src/server/sse-server.ts` 삭제 (494 lines deleted).
- **setup wizard 가 Claude Desktop 에 잘못된 형식 등록** ([d31be33](https://github.com/scvcoder/korean-law-alio-mcp/commit/d31be33)) — 원격 모드일 때 모든 클라이언트에 `{url}` 필드로 썼지만 Claude Desktop 의 `mcpServers` 는 `url` 을 지원 안 함 (stdio 전용) → "유효한 MCP 서버 구성이 아님" 으로 무시됨. 이제 클라이언트별 분기:
  - Claude Desktop → `{ command: "npx", args: ["mcp-remote", url] }`
  - 그 외 (Cursor / Windsurf / Claude Code / VS Code) → `{ url }` 유지

### Added

- **로컬 모드 setup 에서 ALIO 데이터 자동 다운로드** ([716116b](https://github.com/scvcoder/korean-law-alio-mcp/commit/716116b)) — 이전에는 wizard 종료 후 사용자가 GitHub releases 에서 `alio-data.tar.gz` 를 직접 받아 압축 풀어야 했음. 이제 setup 마지막 단계에서 자동으로:
  1. 패키지 루트의 `data/alio/institutions.json` 존재 여부 체크 (있으면 스킵)
  2. release latest 의 `alio-data.tar.gz` 스트리밍 다운로드 (2% 단위 진행률 표시)
  3. system `tar` 로 압축 해제
  4. tarball 의 `alio/` 래퍼 자동 flatten → `data/alio/*` 평탄 구조

  실패 시 `curl + mkdir + tar` fallback 명령 안내. tar 미설치 (Win 구버전) 도 별도 에러 메시지로 식별.

### Changed

- **ALIO 인덱스 startup preload + POST /mcp 응답 시간 로깅** ([842ceaf](https://github.com/scvcoder/korean-law-alio-mcp/commit/842ceaf)) — 콜드스타트 후 첫 ALIO 도구 호출이 manifest 디스크 I/O 로 ~4초 걸려 데스크탑 표시 timeout 에 걸리는 문제 회피. `app.listen` 직전에 `await loadIndex()` 한 번 호출. 부팅이 1-2초 길어지지만 fly proxy 가 listen 까지 대기해서 클라이언트 영향 없음. 각 POST /mcp 의 RPC method + status + duration 로깅 추가.
- **`RATE_LIMIT_RPM=300` 으로 정렬** ([556cc5b](https://github.com/scvcoder/korean-law-alio-mcp/commit/556cc5b)) — 업스트림 (chrisryugj/korean-law-mcp) 배포 설정과 일치 (기본 60 → 300).
- **Claude Code plugin marketplace 활성화** ([5010406](https://github.com/scvcoder/korean-law-alio-mcp/commit/5010406)) — `.claude-plugin/marketplace.json` 추가, Claude Code 의 plugin marketplace 등록 가능.

### Docs

- **README — Claude Desktop 은 mcp-remote stdio 브릿지 안내** ([9e8ae5f](https://github.com/scvcoder/korean-law-alio-mcp/commit/9e8ae5f)) — 방법 3 (AI 데스크탑) 을 두 하위섹션으로 분리: Claude Desktop 은 [#211 버그](https://github.com/anthropics/claude-ai-mcp/issues/211) 안내 + `mcp-remote` 형태, Cursor/Windsurf 는 기존 `url` 형태 유지. README.md + README-EN.md 둘 다 갱신.
- **README badges + 한↔영 상호 링크 + Highlights 섹션 정리** ([4a1ae7a](https://github.com/scvcoder/korean-law-alio-mcp/commit/4a1ae7a), [b468577](https://github.com/scvcoder/korean-law-alio-mcp/commit/b468577), [e4ac35a](https://github.com/scvcoder/korean-law-alio-mcp/commit/e4ac35a), [590f31b](https://github.com/scvcoder/korean-law-alio-mcp/commit/590f31b)).

### CI

- **자동 테스트 단계 추가** ([d66c286](https://github.com/scvcoder/korean-law-alio-mcp/commit/d66c286)) — `.github/workflows/ci.yml` 에 build 후 `node test/index.mjs` 실행 (87 cases).

### Background — Claude Desktop "Tool result could not be submitted" 배너

본 버전의 데스크탑 호환성 작업은 Anthropic 측 [알려진 버그 #211](https://github.com/anthropics/claude-ai-mcp/issues/211) (streamable-HTTP transport 의 SSE close race) 의 회피책. Anthropic 의 fix 가 들어오기 전까지 데스크탑은 mcp-remote stdio 브릿지 사용 권장.

---

## [1.0.0] - 2026-04-26

> 본 fork 는 2026-04-25 일자로 [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) v2.2 에서 fork 되었습니다.
> **본 파일은 fork 이후의 변경 이력만 담습니다.** v2.2.0 까지의 원작자 변경 이력은 [CHANGELOG-UPSTREAM.md](./CHANGELOG-UPSTREAM.md) 참고.

> **Fork + 리네이밍**: `korean-law-mcp` → `korean-law-alio-mcp`
> 법제처 87개 도구 위에 ALIO 공공기관 내부규정 통합 + 라이선스 위생 + 일반화 작업.
> **첫 안정 릴리스** — 141 cases 자동 테스트 통과 + per-regulation timeout/retry 안전망 + 자동 docling fallback 통합. SemVer 1.0 으로 안정 API 약속.

### Added — ALIO 공공기관 내부규정 통합

- **데이터 파이프라인** (`npm run alio:sync`)
  - ALIO 공시 전체 ~344개 공공기관 / 35,208건 내부규정 수집
  - manifest.json 기반 incremental sync (콘텐츠 해시 비교)
  - 실패/재시도/중단복구 (`--resume`, `--retry-failed`, `--retry-fallback`)
- **MCP 도구 23개** — 법제처 87개 도구 패턴을 ALIO 데이터에 적용 (중복 도메인은 법제처 도구 그대로 재사용):

  *조회·검색·자동완성*
  - `search_institution` — 기관명⇄apbaId 양방향 검색
  - `list_alio_regulations` — 기관별 규정 목록
  - `get_alio_regulation` — 규정 본문 / 특정 조문 조회
  - `search_alio_regulation_text` — 전체 규정 본문 키워드 전문검색
  - `suggest_alio_regulation_names` — 규정 제목 자동완성/부분일치
  - `advanced_alio_search` — 분류·기관유형·주무부처·기간·키워드 복합 필터

  *비교·분석*
  - `compare_alio_regulations` — 토픽 기준 N:N 기관간 조문 비교
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
  - `get_alio_statistics` — 수집 데이터 통계 (기관·규정 수, 분류 분포, 개정 빈도)
  - `get_alio_institution_profile` — 한 기관의 규정 체계 요약
  - `analyze_alio_regulation` — 한 규정의 메타 + 구조(조문 수, 별표 수) + 목차

  *본문 구조·연결*
  - `get_alio_annexes` — 규정 본문에서 [별표 N] 추출
  - `parse_alio_article_links` — 본문의 "제N조" 참조 추출 + 위치 매칭
  - `get_alio_external_links` — ALIO 원본 페이지 + 첨부 다운로드 링크
  - `get_batch_alio_regulations` — 여러 규정/조문 일괄 조회 (최대 20건)

  *체인 (도구 조합)*
  - `chain_alio_benchmark` — 프로파일 + 토픽 매칭 + 동종 기관 갭 분석을 한 번에
- **6단계 파싱 폴백 체인**
  1. kordoc 직접 (HWP/HWPX/PDF) — 일반 케이스 34,908건
  2. docling + tesseract OCR — 스캔 이미지 PDF 261건
  3. soffice + docling DOCX — HWP 3.0 구포맷 10건 (본문만)
  4. soffice + docling XLSX — Excel 별표 1건
  5. JSZip 재귀 언랩 + concat — 묶음 ZIP 1건
  6. parseError 기록 — 24건 (DRM·빈 스캔본 등 원본 한계)
  - **최종 파싱 성공률: 99.923%** (35,181 / 35,208)
- **OCR 출처 배지** — MCP 응답에 `[OCR:docling]` 등 변환 출처 표시
- 자연어 query-router 에 ALIO 키워드 패턴 추가 (공공기관 약어, "공공기관 규정 비교" 등)

### Added — 외부 도구 의존성 (선택)

- LibreOffice (`soffice`) — HWP 3.0 / Excel 변환
- docling (Python CLI) — OCR / DOCX / XLSX 파싱
- tesseract + tesseract-lang — OCR 엔진 (한글)

### Changed

- **패키지명** `korean-law-mcp` → `korean-law-alio-mcp`
- **bin** `korean-law-mcp` / `korean-law` → `korean-law-alio-mcp` / `korean-law-alio`
- **kordoc 메이저 업그레이드** `1.6.1` → `2.5.2` (PDF "subOps is not iterable" 등 다수 버그 수정 + hwpml/xlsx/docx 추가 지원)
- **자체 파서 5개 → kordoc 통합 파서로 교체** — `lib/hwpx-parser.ts`, `lib/hwp5-parser.ts`, `lib/pdf-parser.ts` 등 제거. `lib/annex-file-parser.ts` 가 [kordoc](https://github.com/chrisryugj/kordoc) 으로 위임
- **ALIO 비교 도구 — 사용자 자연어에 위임**: `institutions`/`peers` 인자 미지정 시 수집된 전체 기관 자동 비교. 비교 세트를 환경변수에 박지 않음 (사용자가 "A·B·C 기관과 비교", "랜덤", "전체" 같이 자유롭게 표현 → LLM이 인자 만들거나 비움)
- `data/alio/` 디렉터리 추가 + `.gitignore` 등록 (1.1GB 재생성 가능)

### Security / License Hygiene

- **4개 도메인 파일 clean-room 재작성** — BSL 1.1 라이선스 코드와의 결합 회피
  - `src/lib/search-normalizer.ts` — 법령 검색어 정규화·약칭 해결
  - `src/lib/law-parser.ts` — JO 코드(AAAABB / AABBCC) 변환
  - `src/lib/three-tier-parser.ts` — 법제처 3단비교 응답 파서
  - `src/tools/historical-law.ts` — 연혁법령 검색·본문 조회
- 각 파일은 caller 시그니처 + 법제처 OpenAPI 공개 명세만 참조하여 작성
- 약칭 사전은 법제처 공식 약칭 페이지(공개 자료)에서 직접 정리
- 결과: 본 프로젝트는 외부 BSL/Source-Available 코드를 포함하지 않음. 모든 자체 코드는 **MIT** 단일 라이선스

### Docs

- 한글 README 기본화 (`README.md` = 한글, `README-EN.md` = English)
- 인트로 데모 GIF 추가 + README 참조
- 원작자 보존 문서 분리: [CLAUDE-UPSTREAM.md](./CLAUDE-UPSTREAM.md), [CHANGELOG-UPSTREAM.md](./CHANGELOG-UPSTREAM.md), [ROADMAP-UPSTREAM.md](./ROADMAP-UPSTREAM.md)
- **두 운영 모드 정책 명시** ([NOTICE](./NOTICE) "Data sources" 섹션):
  - Local MCP (STDIO) — 사용자가 자기 환경에서 sync, 모든 책임 사용자
  - Remote MCP (HTTP/SSE) — 운영자(scvcoder) 가 비영리·자발적으로 **무료** 운영. sync 주기를 약속하지 않으며(best-effort), 모든 응답에 `fetchedAt` 와 `sourceDetailUrl` 보존하여 사용자가 원본 검증 가능. 스냅샷과 ALIO 현재 게시본의 차이로 인한 결과는 전적으로 사용자 책임. AS-IS / AS-AVAILABLE 제공, 한국 민법상 무상 제공자 면책 범위에서 모든 책임 배제(고의·중과실 제외)
  - 두 모드 모두 저작권법 §24-2 + 공공데이터법 §3 자유이용 원칙 하에 동작

### Known Limitations

- **DRM 암호화** 7건 (DRMONE / DOCUMENTSAFER) — 원본 기관 정책에 의존, 우리가 해결 불가
- **빈 스캔 PDF** 16건 — OCR이 0~수자만 추출 (원본 품질 한계)
- **HWP 3.0 표** — LibreOffice 필터가 표 구조를 변환 못함 (본문만 복원)
- 위 27건이 35,208건 중 미파싱 잔존 → 최종 파싱 성공률 **99.923%**
