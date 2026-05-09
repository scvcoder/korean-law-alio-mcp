/**
 * get_alio_regulation — 특정 규정 본문 조회 (section 필터 선택)
 */

import { z } from "zod"
import type { LawApiClient } from "../../lib/api-client.js"
import { findInstitution, loadIndex, readRegulationMd } from "../../lib/alio/index-loader.js"
import { splitArticles } from "../../lib/alio/compare.js"
import { truncateResponse } from "../../lib/schemas.js"
import { formatToolError } from "../../lib/errors.js"
import type { ToolResponse } from "../../lib/types.js"

export const GetAlioRegulationSchema = z.object({
  institution: z.string().describe("기관코드 또는 기관명 일부"),
  regId: z.string().optional().describe("규정 ID (list_alio_regulations 의 regId). title 과 둘 중 하나"),
  title: z.string().optional().describe("규정 제목 일부(부분일치). regId 대신 사용 가능"),
  article: z
    .string()
    .optional()
    .describe("특정 조문만 (예: '제10조', '제10조의2'). 생략 시 전체 본문"),
}).refine((v) => !!(v.regId || v.title), {
  message: "regId 또는 title 중 하나는 필수입니다",
  path: ["regId"],
})

export type GetAlioRegulationInput = z.infer<typeof GetAlioRegulationSchema>

export async function getAlioRegulation(
  _api: LawApiClient,
  input: GetAlioRegulationInput
): Promise<ToolResponse> {
  try {
    const idx = await loadIndex()
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
        content: [
          { type: "text", text: `[${inst.apbaId}] ${inst.apbaNa} — 수집된 manifest 가 없습니다.` },
        ],
        isError: true,
      }
    }

    const entry =
      (input.regId && manifest.regulations.find((r) => r.regId === input.regId)) ||
      (input.title && manifest.regulations.find((r) => r.title.includes(input.title!)))
    if (!entry) {
      return {
        content: [
          {
            type: "text",
            text: `규정을 찾을 수 없습니다. list_alio_regulations(institution="${inst.apbaId}") 로 ID/제목을 확인하세요.`,
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
              `${entry.title} — 본문 파싱 실패 (${entry.fileType}).\n` +
              `사유: ${entry.parseError}\n` +
              `원본 파일: ${entry.primaryFileName}${entry.unwrappedFrom ? ` (래퍼: ${entry.unwrappedFrom})` : ""}\n` +
              `원본 URL: ${entry.sourceDetailUrl}\n\n` +
              `💡 원본 파일을 직접 확인하세요. kordoc 파서가 이 형식을 처리하지 못하는 경우가 있습니다.`,
          },
        ],
      }
    }

    const md = await readRegulationMd(inst.apbaId, entry.regId)
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

    // OCR 변환 규정이면 상단 배너 삽입 (Claude 가 출처를 사용자에게 알릴 수 있도록)
    const ocrBanner = entry.fallbackParser
      ? `⚠️ 이 규정은 원본이 스캔 이미지 PDF 여서 OCR(${entry.fallbackParser})로 텍스트를 추출한 결과입니다. 오탈자·일부 누락 가능성이 있으니 정확한 인용이 필요하면 원본 PDF 를 참조하세요.\n원본: ${entry.sourceDetailUrl}\n\n`
      : ""

    if (input.article) {
      const target = articleKey(input.article)
      const sections = splitArticles(md)
      const hit = sections.find((s) => articleKey(s.heading) === target)
      if (!hit) {
        const available = sections.slice(0, 20).map((s) => s.heading).join(", ")
        return {
          content: [
            {
              type: "text",
              text: `'${input.article}' 조문을 찾을 수 없습니다.\n사용 가능한 조문: ${available}`,
            },
          ],
          isError: true,
        }
      }
      const text = `${ocrBanner}[${inst.apbaNa}] ${entry.title} — ${hit.heading}\n\n${hit.body}`
      return { content: [{ type: "text", text: truncateResponse(text) }] }
    }

    return { content: [{ type: "text", text: truncateResponse(ocrBanner + md) }] }
  } catch (err) {
    return formatToolError(err, "get_alio_regulation")
  }
}

/** 조문 식별용 정규화 키: 공백 제거 + 괄호 주석 제거 → "제1조", "제10조의2" */
function articleKey(s: string): string {
  return s.replace(/\s+/g, "").replace(/\([^)]*\)/g, "")
}
