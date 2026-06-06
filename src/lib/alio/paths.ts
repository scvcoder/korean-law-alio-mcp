/**
 * ALIO 데이터 디렉터리 경로 해결
 *
 * 배치 스크립트와 런타임 인덱서가 같은 경로 체계를 쓰도록 중앙화.
 *
 * 해결 우선순위:
 *   1. ALIO_DATA_DIR 환경변수 (테스트/명시 override)
 *   2. 패키지 루트의 data/alio (dev clone / npx 캐시 / docker baked image)
 *   3. 사용자 홈 ~/.korean-law-alio-mcp/data/alio (npm install -g + fetch-data)
 *
 * (2) 는 institutions.json 존재 여부로 판정 → 데이터가 거기 있으면 우선.
 * 둘 다 없으면 (3) 을 반환해 fetch-data 가 어디로 받을지 알려주는 용도로도 사용.
 *
 * ── 카테고리 (공시 종류) 구분 ─────────────────────────────────────────────
 * v1.1.0 부터 ALIO 의 여러 공시 카테고리를 별도 디렉터리로 보관:
 *   - regulations (기본, 내부규정 reportFormRootNo=21110)
 *     · 호환성: {apbaId}/manifest.json + {apbaId}/regulations/*.md (기존 레이아웃 그대로)
 *   - labor-agreements (단체협약 21026)
 *   - wage-agreements (임금협약 21027 — v1.2.0+)
 *   - labor-council (노사협의회 21028 — v1.3.0+)
 *     · 신규 카테고리: {apbaId}/{category}/manifest.json + {apbaId}/{category}/{docId}.md
 *
 * regulations 만 기존 호환을 위해 manifest 가 {apbaId}/manifest.json 위치.
 * 나머지 신규 카테고리는 {apbaId}/{category}/manifest.json.
 */

import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"

/** 지원하는 ALIO 공시 카테고리 식별자 (디렉터리명 = URL-safe slug). */
export type AlioCategory =
  | "regulations"
  | "labor-agreements"
  | "wage-agreements"
  | "labor-council"

function resolvePackageRoot(): string {
  // 이 파일은 빌드 후 build/lib/alio/paths.js 에 위치 → 3단계 상위가 패키지 루트
  // 소스 상태(tsx 등)에서도 src/lib/alio/paths.ts → 3단계 상위가 루트로 동일
  const here = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(here), "..", "..", "..")
}

/** 사용자 홈 기반 ALIO 데이터 디렉터리 (cross-platform). */
export function userAlioDataDir(): string {
  return path.join(homedir(), ".korean-law-alio-mcp", "data", "alio")
}

export function alioDataDir(): string {
  // 1. 명시 override
  const override = process.env.ALIO_DATA_DIR
  if (override && override.trim()) return path.resolve(override.trim())

  // 2. 패키지 루트에 데이터가 이미 있으면 그것 우선 (dev / npx / docker)
  const pkgLocal = path.join(resolvePackageRoot(), "data", "alio")
  if (existsSync(path.join(pkgLocal, "institutions.json"))) return pkgLocal

  // 3. 사용자 홈 (npm install -g + fetch-data 시나리오)
  return userAlioDataDir()
}

export function institutionsIndexPath(): string {
  return path.join(alioDataDir(), "institutions.json")
}

export function syncStatePath(): string {
  return path.join(alioDataDir(), "sync-state.json")
}

export function institutionDir(apbaId: string): string {
  return path.join(alioDataDir(), apbaId)
}

// ─────────────────────────────────────────
// 카테고리 인지 경로 (v1.1.0+)
// ─────────────────────────────────────────

/**
 * 카테고리의 manifest.json 경로.
 *
 * - regulations: {apbaId}/manifest.json (기존 호환 — v1.0.x 와 동일)
 * - 그 외:       {apbaId}/{category}/manifest.json
 */
export function categoryManifestPath(apbaId: string, category: AlioCategory = "regulations"): string {
  if (category === "regulations") {
    return path.join(institutionDir(apbaId), "manifest.json")
  }
  return path.join(institutionDir(apbaId), category, "manifest.json")
}

/**
 * 카테고리의 본문 MD 파일 경로.
 *
 * - regulations: {apbaId}/regulations/{docId}.md (기존 호환)
 * - 그 외:       {apbaId}/{category}/{docId}.md
 */
export function categoryDocMdPath(
  apbaId: string,
  docId: string,
  category: AlioCategory = "regulations"
): string {
  if (category === "regulations") {
    return path.join(institutionDir(apbaId), "regulations", `${docId}.md`)
  }
  return path.join(institutionDir(apbaId), category, `${docId}.md`)
}

// ─────────────────────────────────────────
// 호환 alias (기존 코드 사용 중)
// ─────────────────────────────────────────

/** @deprecated regulations 카테고리 기본값 — categoryManifestPath(apbaId, "regulations") 와 동일. */
export function manifestPath(apbaId: string): string {
  return categoryManifestPath(apbaId, "regulations")
}

/** @deprecated regulations 카테고리 기본값 — categoryDocMdPath(apbaId, regId, "regulations") 와 동일. */
export function regulationMdPath(apbaId: string, regId: string): string {
  return categoryDocMdPath(apbaId, regId, "regulations")
}

/** 모든 manifest 경로를 훑기 위한 루트 */
export function dataRoot(): string {
  return alioDataDir()
}
