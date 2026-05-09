/**
 * get_alio_institution_profile — 한 공공기관의 규정 체계 요약
 *
 * 보유 규정 수, 분류별 분포, 평균 개정 빈도, 최근 개정 활동 등.
 * 비교/분석 전 사전 조사 또는 처음 보는 기관 빠른 파악용.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, loadIndex } from "../../lib/alio/index-loader.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const GetAlioInstitutionProfileSchema = z.object({
  institution: z.string().describe("기관코드(apbaId) 또는 기관명 일부"),
  topCategories: z.number().min(3).max(20).default(8).describe("분류별 분포 상위 N (기본:8)"),
  recentRevisions: z.number().min(0).max(20).default(5).describe("최근 개정 규정 표시 개수 (기본:5)"),
})

export type GetAlioInstitutionProfileInput = z.infer<typeof GetAlioInstitutionProfileSchema>

export async function getAlioInstitutionProfile(
  _api: LawApiClient,
  input: GetAlioInstitutionProfileInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
    const inst = findInstitution(idx, input.institution)
    if (!inst) {
      return {
        content: [
          { type: "text", text: `기관을 찾을 수 없습니다: ${input.institution}` },
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
        isError: true,
      }
    }

    const regs = manifest.regulations
    const totalRegs = regs.length

    // 개정 통계
    const totalRevs = regs.reduce((sum, r) => sum + (r.revisions?.length || 0), 0)
    const avgRevs = (totalRevs / totalRegs).toFixed(1)
    const maxRevs = regs.reduce((m, r) => Math.max(m, r.revisions?.length || 0), 0)
    const errCount = regs.filter((r) => r.parseError).length

    // 분류 분포
    const catCount = new Map<string, number>()
    for (const r of regs) {
      const c = r.category || "(미분류)"
      catCount.set(c, (catCount.get(c) || 0) + 1)
    }
    const topCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, input.topCategories)

    // 최근 개정 (revisedAt 기준 정렬)
    const withDate = regs
      .map((r) => ({ r, date: parseAlioDate(r.revisedAt || r.issuedAt || "") }))
      .filter((x): x is { r: typeof regs[number]; date: Date } => !!x.date)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
    const recentRegs = withDate.slice(0, input.recentRevisions)
    const lastUpdated = withDate[0]?.date?.toISOString().slice(0, 10) ?? "(날짜 정보 없음)"

    const lines: string[] = []
    lines.push(`# [${inst.apbaId}] ${inst.apbaNa}`)
    lines.push("")
    lines.push("## 기관 메타")
    lines.push(`- 기관 유형: ${inst.typeNa || "(미상)"}`)
    lines.push(`- 주무부처: ${inst.jidtNa || "(미상)"}`)
    lines.push(`- 마지막 sync: ${manifest.fetchedAt || "(미상)"}`)
    lines.push("")
    lines.push("## 규정 통계")
    lines.push(`- 보유 규정: ${totalRegs}건`)
    lines.push(`- 평균 개정 이력: ${avgRevs}회/규정 (최대 ${maxRevs}회)`)
    lines.push(`- 가장 최근 개정일: ${lastUpdated}`)
    if (errCount > 0) {
      lines.push(`- 파싱 에러: ${errCount}건 (${((errCount / totalRegs) * 100).toFixed(1)}%)`)
    }
    lines.push("")
    lines.push(`## 분류(category) 분포 (top ${input.topCategories})`)
    if (topCats.length === 0) {
      lines.push("- (분류 정보 없음)")
    } else {
      for (const [c, n] of topCats) {
        lines.push(`- ${c}: ${n}건`)
      }
    }
    if (input.recentRevisions > 0 && recentRegs.length > 0) {
      lines.push("")
      lines.push(`## 최근 개정 규정 (top ${input.recentRevisions})`)
      for (const { r, date } of recentRegs) {
        lines.push(`- ${date.toISOString().slice(0, 10)} ${r.title} (regId=${r.regId})`)
      }
    }

    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "get_alio_institution_profile")
  }
}

function parseAlioDate(s: string): Date | null {
  const cleaned = s.trim().replace(/[./]/g, "-")
  let m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m && /^\d{8}$/.test(s)) m = ["", s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)] as RegExpMatchArray
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`)
  return isNaN(date.getTime()) ? null : date
}
