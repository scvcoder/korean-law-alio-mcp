/**
 * get_alio_statistics — ALIO 수집 데이터 개관
 *
 * 총 기관/규정 수, 기관유형·주무부처·분류 분포, 개정 빈도 등.
 * LLM 이 답변 전 scope 를 가늠하거나, 사용자가 데이터 신뢰성을 판단할 때 사용.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { loadIndex } from "../../lib/alio/index-loader.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const GetAlioStatisticsSchema = z.object({
  topN: z.number().min(3).max(50).default(10).describe("각 분포의 상위 N 항목 (기본:10)"),
  byType: z.boolean().default(true).describe("기관유형별 분포 포함"),
  byMinistry: z.boolean().default(true).describe("주무부처별 분포 포함"),
  byCategory: z.boolean().default(true).describe("규정 분류(category) 분포 포함"),
})

export type GetAlioStatisticsInput = z.infer<typeof GetAlioStatisticsSchema>

export async function getAlioStatistics(
  _api: LawApiClient,
  input: GetAlioStatisticsInput
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

    const totalInst = idx.manifests.size
    const totalReg = idx.flatRegulations.length
    const avgPerInst = totalInst > 0 ? (totalReg / totalInst).toFixed(1) : "0"

    // 개정 빈도
    const withRevs2 = idx.flatRegulations.filter((r) => (r.entry.revisions ?? []).length >= 1).length
    const totalRevisions = idx.flatRegulations.reduce(
      (sum, r) => sum + ((r.entry.revisions ?? []).length || 0),
      0
    )
    const avgRevs = totalReg > 0 ? (totalRevisions / totalReg).toFixed(1) : "0"

    // parseError
    const errCount = idx.flatRegulations.filter((r) => r.entry.parseError).length

    // 분포 집계
    const typeCount = new Map<string, number>()
    const ministryCount = new Map<string, number>()
    const categoryCount = new Map<string, number>()

    for (const inst of idx.manifests.values()) {
      const t = inst.typeNa || "(미상)"
      const m = inst.jidtNa || "(미상)"
      typeCount.set(t, (typeCount.get(t) || 0) + 1)
      ministryCount.set(m, (ministryCount.get(m) || 0) + 1)
    }
    for (const { entry } of idx.flatRegulations) {
      const c = entry.category || "(미분류)"
      categoryCount.set(c, (categoryCount.get(c) || 0) + 1)
    }

    const lines: string[] = []
    lines.push("# ALIO 수집 데이터 개관")
    lines.push("")
    lines.push("## 규모")
    lines.push(`- 총 공공기관: ${totalInst}개`)
    lines.push(`- 총 내부규정: ${totalReg.toLocaleString()}건`)
    lines.push(`- 평균 규정 수/기관: ${avgPerInst}건`)
    lines.push(`- 평균 개정 이력/규정: ${avgRevs}회`)
    lines.push(`- 개정 이력 1회 이상: ${withRevs2.toLocaleString()}건 (${((withRevs2 / totalReg) * 100).toFixed(1)}%)`)
    lines.push(`- 파싱 에러: ${errCount}건 (${((errCount / totalReg) * 100).toFixed(2)}%)`)

    if (input.byType) {
      lines.push("")
      lines.push(`## 기관 유형 분포 (top ${input.topN})`)
      formatDistribution(lines, typeCount, input.topN, totalInst)
    }
    if (input.byMinistry) {
      lines.push("")
      lines.push(`## 주무부처 분포 (top ${input.topN})`)
      formatDistribution(lines, ministryCount, input.topN, totalInst)
    }
    if (input.byCategory) {
      lines.push("")
      lines.push(`## 규정 분류(category) 분포 (top ${input.topN})`)
      lines.push("> ALIO 분류 코드 — K11xx(감사), K13xx(직제), K15xx(정관) 등")
      formatDistribution(lines, categoryCount, input.topN, totalReg)
    }

    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "get_alio_statistics")
  }
}

function formatDistribution(lines: string[], map: Map<string, number>, topN: number, total: number): void {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN)
  for (const [k, v] of sorted) {
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0"
    lines.push(`- ${k}: ${v.toLocaleString()}건 (${pct}%)`)
  }
}
