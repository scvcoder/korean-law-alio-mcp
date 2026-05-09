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
 */

import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"

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

export function manifestPath(apbaId: string): string {
  return path.join(institutionDir(apbaId), "manifest.json")
}

export function regulationMdPath(apbaId: string, regId: string): string {
  return path.join(institutionDir(apbaId), "regulations", `${regId}.md`)
}

/** 모든 manifest 경로를 훑기 위한 루트 */
export function dataRoot(): string {
  return alioDataDir()
}
