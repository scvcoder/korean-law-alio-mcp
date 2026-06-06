/**
 * ALIO 공통 타입
 */

import type { AlioCategory } from "./paths.js"

export interface Institution {
  apbaId: string
  apbaNa: string
  /** 기관 유형 (예: "기타공공기관", "준정부기관") */
  typeNa: string
  /** 주무부처 */
  jidtNa: string
  /** 기관 유형 코드 (예: "A2005") */
  apbaType: string
}

/** ALIO 규정 목록의 원시 항목 (itemReportListSusi.json 응답) */
export interface RegulationListItem {
  apbaId: string
  /** 규정 식별자 (RULE_NO) — 게시판형 (reportGbn=N, 내부규정) 의 PK */
  idx: string
  title: string
  /** 최종 수정일 (YYYY.MM.DD) */
  idate: string
  /** 제·개정일 (YYYY.MM.DD) */
  stDate: string
  /** 규정 분류 코드 (예: K1100=감사, K1400=업무, K1500=정관). 보고서형은 null */
  bidType: string | null
  reportFormNo: string
  tableName: string | null
  idxName: string | null
  /** "N" = 게시판형 (내부규정), "Y" = 보고서형 (단체협약/임금협약/노사협의회) */
  reportGbn: "N" | "Y" | string
  /** 보고서형 (reportGbn=Y) 의 PK — 게시판형은 비어있음 */
  disclosureNo?: string
  /** 보고서형의 제출 단위 ID (파일 다운로드에 사용) */
  submissionNo?: string
  frstSubmissionNo?: string
}

/** 규정 상세 — 첨부파일(개정본) 목록 포함 */
export interface RegulationDetail {
  apbaId: string
  idx: string
  title: string
  issuedAt?: string
  revisedAt?: string
  files: RegulationFileRef[]
}

export interface RegulationFileRef {
  fileNo: string
  filename: string
  /** 보고서형(reportGbn=Y)의 파일 메타 — 다운로드 URL 생성에 사용 */
  disclosureNo?: string
  submissionNo?: string
  /** itemReportFiles.json 응답의 추가 메타 (보고서형만) */
  fileType?: string
  fileSize?: number
}

/** manifest.json 기록 */
export interface ManifestEntry {
  regId: string
  title: string
  category: string
  issuedAt: string
  revisedAt: string
  sourceDetailUrl: string
  primaryFileNo: string
  primaryFileName: string
  fileType: "hwpx" | "hwp" | "hwpml" | "pdf" | "xlsx" | "docx" | "unknown"
  fileHash: string
  mdPath: string
  bytes: number
  /** 파싱 실패 시 kordoc 에러 메시지. 성공이면 undefined */
  parseError?: string
  /** 원본이 zip 래퍼였다면 내부에서 실제로 파싱한 파일명 */
  unwrappedFrom?: string
  /** kordoc 대신 사용된 fallback 파서. ("docling"=tesseract OCR, "ocrmac"=Apple Vision OCR) — kordoc 성공이면 undefined */
  fallbackParser?: "docling" | "ocrmac"
  /** 보고서형: 첨부 N개 중 파싱 실패한 개수 (부분 실패 추적 — >0 이면 --retry-failed 재시도 대상) */
  failedAttachments?: number
  /** 과거 개정본 (최신이 primary, 나머지는 history) */
  revisions: Array<{
    fileNo: string
    filename: string
  }>
}

export interface Manifest {
  apbaId: string
  institutionName: string
  typeNa?: string
  jidtNa?: string
  reportFormRootNo: number
  /**
   * 카테고리 slug — v1.1.0 부터. 디렉터리명과 일치.
   * 기존 v1.0.x 가 만든 manifest 는 이 필드 없음 → 로더가 "regulations" 로 간주.
   */
  category?: AlioCategory
  fetchedAt: string
  regulations: ManifestEntry[]
}

export interface InstitutionsIndex {
  fetchedAt: string
  institutions: Institution[]
}

export interface SyncState {
  lastFullSync?: string
  lastError?: string
  perInstitution: Record<string, {
    fetchedAt: string
    status: "success" | "error"
    error?: string
    regulationCount: number
  }>
}
