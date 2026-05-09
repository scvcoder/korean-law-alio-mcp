/**
 * list_alio_regulations — 기관의 규정 목록 조회
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, loadIndex } from "../../lib/alio/index-loader.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const ListAlioRegulationsSchema = z.object({
  institution: z.string().describe("기관코드(apbaId, 예: 'C0xxx') 또는 기관명 일부 (예: '○○진흥원')"),
  titleFilter: z.string().optional().describe("규정 제목 필터 (부분일치)"),
  max: z.number().min(1).max(300).default(100).describe("최대 결과 수 (기본:100)"),
})

export type ListAlioRegulationsInput = z.infer<typeof ListAlioRegulationsSchema>

export async function listAlioRegulations(
  _api: LawApiClient,
  input: ListAlioRegulationsInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
    const inst = findInstitution(idx, input.institution)
    if (!inst) {
      return {
        content: [
          {
            type: "text",
            text: `기관을 찾을 수 없습니다: '${input.institution}'. search_institution 으로 확인하세요.`,
          },
        ],
        isError: true,
      }
    }

    const manifest = idx.manifests.get(inst.apbaId)
    if (!manifest || manifest.regulations.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `[${inst.apbaId}] ${inst.apbaNa} — 받아진 규정이 없습니다. \`korean-law-alio-mcp fetch-data\` 로 전체 mirror 를 받아주세요.`,
          },
        ],
      }
    }

    const filter = input.titleFilter?.trim()
    let regs = manifest.regulations
    if (filter) regs = regs.filter((r) => r.title.includes(filter))

    const sliced = regs.slice(0, input.max)
    const lines: string[] = []
    lines.push(`[${inst.apbaId}] ${inst.apbaNa} — 규정 ${regs.length}건 중 ${sliced.length}건 표시`)
    lines.push("")
    for (const r of sliced) {
      const revCnt = r.revisions.length
      const badges: string[] = []
      if (!r.mdPath) badges.push("본문없음")
      else if (r.parseError) badges.push("파싱실패")
      else if (r.fallbackParser) badges.push(`OCR:${r.fallbackParser}`)
      const badgeStr = badges.length > 0 ? ` [${badges.join(", ")}]` : ""
      lines.push(
        `• ${r.title} [regId=${r.regId}] 제·개정 ${r.issuedAt || "-"} / 수정 ${r.revisedAt || "-"}${revCnt ? ` · 이전본 ${revCnt}건` : ""}${badgeStr}`
      )
    }
    lines.push("")
    lines.push(`💡 본문 조회: get_alio_regulation(institution="${inst.apbaId}", regId="<ID>")`)
    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "list_alio_regulations")
  }
}
