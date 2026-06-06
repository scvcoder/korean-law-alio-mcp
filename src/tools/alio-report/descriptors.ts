/**
 * 보고서형 ALIO 공시 카테고리 descriptor 정의
 *
 * 각 카테고리는 buildReportCategoryTools(descriptor) 로 5개 도구를 생성한다.
 *   - 단체협약  (labor-agreements, 21026) — v1.1.0
 *   - 임금협약  (wage-agreements,  21027) — v1.2.0
 *   - 노사협의회 의결사항 (labor-council, 21028) — v1.3.0
 *
 * 도구명 규칙: search_institution_<x> / list_alio_<x> / get_alio_<x> /
 *              search_alio_<x>_text / compare_alio_<x>  (x = 카테고리 단수 슬러그)
 */

import type { ReportCategoryDescriptor } from "./category-tools.js"

/** 단체협약 (v1.1.0) */
export const LABOR_AGREEMENTS_DESC: ReportCategoryDescriptor = {
  category: "labor-agreements",
  label: "단체협약",
  names: {
    searchInstitution: "search_institution_labor_agreements",
    list: "list_alio_labor_agreements",
    get: "get_alio_labor_agreement",
    searchText: "search_alio_labor_agreement_text",
    compare: "compare_alio_labor_agreements",
  },
  topicExamples: "'연차휴가', '시간외근로', '단체교섭', '징계위원회'",
}

/** 임금협약 (v1.2.0) */
export const WAGE_AGREEMENTS_DESC: ReportCategoryDescriptor = {
  category: "wage-agreements",
  label: "임금협약",
  names: {
    searchInstitution: "search_institution_wage_agreements",
    list: "list_alio_wage_agreements",
    get: "get_alio_wage_agreement",
    searchText: "search_alio_wage_agreement_text",
    compare: "compare_alio_wage_agreements",
  },
  topicExamples: "'기본급', '성과급', '제수당', '임금인상률', '통상임금'",
}

/** 노사협의회 의결사항 (v1.3.0) */
export const LABOR_COUNCIL_DESC: ReportCategoryDescriptor = {
  category: "labor-council",
  label: "노사협의회 의결사항",
  names: {
    searchInstitution: "search_institution_labor_council",
    list: "list_alio_labor_council",
    get: "get_alio_labor_council",
    searchText: "search_alio_labor_council_text",
    compare: "compare_alio_labor_council",
  },
  topicExamples: "'복리후생', '교육훈련', '안전보건', '고충처리', '생산성 향상'",
}

/** 모든 보고서형 카테고리 descriptor (registry 일괄 등록용) */
export const REPORT_CATEGORY_DESCRIPTORS: ReportCategoryDescriptor[] = [
  LABOR_AGREEMENTS_DESC,
  WAGE_AGREEMENTS_DESC,
  LABOR_COUNCIL_DESC,
]
