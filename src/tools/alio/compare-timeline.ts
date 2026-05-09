/**
 * compare_regulation_timeline — 기관간 동일 토픽 규정의 제·개정 타임라인 비교
 *
 * manifest 의 issuedAt / revisedAt / revisions[].filename 만으로 구성.
 * 네트워크 호출 없음.
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, getCollectedInstitutions, loadIndex } from "../../lib/alio/index-loader.js"
import { parseRevisionDate, titleSimilarity } from "../../lib/alio/compare.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"
import type { Institution, ManifestEntry } from "../../lib/alio/types.js"

export const CompareRegulationTimelineSchema = z.object({
  topic: z.string().min(2).describe("비교할 규정 주제 (예: '인사규정', '휴직', '블라인드 채용')"),
  institutions: z
    .array(z.string())
    .optional()
    .describe("비교 대상 기관코드/기관명 목록 (선택). 생략 시 수집된 전체 기관 자동 사용. 사용자가 특정 기관을 지목하면 해당 명칭/코드를 배열로 전달."),
  maxPerInstitution: z
    .number()
    .min(1)
    .max(5)
    .default(1)
    .describe("기관당 최대 매칭 규정 수 (기본:1, 가장 관련도 높은 1건)"),
})

export type CompareRegulationTimelineInput = z.infer<typeof CompareRegulationTimelineSchema>

interface TimelineRow {
  inst: Institution
  entry: ManifestEntry
  /** 제정일 (issuedAt 또는 revisions 중 최초 날짜) */
  createdAt?: string
  /** 개정본 타임라인 (YYYY-MM-DD 순) */
  revisionDates: string[]
  /** 총 개정 횟수 (현행 포함, 파일 수) */
  revisionCount: number
}

export async function compareRegulationTimeline(
  _api: LawApiClient,
  input: CompareRegulationTimelineInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
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

    const rows: TimelineRow[] = []
    const missing: string[] = []

    for (const inst of targets) {
      const manifest = idx.manifests.get(inst.apbaId)
      if (!manifest) {
        missing.push(`${inst.apbaId}(${inst.apbaNa}): manifest 없음`)
        continue
      }

      // 1. 제목에 topic 포함 또는 유사도 높은 규정
      const titleHits = manifest.regulations.filter((r) => r.title.includes(input.topic))
      const ranked = titleHits.length
        ? titleHits
        : [...manifest.regulations]
            .map((r) => ({ r, s: titleSimilarity(r.title, input.topic) }))
            .sort((a, b) => b.s - a.s)
            .filter((x) => x.s > 0.2)
            .map((x) => x.r)

      const picked = ranked.slice(0, input.maxPerInstitution)
      if (picked.length === 0) {
        missing.push(`${inst.apbaId}(${inst.apbaNa}): '${input.topic}' 관련 규정 없음`)
        continue
      }

      for (const entry of picked) {
        // primary + revisions 모두의 filename 에서 날짜 파싱
        const allFilenames = [entry.primaryFileName, ...entry.revisions.map((r) => r.filename)]
        const dates = allFilenames
          .map((f) => parseRevisionDate(f))
          .filter((d): d is string => !!d)
          .sort() // YYYY-MM-DD 이므로 문자열 정렬 = 시간 정렬
        const createdAt = dates[0] || entry.issuedAt || undefined
        rows.push({
          inst,
          entry,
          createdAt,
          revisionDates: dates,
          revisionCount: allFilenames.length,
        })
      }
    }

    if (rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text:
              `'${input.topic}' 관련 규정을 보유한 기관이 없습니다.\n` +
              missing.map((m) => `  · ${m}`).join("\n"),
          },
        ],
      }
    }

    // 포맷 출력
    const lines: string[] = []
    lines.push(`▶ 토픽 "${input.topic}" 개정 타임라인 비교`)
    lines.push("")

    // 요약 표
    lines.push("● 요약 (기관·규정별)")
    const instCol = Math.max(...rows.map((r) => r.inst.apbaNa.length), 4)
    const titleCol = Math.max(...rows.map((r) => r.entry.title.length), 6)
    const header = `  ${"기관".padEnd(instCol, " ")} | [apbaId] | ${"규정".padEnd(titleCol, " ")} | 제정일     | 최종개정   | 총개정`
    lines.push(header)
    lines.push(`  ${"-".repeat(header.length - 2)}`)
    for (const r of rows) {
      const last = r.revisionDates[r.revisionDates.length - 1] || r.entry.revisedAt || "-"
      lines.push(
        `  ${r.inst.apbaNa.padEnd(instCol, " ")} | [${r.inst.apbaId}] | ${r.entry.title.padEnd(titleCol, " ")} | ${(r.createdAt || "-").padEnd(10, " ")} | ${last.padEnd(10, " ")} | ${r.revisionCount}회`
      )
    }

    // 인사이트
    if (rows.length > 1) {
      lines.push("")
      lines.push("● 인사이트")
      const withCreated = rows.filter((r) => r.createdAt)
      if (withCreated.length > 0) {
        const earliest = withCreated.reduce((a, b) => (a.createdAt! < b.createdAt! ? a : b))
        const latest = withCreated.reduce((a, b) => (a.createdAt! > b.createdAt! ? a : b))
        lines.push(
          `  - 가장 먼저 제정: [${earliest.inst.apbaId}] ${earliest.inst.apbaNa} "${earliest.entry.title}" (${earliest.createdAt})`
        )
        if (earliest !== latest) {
          lines.push(
            `  - 가장 늦게 제정: [${latest.inst.apbaId}] ${latest.inst.apbaNa} "${latest.entry.title}" (${latest.createdAt})`
          )
        }
      }
      const mostAmended = rows.reduce((a, b) => (a.revisionCount >= b.revisionCount ? a : b))
      const leastAmended = rows.reduce((a, b) => (a.revisionCount <= b.revisionCount ? a : b))
      if (mostAmended !== leastAmended) {
        lines.push(
          `  - 개정 빈도 최다: [${mostAmended.inst.apbaId}] ${mostAmended.inst.apbaNa} (${mostAmended.revisionCount}회)`
        )
        lines.push(
          `  - 개정 빈도 최소: [${leastAmended.inst.apbaId}] ${leastAmended.inst.apbaNa} (${leastAmended.revisionCount}회)`
        )
      }
      // 최근 1년 개정 여부
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const cutoff = oneYearAgo.toISOString().slice(0, 10)
      const recent = rows.filter(
        (r) => r.revisionDates[r.revisionDates.length - 1] && r.revisionDates[r.revisionDates.length - 1] >= cutoff
      )
      if (recent.length > 0) {
        lines.push(`  - 최근 1년 내 개정 기관: ${recent.map((r) => r.inst.apbaId).join(", ")}`)
      }
    }

    // 기관별 상세 타임라인
    lines.push("")
    lines.push("● 기관별 개정 타임라인")
    for (const r of rows) {
      lines.push("")
      lines.push(`▷ [${r.inst.apbaId}] ${r.inst.apbaNa} — ${r.entry.title} (regId=${r.entry.regId})`)
      if (r.revisionDates.length === 0) {
        lines.push("    (파일명 날짜 파싱 실패)")
      } else {
        // 처음 5개, 현행(마지막) 1개만 출력 — 많으면 중간 생략
        const first = r.revisionDates.slice(0, 5)
        const last = r.revisionDates[r.revisionDates.length - 1]
        const shown = r.revisionDates.length <= 5 ? first : [...first, "...", last]
        for (const d of shown) lines.push(`    - ${d}`)
        if (r.revisionDates.length > 5) {
          lines.push(`    (총 ${r.revisionDates.length}회 개정, 중간 생략)`)
        }
      }
    }

    if (missing.length > 0) {
      lines.push("")
      lines.push("● 제외 기관")
      for (const m of missing) lines.push(`    · ${m}`)
    }

    return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
  } catch (err) {
    return formatToolError(err, "compare_regulation_timeline")
  }
}
