/**
 * get_recent_alio_revisions — 최근 개정 규정 타임라인
 *
 * 지정한 기간 내(default 90일) 개정된 ALIO 공공기관 규정을 날짜 역순으로 반환.
 * "최근 인사 규정 바뀐 데?", "이번 분기 개정 활발한 기관" 같은 모니터링 질의용.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, loadIndex } from "../../lib/alio/index-loader.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const GetRecentAlioRevisionsSchema = z.object({
  days: z.number().min(1).max(3650).default(90).describe("최근 N일 (기본:90)"),
  topic: z.string().optional().describe("규정 제목 키워드 필터 (예: '인사', '징계')"),
  institutions: z
    .array(z.string())
    .optional()
    .describe("대상 기관코드/기관명 목록. 생략 시 전체 기관"),
  max: z.number().min(1).max(200).default(30).describe("최대 결과 수 (기본:30)"),
})

export type GetRecentAlioRevisionsInput = z.infer<typeof GetRecentAlioRevisionsSchema>

interface RevisionRow {
  date: Date
  dateStr: string
  apbaId: string
  apbaNa: string
  regId: string
  title: string
}

export async function getRecentAlioRevisions(
  _api: LawApiClient,
  input: GetRecentAlioRevisionsInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()

    if (idx.flatRegulations.length === 0) {
      return {
        content: [
          { type: "text", text: "수집된 ALIO 데이터가 없습니다. `korean-law-alio-mcp fetch-data` 로 받아주세요." },
        ],
        isError: true,
      }
    }

    const cutoffMs = Date.now() - input.days * 86400000
    const cutoff = new Date(cutoffMs)

    // 기관 필터 — apbaId Set
    const instFilter = input.institutions?.length
      ? new Set(
          input.institutions
            .map((c) => findInstitution(idx, c)?.apbaId)
            .filter((x): x is string => !!x)
        )
      : null

    const topic = input.topic?.trim().toLowerCase()

    const rows: RevisionRow[] = []
    for (const { inst, entry } of idx.flatRegulations) {
      if (instFilter && !instFilter.has(inst.apbaId)) continue
      if (topic && !entry.title.toLowerCase().includes(topic)) continue

      const dateStr = entry.revisedAt || entry.issuedAt
      if (!dateStr) continue
      const date = parseAlioDate(dateStr)
      if (!date || date < cutoff) continue

      rows.push({
        date,
        dateStr,
        apbaId: inst.apbaId,
        apbaNa: inst.apbaNa,
        regId: entry.regId,
        title: entry.title,
      })
    }

    rows.sort((a, b) => b.date.getTime() - a.date.getTime())
    const sliced = rows.slice(0, input.max)

    const lines: string[] = []
    const fromStr = cutoff.toISOString().slice(0, 10)
    const toStr = new Date().toISOString().slice(0, 10)
    lines.push(`# 최근 ${input.days}일 개정된 규정 (${fromStr} ~ ${toStr})`)
    if (input.topic) lines.push(`> 제목 필터: "${input.topic}"`)
    if (input.institutions?.length) lines.push(`> 기관 필터: ${input.institutions.join(", ")}`)
    lines.push(`> 매칭: ${rows.length}건 (표시: ${sliced.length}건)`)
    lines.push("")

    if (sliced.length === 0) {
      lines.push("- 조건에 맞는 개정 이력이 없습니다.")
    } else {
      for (const r of sliced) {
        lines.push(`- ${r.dateStr.padEnd(10)} [${r.apbaId}] ${r.apbaNa} — ${r.title} (regId=${r.regId})`)
      }
    }

    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "get_recent_alio_revisions")
  }
}

/** ALIO 날짜 형식("2026.04.08", "2026-04-08", "20260408") → Date */
function parseAlioDate(s: string): Date | null {
  const cleaned = s.trim().replace(/[./]/g, "-")
  let m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m && /^\d{8}$/.test(s)) m = ["", s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)] as RegExpMatchArray
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`)
  return isNaN(date.getTime()) ? null : date
}
