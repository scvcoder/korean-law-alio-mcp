/**
 * CLI 표면 — 원작자 5패턴 + 우리 fork 추가 (cross-domain, ALIO 직접) 22 cases
 *
 * spawn 으로 build/cli.js 직접 호출 → stdout/stderr/exit code 검증.
 * 외부 API 호출 없음 — 메타 명령(list/help/explain) + 디스크 의존 ALIO 직접 호출만.
 *
 * SKIP 조건:
 *   - data/alio/<apbaId> 미수집 → 해당 케이스만 SKIP
 *   - LAW_OC 부재여도 메타 명령은 실행 가능 (도구 핸들러 호출 X)
 */

import { TestRunner, assert, skip, summarize } from "./lib/runner.mjs"
import { loadDotenv, projectRoot } from "./lib/env.mjs"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

loadDotenv()
delete process.env.ALIO_INSTITUTION_ALIASES // 일관된 기본 동작

const cliPath = path.resolve(projectRoot(), "build", "cli.js")
const KISA = "C0399" // 한국인터넷진흥원 — 데이터 의존 케이스 sentinel

function alioDataExists(apbaId) {
  const dir = process.env.ALIO_DATA_DIR || path.join(projectRoot(), "data", "alio")
  return existsSync(path.join(dir, apbaId, "manifest.json"))
}

function run(args, opts = {}) {
  // NO_COLOR=1 — ANSI escape 제거 → grep 안전
  const env = { ...process.env, NO_COLOR: "1" }
  const res = spawnSync("node", [cliPath, ...args], {
    encoding: "utf8",
    env,
    timeout: opts.timeout ?? 15000,
  })
  return {
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    code: res.status,
    combined: (res.stdout || "") + (res.stderr || ""),
  }
}

const r = new TestRunner("CLI 표면")

// ────────────────────────────────────────
// (A) 브랜딩 / 메타 명령
// ────────────────────────────────────────

await r.run("[A1] 배너 — 'Korean Law + ALIO CLI' 표기", () => {
  const { stdout, code } = run(["list"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("Korean Law + ALIO CLI"), "ALIO 통합 브랜딩 누락")
})

await r.run("[A2] --version — 버전 문자열 출력", () => {
  const { stdout, code } = run(["--version"])
  assert(code === 0, `exit=${code}`)
  assert(/^\d+\.\d+\.\d+/.test(stdout.trim()), `버전 형식 아님: ${stdout.trim()}`)
})

await r.run("[A3] --help (top-level) — 핵심 서브커맨드 노출", () => {
  const { stdout, code } = run(["--help"])
  assert(code === 0, `exit=${code}`)
  for (const sub of ["list", "help", "interactive", "explain", "query"]) {
    assert(stdout.includes(sub), `서브커맨드 '${sub}' 누락`)
  }
})

// ────────────────────────────────────────
// (B) list — human + JSON + 카테고리 필터
// ────────────────────────────────────────

await r.run("[B1] list — 법제처 + ALIO 카테고리 모두 노출", () => {
  const { stdout, code } = run(["list"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("── 법령검색 ──"), "법령검색 카테고리 누락")
  assert(stdout.includes("── ALIO ──"), "ALIO 카테고리 누락")
})

await r.run("[B2] list --category 판례 — 판례만", () => {
  const { stdout, code } = run(["list", "--category", "판례"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("── 판례 ──"), "판례 섹션 누락")
  assert(!stdout.includes("── ALIO ──"), "ALIO 섹션이 필터에 새어나옴")
  assert(!stdout.includes("── 법령검색 ──"), "법령검색 섹션이 필터에 새어나옴")
})

await r.run("[B3] list --category ALIO — ALIO 만", () => {
  const { stdout, code } = run(["list", "--category", "ALIO"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("── ALIO ──"), "ALIO 섹션 누락")
  assert(!stdout.includes("── 법령검색 ──"), "법령검색 섹션이 필터에 새어나옴")
  assert(!stdout.includes("── 판례 ──"), "판례 섹션이 필터에 새어나옴")
})

await r.run("[B4] list --category 미지카테고리 — 친절한 빈 결과", () => {
  const { stdout, code } = run(["list", "--category", "ZZZNONEXISTENT"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("⚠"), "경고 표시 누락")
  assert(stdout.includes("카테고리"), "카테고리 인덱스 안내 누락")
})

await r.run("[B5] list --json — 유효 JSON 배열 + 필드 schema", () => {
  const { stdout, code } = run(["list", "--json"])
  assert(code === 0, `exit=${code}`)
  const data = JSON.parse(stdout)
  assert(Array.isArray(data), "최상위가 배열이 아님")
  assert(data.length === 125, `도구 수 불일치 (expected=125, got=${data.length})`)
  for (const item of data) {
    assert(typeof item.name === "string" && item.name.length > 0, `name 누락: ${JSON.stringify(item)}`)
    assert(typeof item.category === "string", `category 누락: ${JSON.stringify(item)}`)
    assert(typeof item.description === "string", `description 누락: ${JSON.stringify(item)}`)
  }
})

await r.run("[B6] list --json --category ALIO — 필터 + JSON", () => {
  const { stdout, code } = run(["list", "--json", "--category", "ALIO"])
  assert(code === 0, `exit=${code}`)
  const data = JSON.parse(stdout)
  assert(Array.isArray(data), "배열 아님")
  assert(data.length > 0, "ALIO 필터 결과 0건")
  for (const item of data) {
    assert(item.category.includes("ALIO"), `category에 'ALIO' 미포함: ${item.category}`)
  }
})

await r.run("[B7] list --json --category 미지 — 빈 배열", () => {
  const { stdout, code } = run(["list", "--json", "--category", "ZZZNONEXISTENT"])
  assert(code === 0, `exit=${code}`)
  const data = JSON.parse(stdout)
  assert(Array.isArray(data) && data.length === 0, `빈 배열 기대, got: ${stdout.slice(0, 100)}`)
})

// ────────────────────────────────────────
// (C) help — 도구별 / 미지정 / 알 수 없는 도구
// ────────────────────────────────────────

await r.run("[C1] help search_law — 법제처 도구 도움말", () => {
  const { stdout, code } = run(["help", "search_law"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("--query"), "--query 파라미터 표시 누락")
  assert(stdout.includes("(필수)"), "필수 표기 누락")
})

await r.run("[C2] help list_alio_regulations — ALIO 도구 도움말", () => {
  const { stdout, code } = run(["help", "list_alio_regulations"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("--institution"), "--institution 파라미터 표시 누락")
  assert(stdout.includes("--titleFilter"), "--titleFilter 옵션 누락")
})

await r.run("[C3] help analyze_regulation_delegation — cross-domain 브리지 도구", () => {
  const { stdout, code } = run(["help", "analyze_regulation_delegation"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("--institution"), "--institution 파라미터 누락")
  assert(stdout.includes("--includeLawLookup"), "--includeLawLookup 옵션 누락 (법제처 연계 플래그)")
})

await r.run("[C4] help (인자 없이) — 카테고리 인덱스로 안내", () => {
  const { stdout, code } = run(["help"])
  assert(code === 0, `exit=${code} (commander 가 require error 를 던지면 안 됨)`)
  assert(stdout.includes("사용 가능한 카테고리"), "카테고리 안내 누락")
  assert(stdout.includes("도구명"), "도구 안내 힌트 누락")
})

await r.run("[C5] help unknown_tool — exit 1 + 친절한 에러", () => {
  const { stdout, stderr, code } = run(["help", "this_tool_does_not_exist"])
  assert(code === 1, `exit=${code} (1 기대)`)
  const combined = stdout + stderr
  assert(combined.includes("알 수 없는 도구") || combined.includes("unknown"), "에러 메시지 누락")
})

// ────────────────────────────────────────
// (D) explain — 라우팅 경로 검증 (실행 X, 외부 API 무관)
// ────────────────────────────────────────

await r.run("[D1] explain '민법 제1조' — search_law 파이프라인", () => {
  const { stdout, code } = run(["explain", "민법", "제1조"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("search_law"), "search_law 라우팅 누락")
})

await r.run("[D2] explain '한국인터넷진흥원 인사규정' — list_alio_regulations", () => {
  if (!alioDataExists(KISA)) skip(`data/alio/${KISA} 미수집`)
  const { stdout, code } = run(["explain", "한국인터넷진흥원", "인사규정"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("list_alio_regulations"), "list_alio_regulations 라우팅 누락")
  assert(stdout.includes(KISA), `${KISA} 매칭 누락`)
})

await r.run("[D3] explain '○○ 인사규정 상위법' — analyze_regulation_delegation (cross-domain)", () => {
  if (!alioDataExists(KISA)) skip(`data/alio/${KISA} 미수집`)
  const { stdout, code } = run(["explain", "한국인터넷진흥원", "인사규정", "상위법"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("analyze_regulation_delegation"), "위임분석 라우팅 누락")
  assert(stdout.includes("includeLawLookup"), "법제처 연계 플래그 누락")
})

await r.run("[D4] explain '근로기준법 따르는 공공기관 규정' — find_regulations_by_upper_law (역방향 cross-domain)", () => {
  const { stdout, code } = run(["explain", "근로기준법", "따르는", "공공기관", "규정"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("find_regulations_by_upper_law"), "역검색 라우팅 누락")
  assert(stdout.includes("근로기준법"), "lawName 추출 누락")
})

// ────────────────────────────────────────
// (E) 도구 직접 호출 — ALIO (디스크 의존) + 에러 케이스
// ────────────────────────────────────────

await r.run(`[E1] list_alio_regulations --institution ${KISA} — 직접 호출`, () => {
  if (!alioDataExists(KISA)) skip(`data/alio/${KISA} 미수집`)
  const { stdout, code } = run(["list_alio_regulations", "--institution", KISA])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("한국인터넷진흥원"), "기관명 출력 누락")
  assert(/규정\s+\d+건/.test(stdout), "규정 건수 표시 누락")
})

await r.run("[E2] list_alio_regulations --institution '한국인터넷진흥원' — 정식명칭 lookup", () => {
  if (!alioDataExists(KISA)) skip(`data/alio/${KISA} 미수집`)
  const { stdout, code } = run(["list_alio_regulations", "--institution", "한국인터넷진흥원"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes(KISA), `apbaId(${KISA}) 매칭 누락`)
})

await r.run("[E3] search_law (필수 --query 누락) — exit 1 + 에러 안내", () => {
  const { code, combined } = run(["search_law"])
  assert(code !== 0, `필수 인자 누락인데 exit=${code} (0이면 안 됨)`)
  // commander 또는 도구 자체가 에러 표시 — 둘 다 허용
  assert(/required|query|필수|에러|Error/i.test(combined), "에러 메시지 누락")
})

// ────────────────────────────────────────
// (F) 자연어 bare-query — ALIO 디스크 경로 (외부 API 무관)
// ────────────────────────────────────────

await r.run("[F1] bare-query '한국인터넷진흥원 인사규정' — 자연어→ALIO 통합 흐름", () => {
  if (!alioDataExists(KISA)) skip(`data/alio/${KISA} 미수집`)
  const { stdout, code } = run(["한국인터넷진흥원 인사규정"])
  assert(code === 0, `exit=${code}`)
  assert(stdout.includes("[라우팅]") || stdout.includes("list_alio_regulations") || stdout.includes("한국인터넷진흥원"),
    "라우팅 로그 또는 결과 누락")
})

const counts = r.print()
summarize([counts])
