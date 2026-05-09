/**
 * search_institution — ALIO 공공기관 검색
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { loadIndex, normalize } from "../../lib/alio/index-loader.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const SearchInstitutionSchema = z.object({
  query: z.string().optional().describe("기관명 일부('인터넷진흥원') 또는 apbaId('C0399') — 양방향 검색"),
  ministry: z.string().optional().describe("주무부처 (예: '과학기술정보통신부')"),
  type: z.string().optional().describe("기관유형 (예: '기타공공기관', '준정부기관')"),
  max: z.number().min(1).max(50).default(20).describe("최대 결과 수 (기본:20)"),
})

export type SearchInstitutionInput = z.infer<typeof SearchInstitutionSchema>

export async function searchInstitution(
  _api: LawApiClient,
  input: SearchInstitutionInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
    if (idx.institutions.length === 0 && idx.manifests.size === 0) {
      return {
        content: [
          {
            type: "text",
            text: "ALIO 데이터가 아직 받아지지 않았습니다. `korean-law-alio-mcp fetch-data` 로 받아주세요.",
          },
        ],
        isError: true,
      }
    }

    const q = input.query ? normalize(input.query) : ""
    const ministry = input.ministry ? normalize(input.ministry) : ""
    const type = input.type ? normalize(input.type) : ""

    const scored = idx.institutions
      .map((inst) => {
        if (q && !normalize(inst.apbaNa).includes(q) && inst.apbaId.toLowerCase() !== input.query?.toLowerCase()) {
          return null
        }
        if (ministry && !normalize(inst.jidtNa).includes(ministry)) return null
        if (type && !normalize(inst.typeNa).includes(type)) return null
        return inst
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, input.max)

    if (scored.length === 0) {
      return {
        content: [{ type: "text", text: "조건에 맞는 기관이 없습니다." }],
      }
    }

    const lines: string[] = []
    lines.push(`검색 결과 ${scored.length}건:`)
    lines.push("")
    for (const inst of scored) {
      const regCount = idx.manifests.get(inst.apbaId)?.regulations.length ?? 0
      lines.push(
        `• [${inst.apbaId}] ${inst.apbaNa} — ${inst.typeNa}, ${inst.jidtNa} (규정 ${regCount}건)`
      )
    }
    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "search_institution")
  }
}
