/**
 * suggest_alio_benchmark — 동종기관(peers)에는 있으나 기준기관(base)에는 없는 규정 제안
 *
 * 제목 유사도 기반 간단한 매칭:
 * peer 기관의 각 규정이 base 기관 규정과 유사도 threshold 이하라면 "base 에 없음"으로 판정.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, getCollectedInstitutions, loadIndex } from "../../lib/alio/index-loader.js"
import { titleSimilarity } from "../../lib/alio/compare.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const SuggestAlioBenchmarkSchema = z.object({
  base: z.string().describe("기준 기관(내 기관) — 코드 또는 기관명"),
  peers: z.array(z.string()).optional().describe("비교 피어 기관 목록 (선택). 생략 시 수집된 전체 기관(base 제외) 자동 사용. 사용자가 특정 피어를 지목하면 해당 명칭/코드를 배열로 전달."),
  topic: z.string().optional().describe("토픽 키워드 필터 (제목에 포함된 규정만 비교)"),
  similarityThreshold: z.number().min(0).max(1).default(0.35).describe("같은 규정으로 볼 유사도 하한"),
  max: z.number().min(1).max(40).default(15).describe("제안 최대 건수"),
})

export type SuggestAlioBenchmarkInput = z.infer<typeof SuggestAlioBenchmarkSchema>

export async function suggestAlioBenchmark(
  _api: LawApiClient,
  input: SuggestAlioBenchmarkInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
    const base = findInstitution(idx, input.base)
    if (!base) {
      return {
        content: [{ type: "text", text: `기준 기관을 찾을 수 없습니다: '${input.base}'` }],
        isError: true,
      }
    }
    const baseManifest = idx.manifests.get(base.apbaId)
    if (!baseManifest) {
      return {
        content: [{ type: "text", text: `기준 기관의 manifest 없음: ${base.apbaId}` }],
        isError: true,
      }
    }

    const peers = (input.peers?.length
      ? input.peers.map((c) => findInstitution(idx, c)).filter((x): x is NonNullable<typeof x> => !!x)
      : getCollectedInstitutions(idx)
    ).filter((p) => p.apbaId !== base.apbaId)

    if (peers.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "비교할 피어 기관이 없습니다. `korean-law-alio-mcp fetch-data` 로 전체 mirror 를 다시 받아주세요.",
          },
        ],
        isError: true,
      }
    }

    const baseTitles = baseManifest.regulations.map((r) => r.title)
    const topic = input.topic?.trim()

    type Candidate = {
      peer: string
      peerId: string
      title: string
      regId: string
      bestSim: number
      bestMatch?: string
    }
    const candidates: Candidate[] = []

    for (const peer of peers) {
      const mf = idx.manifests.get(peer.apbaId)
      if (!mf) continue
      for (const r of mf.regulations) {
        if (topic && !r.title.includes(topic)) continue
        let bestSim = 0
        let bestMatch: string | undefined
        for (const bt of baseTitles) {
          const s = titleSimilarity(r.title, bt)
          if (s > bestSim) {
            bestSim = s
            bestMatch = bt
          }
        }
        if (bestSim < input.similarityThreshold) {
          candidates.push({
            peer: peer.apbaNa,
            peerId: peer.apbaId,
            title: r.title,
            regId: r.regId,
            bestSim,
            bestMatch,
          })
        }
      }
    }

    candidates.sort((a, b) => a.bestSim - b.bestSim)
    const picked = candidates.slice(0, input.max)

    const lines: string[] = []
    lines.push(
      `🔍 벤치마킹 제안 — 기준 [${base.apbaId}] ${base.apbaNa} 에 유사 규정이 없는 피어 규정`
    )
    if (topic) lines.push(`토픽 필터: "${topic}"`)
    lines.push(`유사도 임계값: ${input.similarityThreshold}`)
    lines.push(`피어 기관: ${peers.map((p) => `${p.apbaNa}(${p.apbaId})`).join(", ") || "(없음)"}`)
    lines.push("")
    if (picked.length === 0) {
      lines.push("피어 기관 규정이 모두 기준 기관에 대응되거나 수집되지 않았습니다.")
    } else {
      for (const c of picked) {
        lines.push(
          `• [${c.peerId}] ${c.peer} — "${c.title}" (regId=${c.regId}) — 기준기관 최고유사 ${(c.bestSim * 100).toFixed(0)}%${c.bestMatch ? ` (← "${c.bestMatch}")` : ""}`
        )
      }
    }
    lines.push("")
    lines.push(
      `💡 상세 조회: get_alio_regulation(institution="<peerId>", regId="<regId>")`
    )
    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "suggest_alio_benchmark")
  }
}
