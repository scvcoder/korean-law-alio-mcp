/**
 * compare_alio_regulations — 토픽 기준 기관간 조문 비교
 *
 * 비교 대상 기관:
 *   - input.institutions 가 있으면 그대로 사용 (사용자가 자연어로 지정한 기관들)
 *   - 없으면 수집된 전체 기관 자동 (LLM 이 토픽만 던지거나 "랜덤/전체" 의도 시)
 *
 * 토픽 매칭 없는 기관은 결과에서 자동 제외 — 광범위 비교가 자연스럽게 좁혀짐.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import {
  findInstitution,
  getCollectedInstitutions,
  loadIndex,
  readRegulationMd,
} from "../../lib/alio/index-loader.js"
import { expandTopicKeywords, findTopicSnippets, titleSimilarity } from "../../lib/alio/compare.js"
import { truncateResponse, truncateSections } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const CompareAlioRegulationsSchema = z.object({
  topic: z.string().min(2).describe("비교할 주제 키워드 (예: '블라인드 채용', '휴직', '징계')"),
  institutions: z
    .array(z.string())
    .optional()
    .describe("비교 대상 기관코드/기관명 (선택). 생략 시 수집된 전체 기관에서 토픽 매칭 자동 추출. 사용자가 'A, B 기관과 비교'처럼 특정하면 해당 명칭/코드를 배열로 전달."),
  maxPerInstitution: z
    .number()
    .min(1)
    .max(5)
    .default(2)
    .describe("기관당 최대 히트 규정 수"),
})

export type CompareAlioRegulationsInput = z.infer<typeof CompareAlioRegulationsSchema>

export async function compareAlioRegulations(
  _api: LawApiClient,
  input: CompareAlioRegulationsInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
    const keywords = expandTopicKeywords(input.topic)

    const targets = input.institutions?.length
      ? input.institutions.map((c) => findInstitution(idx, c)).filter((x): x is NonNullable<typeof x> => !!x)
      : getCollectedInstitutions(idx)

    if (targets.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "수집된 ALIO 데이터가 없습니다. `korean-law-alio-mcp fetch-data` 로 받아주세요.",
          },
        ],
        isError: true,
      }
    }

    const sections: string[] = []
    for (const inst of targets) {
      const manifest = idx.manifests.get(inst.apbaId)
      if (!manifest) {
        sections.push(`▶ [${inst.apbaId}] ${inst.apbaNa}\n  (수집 데이터 없음)`)
        continue
      }

      // 1. 제목에 토픽 키워드가 포함된 규정 우선
      const titleHits = manifest.regulations.filter((r) =>
        keywords.some((k) => r.title.includes(k))
      )
      // 2. 제목 히트가 없으면 유사도 높은 규정 상위
      const ranked = titleHits.length
        ? titleHits
        : [...manifest.regulations]
            .map((r) => ({ r, s: titleSimilarity(r.title, input.topic) }))
            .sort((a, b) => b.s - a.s)
            .filter((x) => x.s > 0)
            .map((x) => x.r)

      const picked = ranked.slice(0, input.maxPerInstitution)
      if (picked.length === 0) {
        sections.push(`▶ [${inst.apbaId}] ${inst.apbaNa}\n  (관련 규정 없음 — 벤치마킹 기회)`)
        continue
      }

      const blocks: string[] = [`▶ [${inst.apbaId}] ${inst.apbaNa}`]
      for (const entry of picked) {
        const ocrBadge = entry.fallbackParser ? ` [OCR:${entry.fallbackParser}]` : ""
        blocks.push(`\n● ${entry.title} (regId=${entry.regId})${ocrBadge}`)
        if (!entry.mdPath) {
          blocks.push("  (본문 없음)")
          continue
        }
        const md = await readRegulationMd(inst.apbaId, entry.regId)
        if (!md) {
          blocks.push("  (본문 파일 누락)")
          continue
        }
        const snippets = findTopicSnippets(md, input.topic, {
          maxSnippets: 3,
          contextLines: 2,
        })
        if (snippets.length === 0) {
          blocks.push("  (본문에 토픽 키워드 직접 일치 없음 — 제목 기반 매칭)")
        } else {
          for (const s of snippets) {
            blocks.push(`  ─ L${s.lineNo}\n${indent(s.snippet, 4)}`)
          }
        }
      }
      sections.push(blocks.join("\n"))
    }

    const header = `토픽 비교: "${input.topic}" (키워드: ${expandTopicKeywords(input.topic).join(", ")})`
    const body = [header, "", ...sections].join("\n\n")
    return { content: [{ type: "text", text: truncateSections(body) }] }
  } catch (err) {
    return formatToolError(err, "compare_alio_regulations")
  }
}

function indent(text: string, n: number): string {
  const pad = " ".repeat(n)
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n")
}
