/**
 * ALIO 공공기관 경영정보 공개시스템 HTTP 클라이언트
 *
 * 엔드포인트는 브라우저 Vue 앱이 호출하는 AJAX 경로를 그대로 사용.
 *
 * ── 공시 카테고리별 데이터 형태 차이 ──────────────────────────────────────
 *   1. 게시판형 (reportGbn="N") — 내부규정 (reportFormRootNo=21110)
 *      · 한 기관 = N개 규정 + 각 규정마다 개정이력
 *      · detail: /item/itemBoard21110.do (HTML, 첨부파일 fileNo 추출)
 *      · download: /download/rulefiledown.json?fileNo=
 *
 *   2. 보고서형 (reportGbn="Y") — 단체협약 (21026) / 임금협약 (21027) / 노사협의회 (21028)
 *      · 한 기관 = N개 연도별 보고서 (disclosure) + 각 disclosure 에 첨부파일 여러 개
 *      · detail: /item/itemReportFiles.json?disclosureNo= (JSON, 첨부파일 메타 목록)
 *      · download: /download/file.json?f={fileNo}&d={disclosureNo}&s={submissionNo}
 *
 * 두 카테고리 모두 목록 조회는 동일한 itemReportListSusi.json 사용. reportFormRootNo 만 다름.
 */

import { fetchWithRetry } from "../fetch-with-retry.js"
import type { Institution, RegulationListItem, RegulationDetail } from "./types.js"

const ALIO_BASE = "https://www.alio.go.kr"
/** '정관 및 내부규정' 공시 루트 번호 — 게시판형 (reportGbn=N) */
export const RULE_REPORT_FORM_ROOT = 21110

/** 보고서형 공시 카테고리 → reportFormRootNo 매핑 */
export const REPORT_FORM_ROOT_BY_CATEGORY = {
  "regulations": 21110, // 내부규정 (게시판형)
  "labor-agreements": 21026, // 단체협약 (보고서형)
  "wage-agreements": 21027, // 임금협약 (보고서형) — v1.2.0+
  "labor-council": 21028, // 노사협의회 의결사항 (보고서형) — v1.3.0+
} as const

const JSON_HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (korean-law-alio-mcp) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
} as const

const HTML_HEADERS = {
  ...JSON_HEADERS,
  Accept: "text/html,application/xhtml+xml",
} as const

/** 카테고리 reportFormRootNo 에 맞는 Referer 헤더 */
function jsonHeadersFor(reportFormRootNo: number): Record<string, string> {
  return {
    ...JSON_HEADERS,
    Referer: `${ALIO_BASE}/item/itemOrganList.do?reportFormRootNo=${reportFormRootNo}`,
  }
}

function htmlHeadersFor(reportFormRootNo: number): Record<string, string> {
  return {
    ...HTML_HEADERS,
    Referer: `${ALIO_BASE}/item/itemOrganList.do?reportFormRootNo=${reportFormRootNo}`,
  }
}

function throwIfNotOk(res: Response, endpoint: string): void {
  if (!res.ok) {
    throw new Error(`ALIO ${endpoint} HTTP ${res.status}`)
  }
}

/**
 * 전체 기관 목록.
 * itemOrganListSusi.json 은 reportFormRootNo=21110 (내부규정) 에서만 동작.
 * 다른 카테고리는 같은 기관 마스터를 공유하므로 내부규정 sync 의 institutions.json 재사용 권장.
 */
export async function listInstitutions(): Promise<Institution[]> {
  const res = await fetchWithRetry(`${ALIO_BASE}/item/itemOrganListSusi.json`, {
    method: "POST",
    headers: jsonHeadersFor(RULE_REPORT_FORM_ROOT),
    body: JSON.stringify({
      apbaType: [],
      jidtDptm: [],
      area: [],
      apbaId: "",
      reportFormRootNo: String(RULE_REPORT_FORM_ROOT),
    }),
  })
  throwIfNotOk(res, "itemOrganListSusi")
  const json = (await res.json()) as { data?: { organList?: Institution[] } }
  const list = json?.data?.organList
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("ALIO 기관 목록이 비어 있습니다 — API 응답 포맷 변경 가능성")
  }
  return list
}

export interface RegulationListPage {
  items: RegulationListItem[]
  pageNo: number
  totalPages: number
  totalCount: number
  /** 해당 기관의 기본 정보(응답에 포함됨) */
  organInfo?: { apbaId?: string; apbaNa?: string; typeNa?: string; jidtNa?: string }
}

/**
 * 기관의 단일 페이지 목록 조회. reportFormRootNo 로 카테고리 분기.
 * 게시판형 (21110) 과 보고서형 (21026/21027/21028) 모두 같은 endpoint.
 */
export async function listRegulations(
  apbaId: string,
  pageNo = 1,
  apbaType = "A2005",
  reportFormRootNo: number = RULE_REPORT_FORM_ROOT
): Promise<RegulationListPage> {
  const res = await fetchWithRetry(`${ALIO_BASE}/item/itemReportListSusi.json`, {
    method: "POST",
    headers: jsonHeadersFor(reportFormRootNo),
    body: JSON.stringify({
      pageNo: String(pageNo),
      apbaId: String(apbaId),
      apbaType: String(apbaType),
      reportFormRootNo: String(reportFormRootNo),
      search_word: "",
      search_flag: "title",
      bid_type: "",
      enfc_istt: "",
    }),
  })
  throwIfNotOk(res, "itemReportListSusi")
  const json = (await res.json()) as {
    data?: {
      result?: RegulationListItem[]
      page?: { totalCount?: number; totalPage?: number }
      organInfo?: RegulationListPage["organInfo"]
    }
  }
  return {
    items: Array.isArray(json?.data?.result) ? json!.data!.result! : [],
    pageNo,
    totalPages: Number(json?.data?.page?.totalPage ?? 1),
    totalCount: Number(json?.data?.page?.totalCount ?? 0),
    organInfo: json?.data?.organInfo,
  }
}

/** 기관의 모든 규정/보고서(페이지네이션 통합) */
export async function listAllRegulations(
  apbaId: string,
  apbaType: string,
  reportFormRootNo: number = RULE_REPORT_FORM_ROOT,
  onPage?: (page: RegulationListPage) => void
): Promise<RegulationListItem[]> {
  const first = await listRegulations(apbaId, 1, apbaType, reportFormRootNo)
  onPage?.(first)
  const all: RegulationListItem[] = [...first.items]
  for (let p = 2; p <= first.totalPages; p++) {
    const page = await listRegulations(apbaId, p, apbaType, reportFormRootNo)
    onPage?.(page)
    all.push(...page.items)
  }
  return all
}

// ─────────────────────────────────────────
// 게시판형 (내부규정 21110) 상세/다운로드
// ─────────────────────────────────────────

/**
 * 규정 상세 HTML 에서 개정본별 fileNo + 파일명 추출 (게시판형, reportGbn="N").
 * 상세 페이지는 정적 서버사이드 렌더링이라 HTML 파싱으로 충분.
 */
export async function getRegulationDetail(
  item: RegulationListItem
): Promise<RegulationDetail> {
  const params = new URLSearchParams({
    disclosureNo: "",
    apbaId: item.apbaId,
    nowcode: item.reportFormNo,
    reportFormNo: item.reportFormNo,
    table_name: item.tableName ?? "",
    idx_name: item.idxName ?? "",
    idx: item.idx,
    reportGbn: item.reportGbn,
    bid_type: item.bidType ?? "",
  })
  const url = `${ALIO_BASE}/item/itemBoard21110.do?${params.toString()}`
  const res = await fetchWithRetry(url, { headers: htmlHeadersFor(RULE_REPORT_FORM_ROOT) })
  throwIfNotOk(res, "itemBoard21110")
  const html = await res.text()

  const files = extractFileRefs(html)
  return {
    apbaId: item.apbaId,
    idx: item.idx,
    title: item.title,
    issuedAt: item.stDate || undefined,
    revisedAt: item.idate || undefined,
    files,
  }
}

/** 상세 HTML 에서 `<a href="/download/rulefiledown.json?fileNo=...">파일명</a>` 패턴을 추출 */
function extractFileRefs(html: string): RegulationDetail["files"] {
  const out: RegulationDetail["files"] = []
  const re = /<a\s+href="\/download\/rulefiledown\.json\?fileNo=(\d+)"[^>]*>([^<]+)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const fileNo = m[1]
    const filename = decodeHtmlEntities(m[2].trim())
    if (out.some((f) => f.fileNo === fileNo)) continue
    out.push({ fileNo, filename })
  }
  return out
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

export interface DownloadedFile {
  fileNo: string
  /** Content-Disposition 에서 파싱한 파일명(없으면 빈 문자열) */
  filename: string
  buffer: ArrayBuffer
  /** 서버가 내려준 Content-Type (참고용) */
  contentType: string
}

export async function downloadRegulationFile(fileNo: string): Promise<DownloadedFile> {
  const url = `${ALIO_BASE}/download/rulefiledown.json?fileNo=${encodeURIComponent(fileNo)}`
  const res = await fetchWithRetry(url, {
    headers: {
      ...jsonHeadersFor(RULE_REPORT_FORM_ROOT),
      Accept: "*/*",
    },
    timeout: 120_000,
  })
  throwIfNotOk(res, "rulefiledown")
  const contentType = res.headers.get("content-type") || ""
  const filename = parseContentDispositionFilename(res.headers.get("content-disposition"))
  const buffer = await res.arrayBuffer()
  return { fileNo, filename, buffer, contentType }
}

// ─────────────────────────────────────────
// 보고서형 (단체협약 21026 / 임금협약 21027 / 노사협의회 21028) 상세/다운로드
// ─────────────────────────────────────────

/** itemReportFiles.json 응답의 단일 파일 메타 */
interface ReportFileMeta {
  reportFormNo: string
  disclosureNo: string
  apbaId: string
  submissionNo: string
  fileNo: string
  orcpFileNa: string
  saveFileNa: string
  savePath: string
  fileType: string
  fileSize: number
}

/**
 * 보고서형 (reportGbn="Y") disclosure 의 첨부파일 메타 조회.
 * 한 disclosure 안에 여러 첨부파일 가능 (예: 협약서 PDF + 주요내용 HWP + 신구대비표 HWP).
 *
 * @param disclosureNo - itemReportListSusi.json 응답의 disclosureNo
 * @param reportFormRootNo - Referer 헤더용 (옵션, default 21026)
 */
export async function getReportDisclosureFiles(
  disclosureNo: string,
  reportFormRootNo: number = 21026
): Promise<RegulationDetail["files"]> {
  const url = `${ALIO_BASE}/item/itemReportFiles.json?disclosureNo=${encodeURIComponent(disclosureNo)}`
  const res = await fetchWithRetry(url, { headers: jsonHeadersFor(reportFormRootNo) })
  throwIfNotOk(res, "itemReportFiles")
  const json = (await res.json()) as { data?: ReportFileMeta[] }
  const data = Array.isArray(json?.data) ? json!.data! : []
  return data.map((f) => ({
    fileNo: f.fileNo,
    filename: f.orcpFileNa || f.saveFileNa || `file-${f.fileNo}`,
    disclosureNo: f.disclosureNo,
    submissionNo: f.submissionNo,
    fileType: f.fileType,
    fileSize: f.fileSize,
  }))
}

/**
 * 보고서형 첨부파일 다운로드.
 * URL: /download/file.json?f={fileNo}&d={disclosureNo}&s={submissionNo}
 */
export async function downloadReportFile(
  fileNo: string,
  disclosureNo: string,
  submissionNo: string,
  reportFormRootNo: number = 21026
): Promise<DownloadedFile> {
  const params = new URLSearchParams({
    f: fileNo,
    d: disclosureNo,
    s: submissionNo,
  })
  const url = `${ALIO_BASE}/download/file.json?${params.toString()}`
  const res = await fetchWithRetry(url, {
    headers: {
      ...jsonHeadersFor(reportFormRootNo),
      Accept: "*/*",
    },
    timeout: 120_000,
  })
  throwIfNotOk(res, "download/file.json")
  const contentType = res.headers.get("content-type") || ""
  const filename = parseContentDispositionFilename(res.headers.get("content-disposition"))
  const buffer = await res.arrayBuffer()
  return { fileNo, filename, buffer, contentType }
}

function parseContentDispositionFilename(header: string | null): string {
  if (!header) return ""
  // filename*=UTF-8''... 우선
  const star = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (star) {
    try {
      return decodeURIComponent(star[1]).replace(/^"+|"+$/g, "")
    } catch {
      /* fallthrough */
    }
  }
  const plain = header.match(/filename=("?)([^";]+)\1/i)
  if (plain) return plain[2].replace(/^"+|"+$/g, "")
  return ""
}
