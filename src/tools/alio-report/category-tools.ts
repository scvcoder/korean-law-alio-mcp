/**
 * 보고서형 (reportGbn="Y") ALIO 공시 카테고리 도구 팩토리
 *
 * 단체협약(21026)·임금협약(21027)·노사협의회 의결사항(21028) 은 ALIO 에서 모두
 * 동일한 "보고서형" 구조다:
 *   - 한 기관 = N개 연도별 disclosure (regId = disclosureNo)
 *   - 한 disclosure = 여러 첨부파일을 하나의 MD 로 concat
 *   - 저장: {apbaId}/{category}/manifest.json + {apbaId}/{category}/{disclosureNo}.md
 *
 * 카테고리마다 다른 것은 (1) 디렉터리 slug (2) 한글 라벨 (3) 도구명 (4) 토픽 예시뿐이라,
 * 5개 도구 로직을 카테고리별로 복제하는 대신 이 팩토리가 descriptor 를 받아 생성한다.
 * (labor-agreements 5개 도구도 v1.2.0 부터 여기서 생성 — 단일 코드경로 유지)
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import {
  findInstitution,
  getCollectedInstitutions,
  loadIndex,
  normalize,
  readCategoryDocMd,
} from "../../lib/alio/index-loader.js"
import type { AlioCategory } from "../../lib/alio/paths.js"
import {
  expandTopicKeywords,
  findTopicSnippets,
  titleSimilarity,
} from "../../lib/alio/compare.js"
import { truncateResponse, truncateSections } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { McpTool, ToolResponse } from "../../lib/types.js"

/** 한 보고서형 카테고리를 도구로 만들기 위한 명세. */
export interface ReportCategoryDescriptor {
  /** 디렉터리/인덱서 slug (예: "labor-agreements") */
  category: AlioCategory
  /** 사용자에게 보이는 한글 라벨 (예: "단체협약") */
  label: string
  /** 5개 도구 이름 */
  names: {
    searchInstitution: string
    list: string
    get: string
    searchText: string
    compare: string
  }
  /** 토픽 검색/비교 예시 키워드 (schema describe + 설명에 사용) */
  topicExamples: string
}

/** `npm run alio:sync` 안내 문구 (데이터 미수집 시 공통) */
function syncHint(category: AlioCategory): string {
  return (
    "`korean-law-alio-mcp fetch-data` 로 mirror 를 받거나, " +
    `\`npm run alio:sync -- --category ${category}\` 로 직접 수집하세요.`
  )
}

// ─────────────────────────────────────────
// (1) search_institution — 데이터 보유 기관 검색
// ─────────────────────────────────────────

function makeSearchInstitution(d: ReportCategoryDescriptor): McpTool {
  const schema = z.object({
    query: z
      .string()
      .optional()
      .describe("기관명 일부('인터넷진흥원') 또는 apbaId('C0399') — 양방향 검색"),
    ministry: z.string().optional().describe("주무부처 (예: '과학기술정보통신부')"),
    type: z.string().optional().describe("기관유형 (예: '기타공공기관', '준정부기관')"),
    max: z.number().min(1).max(50).default(20).describe("최대 결과 수 (기본:20)"),
  })
  type Input = z.infer<typeof schema>

  const handler = async (_api: LawApiClient, input: Input): Promise<ToolResponse> => {
    try {
      const idx = await loadIndex(d.category)
      if (idx.institutions.length === 0 && idx.manifests.size === 0) {
        return {
          content: [
            { type: "text", text: `${d.label} 데이터가 아직 받아지지 않았습니다. ${syncHint(d.category)}` },
          ],
          isError: true,
        }
      }

      const q = input.query ? normalize(input.query) : ""
      const ministry = input.ministry ? normalize(input.ministry) : ""
      const type = input.type ? normalize(input.type) : ""

      const candidates = idx.institutions.filter((inst) => {
        const m = idx.manifests.get(inst.apbaId)
        return m && m.regulations.length > 0
      })

      const scored = candidates
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
        return { content: [{ type: "text", text: `조건에 맞는 ${d.label} 보유 기관이 없습니다.` }] }
      }

      const lines: string[] = []
      lines.push(`${d.label} 보유 기관 ${scored.length}건:`)
      lines.push("")
      for (const inst of scored) {
        const cnt = idx.manifests.get(inst.apbaId)?.regulations.length ?? 0
        lines.push(`• [${inst.apbaId}] ${inst.apbaNa} — ${inst.typeNa}, ${inst.jidtNa} (${d.label} ${cnt}건)`)
      }
      lines.push("")
      lines.push(`💡 목록 조회: ${d.names.list}(institution="<apbaId 또는 기관명>")`)
      return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
    } catch (err) {
      return formatToolError(err, d.names.searchInstitution)
    }
  }

  return {
    name: d.names.searchInstitution,
    description: `[ALIO ${d.label}] ${d.label} 데이터를 보유한 공공기관 검색. query 에 기관명 일부 또는 apbaId. 주무부처·기관유형 필터 지원.`,
    schema,
    handler,
  }
}

// ─────────────────────────────────────────
// (2) list — 기관의 연도별 보고서 목록
// ─────────────────────────────────────────

function makeList(d: ReportCategoryDescriptor): McpTool {
  const schema = z.object({
    institution: z
      .string()
      .describe("기관코드(apbaId, 예: 'C0xxx') 또는 기관명 일부 (예: '○○진흥원')"),
    titleFilter: z.string().optional().describe("보고서 제목 필터 (부분일치)"),
    max: z.number().min(1).max(100).default(30).describe("최대 결과 수 (기본:30)"),
  })
  type Input = z.infer<typeof schema>

  const handler = async (_api: LawApiClient, input: Input): Promise<ToolResponse> => {
    try {
      const idx = await loadIndex(d.category)
      const inst = findInstitution(idx, input.institution)
      if (!inst) {
        return {
          content: [
            {
              type: "text",
              text: `기관을 찾을 수 없습니다: '${input.institution}'. ${d.names.searchInstitution} 로 확인하세요.`,
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
              text: `[${inst.apbaId}] ${inst.apbaNa} — ${d.label} 데이터가 없습니다. ${syncHint(d.category)}`,
            },
          ],
        }
      }

      const filter = input.titleFilter?.trim()
      let regs = manifest.regulations
      if (filter) regs = regs.filter((r) => r.title.includes(filter))

      const sliced = regs.slice(0, input.max)
      const lines: string[] = []
      lines.push(`[${inst.apbaId}] ${inst.apbaNa} — ${d.label} ${regs.length}건 중 ${sliced.length}건 표시`)
      lines.push("")
      for (const r of sliced) {
        const attachCnt = 1 + r.revisions.length
        const badges: string[] = []
        if (!r.mdPath) badges.push("본문없음")
        else if (r.parseError) badges.push("파싱실패")
        else if (r.fallbackParser) badges.push(`OCR:${r.fallbackParser}`)
        const badgeStr = badges.length > 0 ? ` [${badges.join(", ")}]` : ""
        lines.push(
          `• ${r.title} [disclosureNo=${r.regId}] 게시일 ${r.issuedAt || "-"} / 수정 ${r.revisedAt || "-"} · 첨부 ${attachCnt}건${badgeStr}`
        )
      }
      lines.push("")
      lines.push(`💡 본문 조회: ${d.names.get}(institution="${inst.apbaId}", disclosureNo="<ID>")`)
      return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
    } catch (err) {
      return formatToolError(err, d.names.list)
    }
  }

  return {
    name: d.names.list,
    description: `[ALIO ${d.label}] 특정 공공기관의 ${d.label} (연도별 보고서) 목록. institution 에 기관코드(C0xxx) 또는 기관명 일부.`,
    schema,
    handler,
  }
}

// ─────────────────────────────────────────
// (3) get — 특정 보고서 본문 (첨부 섹션 선택)
// ─────────────────────────────────────────

function makeGet(d: ReportCategoryDescriptor): McpTool {
  const schema = z
    .object({
      institution: z.string().describe("기관코드 또는 기관명 일부"),
      disclosureNo: z
        .string()
        .optional()
        .describe(`${d.label} disclosureNo (${d.names.list} 의 ID). title 과 둘 중 하나`),
      title: z.string().optional().describe(`${d.label} 제목 일부(부분일치). disclosureNo 대신 사용 가능`),
      attachment: z
        .string()
        .optional()
        .describe("특정 첨부파일 섹션만 (파일명 부분일치, 예: '주요 내용'). 생략 시 전체 본문"),
    })
    .refine((v) => !!(v.disclosureNo || v.title), {
      message: "disclosureNo 또는 title 중 하나는 필수입니다",
      path: ["disclosureNo"],
    })
  type Input = z.infer<typeof schema>

  const handler = async (_api: LawApiClient, input: Input): Promise<ToolResponse> => {
    try {
      const idx = await loadIndex(d.category)
      const inst = findInstitution(idx, input.institution)
      if (!inst) {
        return {
          content: [{ type: "text", text: `기관을 찾을 수 없습니다: '${input.institution}'` }],
          isError: true,
        }
      }
      const manifest = idx.manifests.get(inst.apbaId)
      if (!manifest) {
        return {
          content: [{ type: "text", text: `[${inst.apbaId}] ${inst.apbaNa} — ${d.label} manifest 가 없습니다.` }],
          isError: true,
        }
      }

      const entry =
        (input.disclosureNo && manifest.regulations.find((r) => r.regId === input.disclosureNo)) ||
        (input.title && manifest.regulations.find((r) => r.title.includes(input.title!)))
      if (!entry) {
        return {
          content: [
            {
              type: "text",
              text: `${d.label}을(를) 찾을 수 없습니다. ${d.names.list}(institution="${inst.apbaId}") 로 ID/제목을 확인하세요.`,
            },
          ],
          isError: true,
        }
      }
      if (!entry.mdPath) {
        return {
          content: [
            {
              type: "text",
              text: `${entry.title} — 본문이 수집되지 않았습니다 (첨부 파일 없음).\n원본 URL: ${entry.sourceDetailUrl}`,
            },
          ],
        }
      }

      if (entry.parseError) {
        return {
          content: [
            {
              type: "text",
              text:
                `${entry.title} — 본문 전체 파싱 실패.\n` +
                `사유: ${entry.parseError}\n` +
                `원본 첨부: ${entry.primaryFileName}\n` +
                `원본 URL: ${entry.sourceDetailUrl}\n\n` +
                `💡 ALIO 사이트에서 원본 파일을 직접 확인하세요.`,
            },
          ],
        }
      }

      const md = await readCategoryDocMd(inst.apbaId, entry.regId, d.category)
      if (!md) {
        return {
          content: [
            {
              type: "text",
              text: `본문 파일을 읽을 수 없습니다: ${entry.mdPath}. \`korean-law-alio-mcp fetch-data\` 로 mirror 를 다시 받아주세요.`,
            },
          ],
          isError: true,
        }
      }

      const ocrBanner = entry.fallbackParser
        ? `⚠️ 이 ${d.label}은(는) 일부 첨부파일이 스캔 이미지 PDF 여서 OCR(${entry.fallbackParser}) 로 텍스트를 추출한 결과를 포함합니다. 정확한 인용이 필요하면 원본을 참조하세요.\n원본: ${entry.sourceDetailUrl}\n\n`
        : ""

      if (input.attachment) {
        const target = input.attachment.trim()
        const section = extractAttachmentSection(md, target)
        if (!section) {
          const titles = listAttachmentTitles(md)
          return {
            content: [
              {
                type: "text",
                text: `'${target}' 첨부파일을 찾을 수 없습니다.\n사용 가능한 첨부파일: ${titles.join(" / ")}`,
              },
            ],
            isError: true,
          }
        }
        const text = `${ocrBanner}[${inst.apbaNa}] ${entry.title} — ${section.heading}\n\n${section.body}`
        return { content: [{ type: "text", text: truncateResponse(text) }] }
      }

      return { content: [{ type: "text", text: truncateResponse(ocrBanner + md) }] }
    } catch (err) {
      return formatToolError(err, d.names.get)
    }
  }

  return {
    name: d.names.get,
    description: `[ALIO ${d.label}] 특정 ${d.label} 본문(markdown) 조회. 한 ${d.label} = 여러 첨부의 통합 MD. attachment 인자로 특정 첨부파일 섹션만 추출 가능.`,
    schema,
    handler,
  }
}

// ─────────────────────────────────────────
// (4) search_text — 본문 전문 검색
// ─────────────────────────────────────────

function makeSearchText(d: ReportCategoryDescriptor): McpTool {
  const schema = z.object({
    query: z.string().min(2).describe(`검색 키워드 (2자 이상, 예: ${d.topicExamples})`),
    institutions: z
      .array(z.string())
      .optional()
      .describe(`대상 기관코드(또는 기관명) 목록. 생략 시 ${d.label} 보유 전체 기관`),
    maxPerAgreement: z.number().min(1).max(5).default(2).describe("보고서당 최대 스니펫 수"),
    maxResults: z.number().min(1).max(50).default(20).describe("전체 최대 결과 수"),
  })
  type Input = z.infer<typeof schema>

  const handler = async (_api: LawApiClient, input: Input): Promise<ToolResponse> => {
    try {
      const idx = await loadIndex(d.category)
      const needle = input.query.trim()
      if (!needle) {
        return { content: [{ type: "text", text: "검색어가 비어 있습니다." }], isError: true }
      }

      const allowedApbaIds: Set<string> | null = input.institutions
        ? new Set(
            input.institutions
              .map((s) => findInstitution(idx, s)?.apbaId)
              .filter((x): x is string => !!x)
          )
        : null

      const targets = idx.flatRegulations.filter(
        (r) => !allowedApbaIds || allowedApbaIds.has(r.inst.apbaId)
      )

      const results: Array<{
        instName: string
        apbaId: string
        title: string
        disclosureNo: string
        fallbackParser?: string
        snippets: Array<{ lineNo: number; text: string }>
      }> = []

      for (const { inst, entry } of targets) {
        if (results.length >= input.maxResults) break
        if (!entry.mdPath) continue
        const md = await readCategoryDocMd(inst.apbaId, entry.regId, d.category)
        if (!md) continue
        if (!md.includes(needle)) continue
        const snippets = findSnippets(md, needle, input.maxPerAgreement)
        if (snippets.length === 0) continue
        results.push({
          instName: inst.apbaNa,
          apbaId: inst.apbaId,
          title: entry.title,
          disclosureNo: entry.regId,
          fallbackParser: entry.fallbackParser,
          snippets,
        })
      }

      if (results.length === 0) {
        return { content: [{ type: "text", text: `'${needle}' 히트 없음 (${d.label} 본문)` }] }
      }

      const lines: string[] = []
      lines.push(`'${needle}' — ${results.length}개 ${d.label}에서 히트`)
      lines.push("")
      for (const r of results) {
        const ocrBadge = r.fallbackParser ? ` [OCR:${r.fallbackParser}]` : ""
        lines.push(`▶ [${r.apbaId}] ${r.instName} — ${r.title} (disclosureNo=${r.disclosureNo})${ocrBadge}`)
        for (const s of r.snippets) {
          lines.push(`  L${s.lineNo}: ${s.text.slice(0, 180)}`)
        }
        lines.push("")
      }
      const ocrCount = results.filter((r) => r.fallbackParser).length
      if (ocrCount > 0) {
        lines.push(`ℹ️ ${ocrCount}건은 OCR 변환 본문이 일부 포함 — 정확한 인용은 원본 PDF 참조 권장.`)
      }
      return { content: [{ type: "text", text: truncateResponse(lines.join("\n")) }] }
    } catch (err) {
      return formatToolError(err, d.names.searchText)
    }
  }

  return {
    name: d.names.searchText,
    description: `[ALIO ${d.label}] 전체 수집 ${d.label} 본문에서 키워드 전문검색 (예: ${d.topicExamples}). institutions 로 기관 제한 가능.`,
    schema,
    handler,
  }
}

// ─────────────────────────────────────────
// (5) compare — 기관간 토픽 비교
// ─────────────────────────────────────────

function makeCompare(d: ReportCategoryDescriptor): McpTool {
  const schema = z.object({
    topic: z.string().min(2).describe(`비교할 주제 키워드 (예: ${d.topicExamples})`),
    institutions: z
      .array(z.string())
      .optional()
      .describe(
        `비교 대상 기관코드/기관명 (선택). 생략 시 ${d.label} 보유 전체 기관 자동. 사용자가 'A, B 기관과 비교' 처럼 특정하면 해당 명칭/코드를 배열로 전달.`
      ),
    maxPerInstitution: z.number().min(1).max(5).default(2).describe("기관당 최대 히트 보고서 수"),
  })
  type Input = z.infer<typeof schema>

  const handler = async (_api: LawApiClient, input: Input): Promise<ToolResponse> => {
    try {
      const idx = await loadIndex(d.category)
      const keywords = expandTopicKeywords(input.topic)

      const targets = input.institutions?.length
        ? input.institutions.map((c) => findInstitution(idx, c)).filter((x): x is NonNullable<typeof x> => !!x)
        : getCollectedInstitutions(idx)

      if (targets.length === 0) {
        return {
          content: [
            { type: "text", text: `수집된 ${d.label} 데이터가 없습니다. ${syncHint(d.category)}` },
          ],
          isError: true,
        }
      }

      const sections: string[] = []
      for (const inst of targets) {
        const manifest = idx.manifests.get(inst.apbaId)
        if (!manifest) {
          sections.push(`▶ [${inst.apbaId}] ${inst.apbaNa}\n  (${d.label} 데이터 없음)`)
          continue
        }

        const candidates = manifest.regulations
          .map((r) => ({ r, s: titleSimilarity(r.title, input.topic) }))
          .sort((a, b) => b.s - a.s)
          .map((x) => x.r)

        const picked = candidates.slice(0, input.maxPerInstitution)
        if (picked.length === 0) {
          sections.push(`▶ [${inst.apbaId}] ${inst.apbaNa}\n  (관련 ${d.label} 없음)`)
          continue
        }

        const blocks: string[] = [`▶ [${inst.apbaId}] ${inst.apbaNa}`]
        let hasAnyHit = false
        for (const entry of picked) {
          const ocrBadge = entry.fallbackParser ? ` [OCR:${entry.fallbackParser}]` : ""
          const block: string[] = [`\n● ${entry.title} (disclosureNo=${entry.regId})${ocrBadge}`]
          if (!entry.mdPath) {
            block.push("  (본문 없음)")
            blocks.push(...block)
            continue
          }
          const md = await readCategoryDocMd(inst.apbaId, entry.regId, d.category)
          if (!md) {
            block.push("  (본문 파일 누락)")
            blocks.push(...block)
            continue
          }
          const snippets = findTopicSnippets(md, input.topic, { maxSnippets: 3, contextLines: 2 })
          if (snippets.length === 0) {
            block.push(`  (본문에 '${input.topic}' / 확장키워드 직접 일치 없음)`)
          } else {
            hasAnyHit = true
            for (const s of snippets) {
              block.push(`  ─ L${s.lineNo}\n${indent(s.snippet, 4)}`)
            }
          }
          blocks.push(...block)
        }
        if (hasAnyHit) sections.push(blocks.join("\n"))
      }

      if (sections.length === 0) {
        return {
          content: [
            { type: "text", text: `'${input.topic}' 관련 ${d.label} 히트 없음 (대상 ${targets.length}개 기관).` },
          ],
        }
      }

      const header = `${d.label} 토픽 비교: "${input.topic}" (키워드: ${keywords.join(", ")})`
      const body = [header, "", ...sections].join("\n\n")
      return { content: [{ type: "text", text: truncateSections(body) }] }
    } catch (err) {
      return formatToolError(err, d.names.compare)
    }
  }

  return {
    name: d.names.compare,
    description: `[ALIO ${d.label}] 토픽 기준 기관간 ${d.label} 비교. institutions 생략 시 ${d.label} 보유 전체 기관 자동. 사용자가 'A·B·C 기관과 비교' 같이 특정하면 institutions 에 전달.`,
    schema,
    handler,
  }
}

// ─────────────────────────────────────────
// 팩토리 진입점 + 공통 헬퍼
// ─────────────────────────────────────────

/** descriptor 로부터 5개 registry 도구를 생성 (search_institution / list / get / search_text / compare 순) */
export function buildReportCategoryTools(d: ReportCategoryDescriptor): McpTool[] {
  return [
    makeSearchInstitution(d),
    makeList(d),
    makeGet(d),
    makeSearchText(d),
    makeCompare(d),
  ]
}

/** MD 본문에서 `## N. 파일명` 섹션을 찾는다 (다음 `## N.` 헤더 또는 EOF 까지). */
function extractAttachmentSection(
  md: string,
  filenameQuery: string
): { heading: string; body: string } | null {
  const lines = md.split(/\r?\n/)
  const q = filenameQuery.toLowerCase()
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(\d+\.\s+.*)$/)
    if (!m) continue
    if (!m[1].toLowerCase().includes(q)) continue
    const heading = m[1]
    const bodyLines: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      if (/^##\s+\d+\.\s+/.test(lines[j])) break
      bodyLines.push(lines[j])
    }
    return { heading, body: bodyLines.join("\n").replace(/^[\n\r-]+|[\n\r-]+$/g, "").trim() }
  }
  return null
}

function listAttachmentTitles(md: string): string[] {
  const out: string[] = []
  const re = /^##\s+(\d+\.\s+.*)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) out.push(m[1])
  return out
}

function findSnippets(
  md: string,
  needle: string,
  max: number
): Array<{ lineNo: number; text: string }> {
  const out: Array<{ lineNo: number; text: string }> = []
  const lines = md.split(/\r?\n/)
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (lines[i].includes(needle)) out.push({ lineNo: i + 1, text: lines[i] })
  }
  return out
}

function indent(text: string, n: number): string {
  const pad = " ".repeat(n)
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n")
}
