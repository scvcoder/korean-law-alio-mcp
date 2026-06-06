/**
 * 런타임 인덱서
 *
 * MCP 런타임이 디스크의 institutions.json 과 각 기관의 manifest.json 을 읽어
 * 메모리에 기관 목록/규정 메타 인덱스를 구축한다. 파일 I/O는 최초 1회만, 이후 TTL 만료시 재로딩.
 *
 * 카테고리별 분리 (v1.1.0+):
 *   - regulations (내부규정, default — 기존 동작 유지)
 *   - labor-agreements (단체협약 — 신규)
 *   - wage-agreements (임금협약 — v1.2.0+)
 *   - labor-council (노사협의회 — v1.3.0+)
 *
 * 각 카테고리는 별도 IndexCache 인스턴스로 보관. 기존 호출부 (내부규정 도구) 는 default
 * 인자로 그대로 동작 — backward compat.
 */

import fs from "node:fs/promises"
import path from "node:path"
import {
  alioDataDir,
  regulationMdPath,
  categoryManifestPath,
  categoryDocMdPath,
  type AlioCategory,
} from "./paths.js"
import { readJsonIfExists } from "./manifest.js"
import type { Institution, InstitutionsIndex, Manifest, ManifestEntry } from "./types.js"

interface IndexCache {
  loadedAt: number
  category: AlioCategory
  institutions: Institution[]
  /** apbaId → Manifest */
  manifests: Map<string, Manifest>
  /** 검색 편의를 위한 평탄화: "apbaId::regId" → { inst, entry } */
  flatRegulations: Array<{ inst: Institution; entry: ManifestEntry }>
}

/** 카테고리별 캐시 — 같은 카테고리 호출은 TTL 안에 재사용 */
const caches = new Map<AlioCategory, IndexCache>()
const TTL_MS = 10 * 60 * 1000 // 10분

export async function loadIndex(
  categoryOrForce: AlioCategory | boolean = "regulations",
  force = false
): Promise<IndexCache> {
  // Backward compat: 기존 호출 `loadIndex(true)` 는 regulations 강제 재로드로 해석
  const category: AlioCategory = typeof categoryOrForce === "boolean" ? "regulations" : categoryOrForce
  const forceReload = typeof categoryOrForce === "boolean" ? categoryOrForce : force

  const now = Date.now()
  const existing = caches.get(category)
  if (!forceReload && existing && now - existing.loadedAt < TTL_MS) return existing

  const idxFile = await readJsonIfExists<InstitutionsIndex>(
    path.join(alioDataDir(), "institutions.json")
  )
  const institutions = idxFile?.institutions ?? []

  const manifests = new Map<string, Manifest>()
  const flat: IndexCache["flatRegulations"] = []

  // 디스크 존재 기관만 로드 (institutions.json 이 비어있어도 디렉터리 스캔으로 복구)
  const scannedIds = new Set<string>()
  for (const inst of institutions) scannedIds.add(inst.apbaId)
  try {
    const entries = await fs.readdir(alioDataDir(), { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory() && /^[A-Z]\d{4}$/.test(e.name)) scannedIds.add(e.name)
    }
  } catch {
    /* data dir 없음 — OK, 빈 인덱스 반환 */
  }

  for (const apbaId of scannedIds) {
    const mf = await readJsonIfExists<Manifest>(categoryManifestPath(apbaId, category))
    if (!mf) continue
    manifests.set(apbaId, mf)
    const inst =
      institutions.find((i) => i.apbaId === apbaId) ??
      ({
        apbaId,
        apbaNa: mf.institutionName,
        typeNa: mf.typeNa ?? "",
        jidtNa: mf.jidtNa ?? "",
        apbaType: "",
      } as Institution)
    for (const entry of mf.regulations) flat.push({ inst, entry })
  }

  const cache: IndexCache = {
    loadedAt: now,
    category,
    institutions,
    manifests,
    flatRegulations: flat,
  }
  caches.set(category, cache)
  return cache
}

/** 한 규정의 본문 markdown 을 디스크에서 읽는다 (기존 호환 — regulations 카테고리) */
export async function readRegulationMd(apbaId: string, regId: string): Promise<string | null> {
  try {
    return await fs.readFile(regulationMdPath(apbaId, regId), "utf8")
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return null
    throw err
  }
}

/** 카테고리별 문서 본문 markdown 읽기 (v1.1.0+) */
export async function readCategoryDocMd(
  apbaId: string,
  docId: string,
  category: AlioCategory = "regulations"
): Promise<string | null> {
  try {
    return await fs.readFile(categoryDocMdPath(apbaId, docId, category), "utf8")
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return null
    throw err
  }
}

/** 정규화된 부분일치(공백/대소문자 무시) */
export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "")
}

export function findInstitution(
  cacheRef: IndexCache,
  queryOrId: string
): Institution | undefined {
  const q = normalize(queryOrId)
  // 1. apbaId 완전일치
  const byId = cacheRef.institutions.find((i) => i.apbaId.toLowerCase() === queryOrId.toLowerCase())
  if (byId) return byId
  // 2. manifest 로만 있는 기관 (institutions.json 미업데이트 대비)
  for (const m of cacheRef.manifests.values()) {
    if (m.apbaId.toLowerCase() === queryOrId.toLowerCase()) {
      return {
        apbaId: m.apbaId,
        apbaNa: m.institutionName,
        typeNa: m.typeNa ?? "",
        jidtNa: m.jidtNa ?? "",
        apbaType: "",
      }
    }
  }
  // 3. 기관명 정규화 일치 / 부분일치
  const byName =
    cacheRef.institutions.find((i) => normalize(i.apbaNa) === q) ||
    cacheRef.institutions.find((i) => normalize(i.apbaNa).includes(q))
  return byName
}

/** 캐시 무효화 (sync 직후 호출 가능) */
export function invalidateIndex(category?: AlioCategory): void {
  if (category) {
    caches.delete(category)
  } else {
    caches.clear()
  }
}

/**
 * 디스크에 manifest 가 있는(=수집 완료된) 모든 기관.
 * 비교 도구가 사용자/환경변수로 대상 기관을 받지 못했을 때의 자동 fallback 용.
 */
export function getCollectedInstitutions(cacheRef: IndexCache): Institution[] {
  const seen = new Set<string>()
  const out: Institution[] = []
  for (const { inst } of cacheRef.flatRegulations) {
    if (seen.has(inst.apbaId)) continue
    seen.add(inst.apbaId)
    out.push(inst)
  }
  return out
}
