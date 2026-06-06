/**
 * 빌드 / 모듈 로드 sanity test
 */

import { TestRunner, assert, summarize } from "./lib/runner.mjs"
import { execSync } from "node:child_process"
import { loadDotenv, projectRoot } from "./lib/env.mjs"

loadDotenv()

const r = new TestRunner("빌드 + 모듈 로드")

await r.run("tsc --noEmit (타입체크)", () => {
  try {
    execSync("npx tsc --noEmit", { cwd: projectRoot(), stdio: "pipe" })
  } catch (e) {
    throw new Error(`타입체크 실패: ${e.stderr?.toString()?.slice(0, 200) ?? e.message}`)
  }
})

await r.run("tool-registry 모듈 로드 + 도구 수", async () => {
  const { allTools } = await import("../build/tool-registry.js")
  assert(Array.isArray(allTools), "allTools 배열 아님")
  // v1.3.0: 법제처 87 + ALIO 내부규정 23 + 보고서형(단체협약·임금협약·노사협의회) 5×3 = 125
  assert(allTools.length === 125, `도구 수 불일치: expected 125, got ${allTools.length}`)
})

await r.run("ALIO 도구 38개 등록 확인 (내부규정 23 + 보고서형 15)", async () => {
  const { allTools } = await import("../build/tool-registry.js")
  const alioTools = allTools.filter((t) => t.description?.startsWith("[ALIO"))
  assert(alioTools.length === 38, `ALIO 도구 수: expected 38, got ${alioTools.length}`)
  // 보고서형 카테고리별 5개씩 확인
  for (const [label, n] of [["단체협약", 5], ["임금협약", 5], ["노사협의회 의결사항", 5]]) {
    const got = allTools.filter((t) => t.description?.startsWith(`[ALIO ${label}]`)).length
    assert(got === n, `ALIO ${label} 도구 수: expected ${n}, got ${got}`)
  }
})

await r.run("query-router 모듈 로드", async () => {
  const m = await import("../build/lib/query-router.js")
  assert(typeof m.routeQuery === "function", "routeQuery 함수 없음")
})

await r.run("api-client 모듈 로드", async () => {
  const m = await import("../build/lib/api-client.js")
  assert(typeof m.LawApiClient === "function", "LawApiClient 클래스 없음")
})

await r.run("alio config 모듈 로드 (빈 환경변수)", async () => {
  delete process.env.ALIO_INSTITUTION_ALIASES
  // resetCache 위해 캐시 바이패스 — 새 query string import
  const m = await import("../build/lib/alio/config.js?v=" + Date.now())
  m.resetAlioConfigCache()
  const aliases = m.getInstitutionAliases()
  assert(Object.keys(aliases).length === 0, `미설정 시 빈 객체여야 함, got ${JSON.stringify(aliases)}`)
})

const counts = r.print()
summarize([counts])
