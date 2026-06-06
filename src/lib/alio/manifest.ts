/**
 * manifest.json 읽기/쓰기 + 해시 기반 incremental sync 판정
 */

import fs from "node:fs/promises"
import crypto from "node:crypto"
import path from "node:path"
import {
  institutionDir,
  manifestPath,
  categoryManifestPath,
  institutionsIndexPath,
  syncStatePath,
  type AlioCategory,
} from "./paths.js"
import type {
  Manifest,
  ManifestEntry,
  InstitutionsIndex,
  SyncState,
} from "./types.js"

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return null
    throw err
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const json = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, json, "utf8")
}

export async function readManifest(apbaId: string): Promise<Manifest | null> {
  return readJsonIfExists<Manifest>(manifestPath(apbaId))
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await fs.mkdir(path.join(institutionDir(manifest.apbaId), "regulations"), {
    recursive: true,
  })
  await writeJson(manifestPath(manifest.apbaId), manifest)
}

/**
 * 카테고리별 manifest 읽기.
 * - regulations: {apbaId}/manifest.json (기존)
 * - 그 외: {apbaId}/{category}/manifest.json
 */
export async function readCategoryManifest(
  apbaId: string,
  category: AlioCategory
): Promise<Manifest | null> {
  return readJsonIfExists<Manifest>(categoryManifestPath(apbaId, category))
}

/**
 * 카테고리별 manifest 쓰기. 본문 MD 디렉터리도 같이 mkdir.
 * - regulations: {apbaId}/manifest.json + {apbaId}/regulations/ (기존)
 * - 그 외: {apbaId}/{category}/manifest.json + {apbaId}/{category}/
 */
export async function writeCategoryManifest(
  manifest: Manifest,
  category: AlioCategory
): Promise<void> {
  if (category === "regulations") {
    await fs.mkdir(path.join(institutionDir(manifest.apbaId), "regulations"), { recursive: true })
  } else {
    await fs.mkdir(path.join(institutionDir(manifest.apbaId), category), { recursive: true })
  }
  await writeJson(categoryManifestPath(manifest.apbaId, category), manifest)
}

export async function readInstitutionsIndex(): Promise<InstitutionsIndex | null> {
  return readJsonIfExists<InstitutionsIndex>(institutionsIndexPath())
}

export async function writeInstitutionsIndex(idx: InstitutionsIndex): Promise<void> {
  await writeJson(institutionsIndexPath(), idx)
}

export async function readSyncState(): Promise<SyncState> {
  const existing = await readJsonIfExists<SyncState>(syncStatePath())
  return existing ?? { perInstitution: {} }
}

export async function writeSyncState(state: SyncState): Promise<void> {
  await writeJson(syncStatePath(), state)
}

export function hashBuffer(buffer: ArrayBuffer | Buffer | Uint8Array): string {
  const h = crypto.createHash("sha256")
  const bytes =
    Buffer.isBuffer(buffer)
      ? buffer
      : buffer instanceof Uint8Array
        ? Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : Buffer.from(buffer)
  h.update(bytes)
  return "sha256:" + h.digest("hex")
}

/**
 * 기존 manifest 에 있는 이 regId 의 primaryFileNo 와 현재 후보 primaryFileNo 가 같으면 "skip".
 * revisions 가 늘었거나 primary 가 바뀌었으면 "refetch".
 */
export function needsRefetch(
  existing: ManifestEntry | undefined,
  candidatePrimaryFileNo: string,
  candidateRevisionFileNos: string[]
): boolean {
  if (!existing) return true
  if (existing.primaryFileNo !== candidatePrimaryFileNo) return true
  const existingRevs = new Set(existing.revisions.map((r) => r.fileNo))
  for (const rev of candidateRevisionFileNos) {
    if (!existingRevs.has(rev)) return true
  }
  return false
}
