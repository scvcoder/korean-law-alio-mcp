# Korean Law ALIO MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tools: 110](https://img.shields.io/badge/MCP%20Tools-110-blue.svg)](./docs/API.md)
[![ALIO Coverage: 35,000+](https://img.shields.io/badge/ALIO%20Regulations-35%2C000%2B-green.svg)](#-alio-공공기관-규정-fork-의-차별점)

---

국가법령정보센터와 알리오의 공공기관 내부규정을 검색·비교·분석하는 MCP 입니다.

법제처 87개 + ALIO 공공기관 규정 23개 총 110개 MCP 도구가 분석을 합니다.

1,600 법률, 10,000 행정규칙, 수만건 판례, 344개 공공기관 35,000 내부규정을 검색하고 비교 및 분석한 결과를 AI에게 주어 좋은 답변을 만들도록 도와줍니다.

본 프로젝트는 [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) 에서 Fork 하여 파생되어 만들어 졌습니다.

![Korean Law ALIO MCP 데모](./demo.png)

---

## 만든 이유

전체 법령에 대해서 [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) 의 도움으로 공공기관의 업무처리에 도움이 많이 되고 있습니다. 다시 한번 [chrisryugj](https://github.com/chrisryugj) 님께 감사드립니다.

여기에 공공기관의 내부규정까지 활용되면 더욱 큰 효과가 있을 것이라 생각되었습니다. 그래서 [ALIO](https://alio.go.kr/) 의 공공기관 내부규정 데이터를 참고해서 추가 개발을 하게 되었습니다.

법에 대한 접근이 어려운 사람들과 내부규정 관리로 고생하는 전국의 공공기관 직원들에게 도움이 되었으면 좋겠습니다.

---

## v1.0.0 — 공공기관 규정과 법제처 법령을 한 번에

원작 87개 법제처 도구 위에 **ALIO 공공기관 23개 + 두 영역을 잇는 연계 도구 3개** 를 통합 — 110개 도구가 1.27GB 데이터 (법제처 + 35,000건 공공기관 내부규정) 를 자연어로 검색·비교·분석.

### 추가 개발 사항

- **ALIO 23개 도구** — 344개 공공기관 35,000건 내부규정 통합 (kordoc 통합 파서로 HWP/HWPX/PDF/XLSX 자동 변환, on-demand 디스크 읽기)
- **공공기관 규정과 법제처 법령을 잇는 연계 도구 3종**
  - 공공기관 규정에서 인용된 상위 법령 자동 추출 + 법제처에서 각 법령 정보 자동 조회
  - 법제처 법령을 입력하면, 그 법령을 근거로 삼는 공공기관 규정을 전국에서 역검색
  - 단일 규정 안에서 조문끼리 어떻게 인용·참조하는지 자동 분석
- **자연어 라우팅** — 정식 기관명 자동 lookup (institutions.json 동기 로드), 두 영역 양쪽으로 자동 분기
- **API 키 인증실패 명확한 안내** — 12개 fetch 사이트 일괄 통합, IP/도메인 화이트리스트 차단 시 등록 페이지 안내
- **셋업 wizard** — `npx korean-law-alio-mcp setup` (API 키 → 운영 모드 → 클라이언트 다중 선택 → 설정 자동 등록)
- **fly.io 원격 배포** — `https://korean-law-alio-mcp.fly.dev` (110개 도구 + ALIO 데이터 mirror, best-effort 갱신)
- **CLI 표면 정리** — `list`/`help`/`--category`/`explain`/REPL + 자연어 bare-query
- **168 cases 테스트 스위트** — build 6 + router 13 + cli 23 + alio 39 + law 87 (`npm test`)
- **라이선스 위생** — 4개 파일 clean-room 재작성, BSL/Source-Available 코드 0

### 예시 — 두 영역을 잇는 자연어 질의

```
"OO진흥원 인사규정과 관련된 상위 법령을 알려줘"
```

→ AI 가 자연어 질의를 받으면 자동으로 다음을 수행:

- 해당 기관의 인사규정 본문을 분석해 인용된 상위 법령을 자동 추출
- 추출된 각 법령의 식별자를 법제처 OpenAPI 에서 자동 조회해 첨부
- 같은 기관의 내부 상위규정도 함께 매칭

결과 예시:

> "인사규정 본문에서 약 10여 건의 상위 법령 인용을 찾았습니다 (예: 인사·근로 관련 일반 법령, 안전·보건 관련 법령, 양성평등 관련 법령 등). 각 법령의 식별자가 첨부되어 후속 조회 가능. 같은 기관의 내부 상위규정도 함께 매칭되었습니다."

```
"OO공단의 OOO지침이 근로기준법을 준수하는지 검토해줘"
```

→ AI 가 자연어 질의를 받으면 자동으로 다음을 수행:

- 35,000건 공공기관 규정 본문에서 해당 법령 (예: 근로기준법) 인용 위치를 역검색
- 매칭된 지침의 인용 컨텍스트 (어느 조문이 어떻게 인용됐는지) 정리
- 기관별 그룹으로 표시

결과 예시:

> "여러 공공기관 지침에서 해당 법령 인용 사례가 검출되었습니다. 각 지침이 어느 조문을 어떻게 인용하는지 비교해, 자기 기관 지침의 준수 수준을 검토할 수 있습니다."

**공공기관 컴플라이언스 검토, 감사, 정책 분석에서 상위 법령까지 한 번에 추적**.

---

## 설치 및 사용법

### 0단계: API 키 발급 (무료, 1분)

모든 방법에 공통으로 필요한 **법제처 Open API 인증키(OC)** 를 먼저 발급받으세요.

1. [법제처 Open API 신청 페이지](https://open.law.go.kr/LSO/openApi/guideResult.do) 접속
2. 회원가입 후 로그인
3. "Open API 사용 신청" 버튼 클릭
4. 신청서 작성 → **인증키(OC)** 발급 (이메일 ID 형식)

> 아래 모든 예시의 `your-api-key-here` 는 placeholder — 본인 발급 키로 교체하세요. ([`.env.example`](./.env.example) 와 동일 컨벤션)

> 신청 시 **IP/도메인 등록은 비워두는 것을 권장** — 등록 안 한 키는 어디서든 호출 가능 (로컬·원격 모두). 등록하면 그 IP/도메인에서만 동작하므로, 원격 모드(방법 2·3) 사용 시 추가 등록 필요 (`korean-law-alio-mcp.fly.dev` 도메인 추가).

### 방법 1: Claude Code 플러그인 — 한 줄 설치 준비 중

> 마켓플레이스 등록은 다음 릴리스에 활성화 예정. 지금은 방법 2~5 사용.

향후 활성화 시:
```
/plugin marketplace add scvcoder/korean-law-alio-mcp
/plugin install korean-law-alio@korean-law-alio-marketplace
```

### 방법 2: Claude.ai 웹에서 바로 사용 (설치 없음) 가장 간편

[claude.ai](https://claude.ai) 에서 커스텀 커넥터 추가. Claude Pro/Max/Team/Enterprise 요금제 필요 (Free는 커넥터 1개만 가능).

**커넥터 추가 방법**:

1. claude.ai 로그인
2. 사이드바 하단 본인 이름 → "설정" → "커넥터"
3. "커스텀 커넥터" 영역 → "커스텀 커넥터 추가"
4. 아래 입력 (`your-api-key-here` 는 본인 키로 교체):
   - **이름**: `korean-law-alio` (자유)
   - **URL**: `https://korean-law-alio-mcp.fly.dev/mcp?oc=your-api-key-here`
5. "추가" → 등록 완료

**도구 활성화 (중요)**: 등록한 커넥터 "구성" 클릭 → 도구 목록에서 **모든 도구를 "항상 사용"** 으로 설정. 매번 승인 없이 AI가 바로 호출 가능.

이제 채팅에서 자연어로:

```
"근로기준법 제74조 알려줘"                  → 법제처 87개 도구
"○○진흥원 인사규정 보여줘"           → ALIO 23개 도구
"○○진흥원 인사규정 상위법"           → 규정→법령 연계
"근로기준법 따르는 공공기관 규정"            → 법령→규정 역검색
"공공기관 휴직 규정 비교해줘"                → ALIO 기관간 토픽 비교
```

> **본인 키로 직접 호출** — 운영자(scvcoder)의 fly 서버를 경유하지만 모든 법제처 호출이 본인 키 명의로 카운트됨. 운영자 quota 영향 X.
>
> **ALIO 데이터는 운영자가 best-effort 갱신** — 모든 응답에 `fetchedAt`(수집 시각)과 `sourceDetailUrl`(ALIO 원본 링크) 포함. 시점이 중요한 사용에는 응답의 `fetchedAt` 직접 확인 + ALIO 원본 검증. 자세한 책임 분담은 [`NOTICE`](./NOTICE)의 "Data sources" 섹션 참고.

### 방법 3: AI 데스크톱 앱에서 사용 (Claude Desktop · Cursor · Windsurf)

설정 파일에 아래 내용 추가:

```json
{
  "mcpServers": {
    "korean-law-alio": {
      "url": "https://korean-law-alio-mcp.fly.dev/mcp?oc=your-api-key-here"
    }
  }
}
```

**설정 파일 위치**:

| 앱 | macOS | Windows |
|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `<프로젝트>/.cursor/mcp.json` | `<프로젝트>/.cursor/mcp.json` |
| Windsurf | `<프로젝트>/.windsurf/mcp.json` | `<프로젝트>/.windsurf/mcp.json` |

이미 다른 MCP 서버가 설정되어 있다면 `"mcpServers": { ... }` 안에 `"korean-law-alio": { ... }` 부분만 추가. 저장 후 앱 재시작.

### 방법 4: 내 컴퓨터에 직접 설치 (오프라인 · 보안 민감 · 데이터 통제)

원격 서버를 안 거치고 자기 PC에서만 동작. ALIO 데이터를 본인이 통제. **사전 준비**: Node.js ≥ 20.

#### 4-A. 자동 설치 마법사

대화형 wizard가 ① API 키 입력 → ② 운영 모드(원격 fly / 로컬 stdio) → ③ AI 클라이언트 선택 (Claude Desktop · Code · Cursor · VS Code · Windsurf) → ④ 설정 파일 자동 등록 까지 처리.

```bash
# 지금 사용 가능 — 로컬 git clone + 빌드 후
git clone https://github.com/scvcoder/korean-law-alio-mcp
cd korean-law-alio-mcp && npm install && npm run build
node build/index.js setup

# npm publish 후 활성화 예정 — 동일 wizard 를 한 줄로
npx korean-law-alio-mcp setup
```

#### 4-B. 수동 설치 (지금 사용 가능)

```bash
git clone https://github.com/scvcoder/korean-law-alio-mcp
cd korean-law-alio-mcp
npm install && npm run build
echo "LAW_OC=발급받은-키" > .env
```

ALIO 데이터를 둘 중 하나로 준비:

```bash
# (i) 직접 sync — 시간 ↑, 통제 ↑ (6-12시간, 외부 도구 권장)
#     macOS:   brew install docling tesseract tesseract-lang libreoffice
#     Linux:   sudo apt install tesseract-ocr tesseract-ocr-kor libreoffice && pip install docling
#     Windows: Node.js 만 있어도 동작 (특수 케이스만 parseError 남음)
npm run alio:sync                   # 전체 344개 기관
npm run alio:sync -- --only C0xxx   # 단일 기관 (apbaId 4자리, 수 분)

# (ii) 운영자 mirror 사용 — 시간 ↓, 외부 도구 불필요 (5-15분, best-effort 갱신)
# macOS/Linux:
curl -L -o alio-data.tar.gz \
  https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.tar.gz
tar -xzf alio-data.tar.gz -C data/
# Windows (PowerShell):
Invoke-WebRequest -Uri https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.zip -OutFile alio-data.zip
Expand-Archive -Path alio-data.zip -DestinationPath data\
```

설정 파일에 stdio 모드로 등록:

```json
{
  "mcpServers": {
    "korean-law-alio": {
      "command": "node",
      "args": ["/절대경로/korean-law-alio-mcp/build/index.js"],
      "env": { "LAW_OC": "your-api-key-here" }
    }
  }
}
```

> **데이터 mirror 갱신은 best-effort** — Releases 의 `tag` 가 수집 일자, 압축 안 manifest.json `fetchedAt` 으로 정확한 시점 확인. 시점이 중요한 사용에는 `npm run alio:sync` 로 직접 최신화 권장. 갱신 차이로 발생하는 문제는 사용자 책임. 자세한 책임 분담은 [`NOTICE`](./NOTICE) 참고.

### 방법 5: 터미널(CLI)에서 직접 사용

개발자라면 터미널에서 직접 법령·공공기관 규정을 검색할 수 있습니다.

```bash
# 설치
npm install -g korean-law-alio-mcp

# 인증키 설정 (your-api-key-here 를 본인 키로 바꾸세요)
export LAW_OC=your-api-key-here     # Mac/Linux
set LAW_OC=your-api-key-here        # Windows CMD
$env:LAW_OC="your-api-key-here"    # Windows PowerShell

# 사용 예시
korean-law-alio "민법 제1조"                                # 법제처 자연어
korean-law-alio "OO진흥원 인사규정"                         # ALIO 자연어
korean-law-alio "OO진흥원 인사규정과 관련된 상위 법령"      # 두 영역 연계
korean-law-alio "공공기관 휴직 규정 비교해줘"                # ALIO 기관간 비교
korean-law-alio search_law --query "관세법"                 # 도구 직접 호출
korean-law-alio list                                        # 전체 110개 도구 목록
korean-law-alio list --category ALIO                        # 카테고리별 (ALIO/판례/법령검색 등)
korean-law-alio help search_law                             # 도구별 도움말
korean-law-alio                                             # REPL (대화형)
```

> npm publish 전 — 지금 바로 사용하려면 [방법 4-B](#4-b-수동-설치-지금-사용-가능) 의 git clone + 빌드 후 위 `korean-law-alio` 부분을 `node build/cli.js` 로 대체.
>
> ALIO 도구는 **사용자 자연어 그대로** — 비교 대상 기관을 환경변수에 박아두지 않음. "A·B·C 기관과 비교", "랜덤", "전체" 같이 자유롭게 표현하면 LLM 이 알아서 호출.

### API 키 전달 방법 정리

여러 채널로 인증키 전달 가능. 위에서부터 우선 적용:

| 채널 | 사용법 | 권장 시나리오 |
|------|--------|---------------|
| URL 쿼리 | `?oc=내키` | 방법 2·3 (웹/데스크톱 URL) — 가장 간편 |
| HTTP 헤더 | `apikey: 내키` (또는 `x-api-key`, `Authorization: Bearer 내키`) | 프로그래밍 통합 |
| 환경변수 | `LAW_OC=내키` | 방법 4·5 (로컬) |
| 도구 인자 | `apiKey: "내키"` | 특정 호출만 다른 키 사용 시 |

> **API 키에 IP/도메인 등록 옵션을 사용 중인 사용자**: 방법 2·3 원격 모드를 쓰려면 본인 마이페이지([open.law.go.kr/LSO/openApi/userMypage.do](https://open.law.go.kr/LSO/openApi/userMypage.do))에서 `korean-law-alio-mcp.fly.dev` 도메인을 화이트리스트에 추가해야 합니다. 일반 사용자(등록 옵션 미사용)는 별도 절차 불필요 — 즉시 동작.

---

## 사용 예시

> 아래 예시의 `OO진흥원`·`OO공단` 은 익명화 표기 — 본인이 조회하려는 실제 기관명으로 교체.

### 법제처 도구 — 법령·판례·해석례 (원작 자산 87개)

```
"민법 제1조 알려줘"
→ AI 가 법령 검색 → 해당 조문 자동 조회

"음주운전 처벌 기준"
→ AI 가 관련 법령 + 판례 + 해석례를 자동으로 종합 분석

"관세법 3단비교"
→ AI 가 법-시행령-시행규칙 위임 구조를 자동 분석

"근로기준법 제74조 해석례"
→ AI 가 해당 조문 + 정부 해석례를 자동 매칭

"종로구 주차 조례"
→ AI 가 자치법규 검색
```

상세 시나리오는 [`README-UPSTREAM.md`](./README-UPSTREAM.md) 참고.

### ALIO 공공기관 규정 도구 (fork 신규 23개)

```
"OO진흥원 인사규정 보여줘"
→ AI 가 정식 기관명을 자동 매칭 → 해당 기관 규정 목록 표시

"공공기관 휴직 규정 비교해줘"
→ AI 가 수집된 공공기관 전체에서 휴직 관련 규정을 자동 비교

"우리 기관에 없는 동종 기관 규정"
→ AI 가 동종 기관 보유 규정 - 자기 기관 보유 규정 = 벤치마킹 후보 자동 추출

"최근 3개월 내 인사 규정 바뀐 기관?"
→ AI 가 최근 개정 이력을 자동 정렬

"ALIO에 어떤 데이터가 있어?"
→ AI 가 수집된 전체 데이터의 통계를 자동 요약
```

### 두 영역을 잇는 연계 도구 (fork 신규 3종)

공공기관 내부규정은 본질적으로 상위 법제처 법령에서 위임/근거를 받습니다. 두 영역을 잇는 자연어 질의도 자동 처리:

```
"OO진흥원 인사규정과 관련된 상위 법령을 알려줘"
→ AI 가 규정 본문에서 인용된 상위 법령을 자동 추출
   + 법제처에서 각 법령 정보를 자동 조회

"OO공단의 OOO지침이 근로기준법을 준수하는지 검토해줘"
→ AI 가 35,000건 공공기관 규정에서 해당 법령 인용 위치를 역검색
   → 매칭된 지침의 인용 컨텍스트 + 기관별 그룹 표시
```

전체 110개 도구는 [`docs/API.md`](./docs/API.md), 변경 동기는 [`ROADMAP.md`](./ROADMAP.md) 참고.

---

## 도구 구조 (110개)

| 구분 | 개수 | 비고 |
|------|------|------|
| 법령·행정규칙·자치법규 | 16 | 검색·조회·비교·연계 |
| 판례·해석례 | 7 | 대법원·법령해석례 |
| 위원회 결정문 | 10 | 헌재·공정위·개인정보위·노동위·권익위 |
| 조세심판·관세·조약·영문 | 8 | 도메인별 결정문/원문 |
| 학칙·공사공단·공공기관 (법제처) | 6 | 공공·교육 영역 |
| 별표·체계·통계·이력·용어사전 등 부가 | 24 | |
| 체인 도구 (자동 종합) | 8 | 종합리서치·법체계·처분근거·쟁송·개정추적·조례비교·절차상세·문서검토 |
| 문서분석·유틸 | 8 | 조문번호 변환, 약칭 사전 등 |
| ALIO 공공기관 규정 | 22 | 검색·조회·비교·벤치마킹·타임라인·통계 + 두 영역 연계 3종 |
| ALIO 체인 도구 | 1 | 기관 종합 벤치마킹 |
| **합계** | **110** | |

전체 도구 상세 (이름·파라미터·예시) 는 [`docs/API.md`](./docs/API.md) 참고.

---

## 주요 특징

- **110개 도구 통합** — 법제처 87 (원작 자산) + ALIO 공공기관 23 (fork 신규)
- **두 영역 연계** — 공공기관 규정의 인용 법령 자동 추출 + 상위법 기반 ALIO 역검색 + 조문간 인용 그래프
- **자연어 라우팅** — 정식 기관명 자동 매칭 (수집된 344개 기관), 두 영역 자동 분기
- **MCP + CLI** — Claude Desktop·Cursor·Windsurf 에서도, 터미널에서도 같은 도구 사용
- **법률 도메인 특화** — 약칭 자동 인식 (`화관법` → `화학물질관리법`), 조문번호 변환 (`제38조` ↔ `003800`), 위임 구조 시각화
- **별표·별지서식 본문 추출** — HWPX·HWP·PDF·XLSX·DOCX 자동 변환 (kordoc 엔진)
- **API 키 인증실패 명확한 안내** — IP/도메인 화이트리스트 차단 시 등록 페이지 안내
- **원격 + 로컬 모드** — `https://korean-law-alio-mcp.fly.dev` 즉시 사용 OR 자기 PC 에 데이터 보관 (`npm run alio:sync`)
- **자동 설치 마법사** — `npx korean-law-alio-mcp setup` (5종 클라이언트 자동 등록)
- **검증** — 168 cases 자동 테스트 (`npm test` — 빌드·라우터·CLI·ALIO·법제처)
- **라이선스 위생** — MIT 단일 라이선스, BSL/Source-Available 코드 0

---

## 환경 변수

| 변수 | 필수 | 용도 |
|------|------|------|
| `LAW_OC` | ✅ | 법제처 OpenAPI 신청자의 오픈 API 인증키 |

전체 변수 + 예시는 [`.env.example`](./.env.example) 참고.

---

## 문서

| 문서 | 설명 |
|------|------|
| [`README-UPSTREAM.md`](./README-UPSTREAM.md) | 📜 원작자 README 원문 (한글) — 도구 카테고리/체인 등 풍부한 안내 |
| [`README-EN.md`](./README-EN.md) | 본 fork 의 영문판 |
| [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md) | 📜 원작자 README 원문 (영문) |
| [`CLAUDE.md`](./CLAUDE.md) | 코드 가이드 (AI 어시스턴트 + 기여자용) |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | 기여 가이드 — PR 체크리스트, 라이선스 호환성 정책 |
| [`ROADMAP.md`](./ROADMAP.md) | fork 의 변경 동기 + 향후 계획 + 감사의 말 |
| [`CHANGELOG.md`](./CHANGELOG.md) | fork 이후 변경 이력 |
| [`docs/API.md`](./docs/API.md) | 110개 도구 레퍼런스 |
| [`TEST-REPORT.md`](./TEST-REPORT.md) | 종합 테스트 결과 (69 cases ALL PASS) |
| [`LICENSE`](./LICENSE) | MIT (원작자 + scvcoder 듀얼 copyright) |
| [`NOTICE`](./NOTICE) | 모든 의존성 attribution |

---

## 감사의 말

본 프로젝트는 다음 분들 덕분에 가능했습니다:

- chrisryugj 님 — [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp), [kordoc](https://github.com/chrisryugj/kordoc) 프로젝트를 만드시지 않았으면 이 프로젝트는 시작될 수 없었습니다. 진심으로 감사드립니다.
- jkg 님 — ALIO 공공기관 내부규정을 통합해 보자는 아이디어를 주셔서 감사합니다.

---

## 라이선스

[MIT](./LICENSE)

---

<sub>Made by <a href="https://github.com/scvcoder">scvcoder</a></sub>
