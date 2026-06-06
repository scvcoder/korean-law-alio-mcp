/**
 * Smart Query Router
 * 자연어 질의를 분석하여 최적의 도구/체인으로 라우팅
 *
 * 패턴 매칭 기반으로 의도를 파악하고, 필요한 파라미터를 자동 추출
 */

import { existsSync, readFileSync } from "node:fs"
import { SEARCH_DETAIL_CHAINS } from "./tool-chain-config.js"
import { parseDateRange, type DateRange } from "./date-parser.js"
import { getInstitutionAliases } from "./alio/config.js"
import { institutionsIndexPath } from "./alio/paths.js"

export interface RouteResult {
  /** 실행할 도구 이름 */
  tool: string
  /** 도구에 전달할 파라미터 */
  params: Record<string, unknown>
  /** 라우팅 근거 설명 */
  reason: string
  /** 후속 실행이 필요한 도구 (파이프라인) */
  pipeline?: Array<{ tool: string; params: Record<string, unknown> }>
  /** 자동 체인 여부 (search → detail 자동 연결) */
  autoChain?: boolean
  /** 자연어에서 추출된 날짜 범위 (검색 도구에 자동 적용) */
  dateRange?: DateRange
}

interface Pattern {
  /** 패턴 이름 */
  name: string
  /** 매칭 정규식 배열 (OR 조건) */
  patterns: RegExp[]
  /** 매칭 시 실행할 도구 */
  tool: string
  /** 파라미터 추출 함수 */
  extract: (query: string, match: RegExpMatchArray | null) => Record<string, unknown>
  /** 라우팅 설명 */
  reason: string
  /** 우선순위 (낮을수록 우선) */
  priority: number
}

// ────────────────────────────────────────
// 조문 번호 추출 헬퍼
// ────────────────────────────────────────

function extractArticleNumber(query: string): string | undefined {
  const match = query.match(/제(\d+)조(?:의(\d+))?/)
  if (!match) return undefined
  return match[0] // "제38조" or "제10조의2"
}

/**
 * 쿼리에서 순수 법령명만 추출.
 *
 * 주의: replace 순서에 의존하지 않도록 한 번에 처리.
 * "등록면허세법"처럼 법령명 자체에 키워드가 포함된 경우 파괴하지 않기 위해
 * 단어 경계(\b에 해당하는 한글 패턴)를 고려하여 제거.
 */
function extractLawName(query: string): string {
  return query
    // 조문번호 (확정적 구문이라 먼저 제거)
    .replace(/제\d+조(?:의\d+)?/g, "")
    // 수식어: 단독 키워드만 제거 (법령명 일부인 경우 보존)
    // "별표 1", "별표" 등 독립적 사용만 제거
    .replace(/별표\s*\d*/g, "")
    .replace(/(?:^|\s)(판례|판결|사례|대법원|헌재|행정심판)(?:\s|$)/g, " ")
    .replace(/(?:^|\s)(해석례?|유권해석|질의회신)(?:\s|$)/g, " ")
    .replace(/(?:^|\s)(개정|이력|변경|연혁|신구대조)(?:\s|$)/g, " ")
    .replace(/(?:^|\s)(3단비교|위임|인용|체계)(?:\s|$)/g, " ")
    .replace(/(?:^|\s)(영문|영어|English)(?:\s|$)/gi, " ")
    .replace(/(?:^|\s)(서식|양식|별지|신청서)(?:\s|$)/g, " ")
    // 조례/규칙은 법령명 일부이므로 유지
    // 동사형 수식어 제거
    .replace(/(?:^|\s)(검색|조회|확인|알려줘|찾아줘|보여줘)(?:\s|$)/g, " ")
    // 정리
    .replace(/\s+/g, " ")
    .trim()
}

// ────────────────────────────────────────
// ALIO 전용 헬퍼
// ────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 기관 약어/정식명칭의 정규식 alternation. 환경변수 ALIO_INSTITUTION_ALIASES
 * 미설정 시 빈 문자열. 모듈 로드 시 1회 평가.
 */
const ALIAS_ALTERNATION: string = (() => {
  const aliases = getInstitutionAliases()
  const tokens = new Set<string>()
  for (const [k, v] of Object.entries(aliases)) {
    if (k) tokens.add(k)
    if (v) tokens.add(v)
  }
  return [...tokens].map(escapeRegex).join("|")
})()

function extractAlioInstitution(query: string): string | undefined {
  const aliases = getInstitutionAliases()
  for (const [key, canon] of Object.entries(aliases)) {
    const re = new RegExp(escapeRegex(key), "i")
    if (re.test(query)) return canon
  }
  const codeMatch = query.match(/\b(C\d{4})\b/i)
  if (codeMatch) return codeMatch[1].toUpperCase()
  return undefined
}

/**
 * institutions.json (수집된 기관 메타) 의 정식 기관명 캐시.
 * 환경변수 ALIO_INSTITUTION_ALIASES 가 없어도 정식명칭으로 라우팅 가능하게 함.
 */
let _knownInstitutions: Array<{ apbaId: string; apbaNa: string }> | null = null
function getKnownInstitutions(): Array<{ apbaId: string; apbaNa: string }> {
  if (_knownInstitutions !== null) return _knownInstitutions
  try {
    const idxPath = institutionsIndexPath()
    if (existsSync(idxPath)) {
      const raw = readFileSync(idxPath, "utf8")
      const idx = JSON.parse(raw) as { institutions?: Array<{ apbaId: string; apbaNa: string }> }
      _knownInstitutions = (idx.institutions ?? []).map((i) => ({
        apbaId: i.apbaId,
        apbaNa: i.apbaNa,
      }))
      return _knownInstitutions
    }
  } catch {
    /* 인덱스 파일 부재/파싱 실패 — 빈 목록으로 폴백 */
  }
  _knownInstitutions = []
  return _knownInstitutions
}

function normalizeInstitutionName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "")
}

/**
 * 기관명/약어로 institutions.json 의 정식 항목을 동기 조회.
 * 1) 환경변수 alias 정확 일치 → canonical name 으로 변환 후 조회
 * 2) institutions.json 정식명칭 정확 일치
 * 3) institutions.json 정식명칭 부분 일치 (3자 이상일 때만)
 */
function lookupInstitutionByName(name: string): { apbaId: string; apbaNa: string } | undefined {
  const aliases = getInstitutionAliases()
  const aliasHit = Object.entries(aliases).find(([k]) => k.toLowerCase() === name.toLowerCase())
  const target = aliasHit ? aliasHit[1] : name
  const norm = normalizeInstitutionName(target)
  if (!norm) return undefined
  const insts = getKnownInstitutions()
  const exact = insts.find((i) => normalizeInstitutionName(i.apbaNa) === norm)
  if (exact) return exact
  if (norm.length >= 3) {
    return insts.find((i) => normalizeInstitutionName(i.apbaNa).includes(norm))
  }
  return undefined
}

/** 테스트용 — 캐시 초기화 */
export function _resetQueryRouterCache(): void {
  _knownInstitutions = null
}

function extractAlioBase(query: string): string | undefined {
  // "우리"/"기준기관" 등 일반 표현은 추출 불가 → undefined
  return extractAlioInstitution(query)
}

/** 토픽 추출: 기관/비교 키워드/불용어 제거 후 남은 핵심어 */
function extractAlioTopic(query: string): string | undefined {
  let stripped = query
  if (ALIAS_ALTERNATION) {
    stripped = stripped.replace(new RegExp(ALIAS_ALTERNATION, "gi"), " ")
  }
  stripped = stripped
    .replace(/공공\s*기관|ALIO|자매\s*기관|동종\s*기관|피어\s*기관/gi, " ")
    .replace(/규정|지침|정관|내부규정|조문|조항/g, " ")
    // v1.1.0+: 단체협약/임금협약/노사협의회 카테고리 식별자도 토픽 추출 시 불용어로 제거
    // (실제 토픽은 휴가/수당/교섭/징계 같이 협약 안의 항목)
    .replace(/단체\s*협약|임금\s*협약|노사\s*협의\s*회?|노사\s*협의\s*사항/g, " ")
    .replace(/비교|대조|벤치마킹/g, " ")
    .replace(/\b(C\d{4})\b/gi, " ")
    .replace(/검색|조회|확인|알려줘|찾아줘|보여줘/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return stripped.length >= 2 ? stripped : undefined
}

/**
 * 보고서형 ALIO 카테고리(단체협약/임금협약/노사협의회) 의 5개 라우팅 패턴을 생성.
 *
 * 세 카테고리는 라벨 정규식과 도구명만 다르고 라우팅 구조가 동일하므로 팩토리로 생성한다.
 * (compare / search_text / search_institution / list-by-name / list-by-code 순)
 */
function reportCategoryRoutes(opts: {
  slug: string
  /** 라벨 정규식 fragment (예: "단체\\s*협약") */
  labelRe: string
  /** 사람이 읽는 라벨 (reason 문구용) */
  human: string
  tools: { compare: string; searchText: string; searchInstitution: string; list: string }
}): Pattern[] {
  const { slug, labelRe: L, human, tools } = opts
  return [
    // (a) "○○ 비교" / "공공기관 ○○ 비교" → compare
    {
      name: `alio_${slug}_compare`,
      patterns: [
        new RegExp(`(?:공공\\s*기관|ALIO).*${L}.*(?:비교|대조)`, "i"),
        new RegExp(`${L}.*(?:공공\\s*기관|ALIO).*(?:비교|대조)`, "i"),
        new RegExp(`${L}.*(?:비교|대조)`, "i"),
      ],
      tool: tools.compare,
      extract: (query) => {
        const topic = extractAlioTopic(query)
        return topic ? { topic } : { topic: query }
      },
      reason: `${human} + 비교 키워드 → 기관간 ${human} 토픽 비교`,
      priority: 1,
    },
    // (b) "○○ ○○○ 검색/조회/찾기" → search_text
    {
      name: `alio_${slug}_search_text`,
      patterns: [new RegExp(`${L}.*(?:검색|조회|찾)`)],
      tool: tools.searchText,
      extract: (query) => {
        const topic = extractAlioTopic(query)
        return topic ? { query: topic } : { _fallback: true, query }
      },
      reason: `${human} + 검색 키워드 → ${human} 전문 검색`,
      priority: 1,
    },
    // (c) "○○ 있는 공공기관" → search_institution
    {
      name: `alio_${slug}_search_institution`,
      patterns: [
        new RegExp(`${L}\\s*(?:있는|보유|등록된)\\s*(?:공공\\s*기관|기관)`),
        new RegExp(`(?:공공\\s*기관|기관).*${L}\\s*(?:있|보유|등록)`),
      ],
      tool: tools.searchInstitution,
      extract: () => ({}),
      reason: `${human} 보유 기관 검색`,
      priority: 1,
    },
    // (d) 정식 기관명 + ○○ → list
    {
      name: `alio_${slug}_by_institution`,
      patterns: [new RegExp(`^(.+?)\\s+${L}\\s*$`)],
      tool: tools.list,
      extract: (_query, match) => {
        const prefix = match?.[1]?.trim()
        if (!prefix) return { _skip: true }
        const inst = lookupInstitutionByName(prefix)
        if (!inst) return { _skip: true }
        return { institution: inst.apbaId }
      },
      reason: `정식 기관명 + ${human} → ${human} 목록`,
      priority: 1,
    },
    // (e) apbaId/alias + ○○ → list
    {
      name: `alio_${slug}_by_code`,
      patterns: (() => {
        const tokenAlt = ALIAS_ALTERNATION ? `${ALIAS_ALTERNATION}|C\\d{4}` : `C\\d{4}`
        return [new RegExp(`(${tokenAlt}).*${L}`), new RegExp(`${L}.*(${tokenAlt})`)]
      })(),
      tool: tools.list,
      extract: (query) => {
        const inst = extractAlioInstitution(query)
        return inst ? { institution: inst } : { _fallback: true, query }
      },
      reason: `기관 식별자 + ${human} → ${human} 목록`,
      priority: 2,
    },
  ]
}

// ────────────────────────────────────────
// 복합 의도 감지 (다중 키워드 충돌 해결)
// ────────────────────────────────────────

/**
 * 절차/비용 의도가 처분/허가 의도보다 강한지 판단.
 * "신고 방법", "허가 절차 수수료" 같은 복합 쿼리에서
 * 절차 키워드가 있으면 procedure를 우선.
 */
function hasProcedureIntent(query: string): boolean {
  return /절차|방법|수수료|과태료|비용|신청\s*방법|어떻게/.test(query)
}

// ────────────────────────────────────────
// 패턴 정의
// ────────────────────────────────────────

const routePatterns: Pattern[] = [
  // ── 1. 특정 조문 조회 (최고 우선) ──
  {
    name: "specific_article",
    patterns: [
      /(.+?)\s*제(\d+)조(?:의(\d+))?\s*$/,
      /제(\d+)조(?:의(\d+))?\s*(.+)/,
    ],
    tool: "get_law_text",
    extract: (query) => {
      // cross-domain 후행 키워드("따르는 공공기관 규정" 등) 가 있으면 양보 →
      // alio_find_by_upper_law 가 처리하도록.
      if (/(?:따르는|근거로\s*하는|위임\s*(?:받은|에\s*따른))\s+공공\s*기관/.test(query)) {
        return { _skip: true }
      }
      const jo = extractArticleNumber(query)
      const lawName = extractLawName(query)
      return { _searchQuery: lawName, jo, _needsMst: true }
    },
    reason: "법령명 + 조문번호 → 해당 조문 직접 조회",
    priority: 1,
  },

  // ── 2. 행정규칙 (고시/훈령 등은 법령명 자체이므로 높은 우선순위) ──
  {
    name: "admin_rule",
    patterns: [
      /훈령|예규|고시|지침|내규/,
    ],
    tool: "search_admin_rule",
    extract: (query) => ({ query }),
    reason: "행정규칙 키워드 → 행정규칙 검색",
    priority: 4,
  },

  // ── 3. 조례/자치법규 검색 ──
  {
    name: "ordinance",
    patterns: [
      /조례/,
      // "시·군·구" 단독이 아닌 "XX시", "XX구" 등 지역+행정구역 패턴
      /[가-힣]+(시|군|구)\s+[가-힣]+\s*(조례|규칙)/,
    ],
    tool: "search_ordinance",
    extract: (query) => ({ query }),
    reason: "조례/자치법규 키워드 → 자치법규 검색",
    priority: 5,
  },

  // ── 4. 개정 이력/신구대조 ──
  {
    name: "amendment",
    patterns: [
      /개정|신구대조|변경\s*이력|연혁/,
    ],
    tool: "chain_amendment_track",
    extract: (query) => {
      const lawName = extractLawName(query)
      // 법령명이 비어있으면 원본 쿼리를 그대로 사용 (chain이 자체 검색)
      return { query: lawName || query }
    },
    reason: "개정/이력 키워드 → 개정추적 체인",
    priority: 10,
  },

  // ── 5. 3단비교/법체계 ──
  {
    name: "law_system",
    patterns: [
      /3단\s*비교|위임\s*조문|인용\s*조문|법\s*체계|시행령\s*비교/,
    ],
    tool: "chain_law_system",
    extract: (query) => ({ query: extractLawName(query) || query }),
    reason: "법체계/3단비교 키워드 → 법체계 체인",
    priority: 10,
  },

  // ── 6. 별표/서식 조회 ──
  {
    name: "annex",
    patterns: [
      // "XX법 별표", "XX령 서식" 등 법령명이 함께 있는 경우만 매칭
      /[가-힣]+(법|령|규칙|규정)\s*(별표|서식|양식|별지)/,
      // "별표" 단독은 매칭하되 법령명 추출이 비어있으면 chain_full_research로 폴백
    ],
    tool: "get_annexes",
    extract: (query) => {
      const lawName = extractLawName(query)
      if (!lawName) {
        // 법령명 없이 "별표"만 → 종합 리서치로 폴백
        return { _fallback: true, query }
      }
      return { lawName }
    },
    reason: "별표/서식 키워드 → 별표 조회",
    priority: 10,
  },

  // ── 7. 판례 검색 ──
  {
    name: "precedent",
    patterns: [
      /판례|판결|대법원\s*판/,
    ],
    tool: "search_precedents",
    extract: (query) => ({
      query: query.replace(/판례|판결|대법원/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "판례 키워드 → 판례 검색",
    priority: 10,
  },

  // ── 8. 해석례 ──
  {
    name: "interpretation",
    patterns: [
      /해석례?|유권\s*해석|질의\s*회신/,
    ],
    tool: "search_interpretations",
    extract: (query) => ({
      query: query.replace(/해석례?|유권해석|질의회신/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "해석례 키워드 → 해석례 검색",
    priority: 10,
  },

  // ── 9. 헌재 결정례 ──
  {
    name: "constitutional",
    patterns: [
      /헌재|헌법재판|위헌/,
    ],
    tool: "search_constitutional_decisions",
    extract: (query) => ({
      query: query.replace(/헌재|헌법재판소?|결정례?/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "헌재 키워드 → 헌재 결정례 검색",
    priority: 10,
  },

  // ── 10. 행정심판 ──
  {
    name: "admin_appeal",
    patterns: [
      /행정심판|행심/,
    ],
    tool: "search_admin_appeals",
    extract: (query) => ({
      query: query.replace(/행정심판례?|행심/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "행정심판 키워드 → 행정심판례 검색",
    priority: 10,
  },

  // ── 11. 조세심판 ──
  {
    name: "tax_tribunal",
    patterns: [
      /조세\s*심판|세금\s*심판/,
    ],
    tool: "search_tax_tribunal_decisions",
    extract: (query) => ({
      query: query.replace(/조세심판원?|세금심판|결정례?/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "조세심판 키워드 → 조세심판 결정례 검색",
    priority: 10,
  },

  // ── 12. 영문 법령 ──
  {
    name: "english_law",
    patterns: [
      /영문|영어|English/i,
    ],
    tool: "search_english_law",
    extract: (query) => ({
      query: query.replace(/영문|영어|English|법령/gi, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "영문 키워드 → 영문법령 검색",
    priority: 10,
  },

  // ── 13. 법령용어 ──
  {
    name: "legal_terms",
    patterns: [
      /법률?\s*용어|법령\s*용어|용어\s*정의|용어\s*뜻|뭐야$|뜻이?$/,
    ],
    tool: "search_legal_terms",
    extract: (query) => ({
      query: query.replace(/법률?용어|법령용어|용어정의|뜻이?|뭐야|의$/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "용어 키워드 → 법령용어 검색",
    priority: 10,
  },

  // ── 14. 절차/비용/수수료 (처분보다 우선 — 절차 키워드가 있으면 여기로) ──
  {
    name: "procedure",
    patterns: [
      /절차|수수료|과태료|비용|신청\s*방법|어떻게/,
    ],
    tool: "chain_procedure_detail",
    extract: (query) => ({ query }),
    reason: "절차/비용 키워드 → 절차상세 체인",
    priority: 14,
  },

  // ── 15. 처분/허가 근거 ──
  {
    name: "action_basis",
    patterns: [
      /허가|인가|처분|취소\s*사유|거부\s*근거|요건/,
    ],
    tool: "chain_action_basis",
    extract: (query) => {
      // 절차 키워드도 함께 있으면 procedure로 위임
      if (hasProcedureIntent(query)) {
        return { _reroute: "chain_procedure_detail", query }
      }
      return { query }
    },
    reason: "처분/허가 키워드 → 처분근거 체인",
    priority: 15,
  },

  // ── 16. "신고" — 단독이면 action_basis, "신고 방법/절차"면 procedure ──
  {
    name: "report_action",
    patterns: [
      /신고|등록/,
    ],
    tool: "chain_action_basis",
    extract: (query) => {
      if (hasProcedureIntent(query)) {
        return { _reroute: "chain_procedure_detail", query }
      }
      return { query }
    },
    reason: "신고/등록 키워드 → 처분근거 (절차 키워드 동반 시 절차상세)",
    priority: 16,
  },

  // ── 17. 쟁송/분쟁 대비 ──
  {
    name: "dispute",
    patterns: [
      /불복|소송|쟁송|항고|이의\s*신청|감경|취소\s*소송/,
    ],
    tool: "chain_dispute_prep",
    extract: (query) => ({ query }),
    reason: "분쟁/쟁송 키워드 → 쟁송대비 체인",
    priority: 17,
  },

  // ── 18. "방법" 단독 — procedure 폴백 ──
  {
    name: "method_fallback",
    patterns: [
      /방법/,
    ],
    tool: "chain_procedure_detail",
    extract: (query) => ({ query }),
    reason: "방법 키워드 → 절차상세 체인",
    priority: 18,
  },

  // ── 19. 관세 해석례 (일반 해석례보다 구체적 → 더 높은 우선순위) ──
  {
    name: "customs",
    patterns: [
      /관세\s*해석|관세청\s*(해석|질의|회신)|FTA\s*해석/,
    ],
    tool: "search_customs_interpretations",
    extract: (query) => ({
      query: query.replace(/관세청?|해석례?|질의|회신/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "관세 해석 키워드 → 관세 해석례 검색",
    priority: 9,
  },

  // ── 20. 공정위 결정문 ──
  {
    name: "ftc",
    patterns: [
      /공정위|공정거래\s*위원회?|시장지배|불공정\s*거래|담합/,
    ],
    tool: "search_ftc_decisions",
    extract: (query) => ({
      query: query.replace(/공정거래위원회?|공정위|결정문?/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "공정위 키워드 → 공정위 결정문 검색",
    priority: 10,
  },

  // ── 21. 개인정보위 결정문 ──
  {
    name: "pipc",
    patterns: [
      /개인정보\s*위|개인정보\s*보호\s*위원회?|개인정보\s*침해/,
    ],
    tool: "search_pipc_decisions",
    extract: (query) => ({
      query: query.replace(/개인정보보호위원회?|개인정보위|결정문?/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "개인정보위 키워드 → 개인정보위 결정문 검색",
    priority: 10,
  },

  // ── 22. 노동위 결정문 ──
  {
    name: "nlrc",
    patterns: [
      /노동\s*위원회?|부당\s*해고|부당\s*노동|노동위/,
    ],
    tool: "search_nlrc_decisions",
    extract: (query) => ({
      query: query.replace(/중앙노동위원회?|노동위|결정문?/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "노동위 키워드 → 노동위 결정문 검색",
    priority: 10,
  },

  // ── 23. 조례 비교 체인 (조례 단독(5)보다 우선) ──
  {
    name: "ordinance_compare",
    patterns: [
      /조례\s*비교|자치법규\s*비교|전국\s*조례/,
    ],
    tool: "chain_ordinance_compare",
    extract: (query) => ({ query }),
    reason: "조례 비교 키워드 → 조례비교 체인",
    priority: 4,
  },

  // ── 24. AI 의미검색 (법령명 모를 때 — explicit_law(3)보다 우선) ──
  {
    name: "ai_search",
    patterns: [
      /생활\s*법령|AI\s*검색/,
    ],
    tool: "search_ai_law",
    extract: (query) => ({
      query: query.replace(/생활법령|AI검색/g, "").replace(/\s+/g, " ").trim() || query,
    }),
    reason: "AI/생활법령 키워드 → AI 의미검색",
    priority: 2,
  },

  // ── 25. 일상용어 → 법률용어 (일반 용어검색(10)보다 구체적 → 우선) ──
  {
    name: "daily_term",
    patterns: [
      /법률?\s*용어로|일상\s*용어|쉬운\s*말|법적\s*표현/,
    ],
    tool: "get_daily_to_legal",
    extract: (query) => ({
      query: query.replace(/법률?용어로?|일상용어|쉬운말|법적표현/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "일상→법률 용어 변환 키워드 → 용어 매핑",
    priority: 9,
  },

  // ── 26. 법령 통계/최근 개정 ──
  {
    name: "statistics",
    patterns: [
      /최근\s*개정|법령\s*통계|개정\s*현황/,
    ],
    tool: "get_law_statistics",
    extract: (query) => {
      const daysMatch = query.match(/(\d+)\s*일/)
      return { days: daysMatch ? parseInt(daysMatch[1], 10) : 30, count: 20 }
    },
    reason: "통계/최근개정 키워드 → 법령 통계",
    priority: 9,
  },

  // ── 27. 법령 목차/체계 조회 ──
  {
    name: "law_tree",
    patterns: [
      /목차|편장절|체계도/,
    ],
    tool: "get_law_tree",
    extract: (query) => {
      const lawName = extractLawName(query)
      if (!lawName) {
        return { _fallback: true, query }
      }
      return { _searchQuery: lawName, _needsMst: true }
    },
    reason: "목차 키워드 → 법령 체계 조회",
    priority: 10,
  },

  // ── 28. 통합검색 (명시적) ──
  {
    name: "search_all_explicit",
    patterns: [
      /통합\s*검색/,
    ],
    tool: "search_all",
    extract: (query) => ({
      query: query.replace(/통합검색/g, "").replace(/\s+/g, " ").trim(),
    }),
    reason: "통합검색 키워드 → 통합검색",
    priority: 10,
  },

  // ── 29. 지역명 시작 + 키워드 (조례 추정) ──
  {
    name: "region_ordinance",
    patterns: [
      /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s+.+/,
    ],
    tool: "search_ordinance",
    extract: (query) => ({ query }),
    reason: "지역명 시작 → 자치법규 검색",
    priority: 20,
  },

  // ── ALIO 공공기관 규정 비교 (가장 구체적 트리거 → 매우 높은 우선순위) ──
  // "ALIO", "공공기관 규정", "자매기관 규정", "벤치마킹"
  {
    name: "alio_benchmark",
    patterns: [
      /벤치마킹|자매\s*기관|동종\s*기관|피어\s*기관/,
    ],
    tool: "suggest_alio_benchmark",
    extract: (query) => {
      const base = extractAlioBase(query)
      const topic = extractAlioTopic(query)
      const params: Record<string, unknown> = {}
      if (base) params.base = base
      if (topic) params.topic = topic
      // base 없으면 fallback
      if (!base) return { _fallback: true, query }
      return params
    },
    reason: "벤치마킹/자매기관 키워드 → ALIO 피어 비교",
    priority: 2,
  },
  {
    name: "alio_compare",
    patterns: (() => {
      const ps: RegExp[] = [
        // 공공기관/ALIO 류 키워드와 비교/대조가 같이 등장하면 — 사이에 토픽이 끼어도 매칭
        /(?:공공\s*기관|ALIO|자매\s*기관|동종\s*기관|피어\s*기관).*?(?:비교|대조)/i,
        /(?:비교|대조).*?(?:공공\s*기관|ALIO|자매\s*기관|동종\s*기관|피어\s*기관)/i,
      ]
      // 등록된 기관 약어/명칭 또는 apbaId 코드가 있을 때 비교/대조 매칭
      const tokenAlt = ALIAS_ALTERNATION ? `${ALIAS_ALTERNATION}|C\\d{4}` : `C\\d{4}`
      ps.push(new RegExp(`(?:${tokenAlt}).*(?:비교|대조)`, "i"))
      return ps
    })(),
    tool: "compare_alio_regulations",
    extract: (query) => {
      const topic = extractAlioTopic(query)
      return topic ? { topic } : { topic: query }
    },
    reason: "공공기관 규정 비교 키워드 → ALIO 기관간 토픽 비교",
    priority: 3,
  },
  // ── Cross-domain ALIO ↔ 법제처 브리지 패턴 ──
  // 사용자가 "○○진흥원 인사규정 상위법" / "근로기준법 따르는 공공기관 규정" 같이
  // 두 도메인을 잇는 자연어를 던졌을 때 직접 도구명을 모르더라도 도달하도록.

  // (a) 기관명 + 규정 + 위임/상위법/근거 → analyze_regulation_delegation
  //     (extract 시 includeLawLookup=true 로 법제처 search_law 자동 연계)
  {
    name: "alio_delegation_analysis",
    patterns: [
      /^(.+?)\s+(.+?(?:규정|규칙|지침|정관|세칙|내규))\s+(?:상위\s*법령?|근거\s*법령?|근거법|위임\s*분석|위임\s*관계|위임)\s*$/,
    ],
    tool: "analyze_regulation_delegation",
    extract: (_query, match) => {
      const prefix = match?.[1]?.trim()
      const title = match?.[2]?.trim()
      if (!prefix || !title) return { _skip: true }
      const inst = lookupInstitutionByName(prefix)
      if (!inst) return { _skip: true }
      return { institution: inst.apbaId, title, includeLawLookup: true }
    },
    reason: "기관명+규정+위임/상위법 키워드 → 위임 분석 (법제처 search_law 자동 연계)",
    priority: 1,
  },

  // (b) 법령명 (제N조)? 따르는|근거로 하는|위임 받은 공공기관 규정 → find_regulations_by_upper_law
  {
    name: "alio_find_by_upper_law",
    patterns: [
      /^(.+?)(?:\s+제(\d+)조(?:의(\d+))?)?\s+(?:따르는|근거로\s*하는|위임\s*(?:받은|에\s*따른))\s+공공\s*기관\s*(?:규정|규칙|지침|내부\s*규정)?\s*$/,
    ],
    tool: "find_regulations_by_upper_law",
    extract: (_query, match) => {
      const lawName = match?.[1]?.trim()
      if (!lawName) return { _skip: true }
      const joNum = match?.[2]
      const joUi = match?.[3]
      const params: Record<string, unknown> = { lawName }
      if (joNum) {
        params.article = joUi ? `제${joNum}조의${joUi}` : `제${joNum}조`
      }
      return params
    },
    reason: "법령(+조문) → 그 법령을 근거로 삼는 공공기관 규정 역검색",
    priority: 1,
  },

  // (c) 기관명 + 규정 + 인용/참조 → parse_alio_article_links (intra-doc 인용 그래프)
  {
    name: "alio_article_links",
    patterns: [
      /^(.+?)\s+(.+?(?:규정|규칙|지침|정관|세칙|내규))\s+(?:인용|참조|링크)\s*(?:분석|관계)?\s*$/,
    ],
    tool: "parse_alio_article_links",
    extract: (_query, match) => {
      const prefix = match?.[1]?.trim()
      const title = match?.[2]?.trim()
      if (!prefix || !title) return { _skip: true }
      const inst = lookupInstitutionByName(prefix)
      if (!inst) return { _skip: true }
      return { institution: inst.apbaId, title }
    },
    reason: "기관명+규정+인용/참조 키워드 → 조문간 인용 그래프 분석",
    priority: 1,
  },

  // ─────────────────────────────────────────
  // ALIO 보고서형 공시 — 단체협약(v1.1.0)/임금협약(v1.2.0)/노사협의회(v1.3.0)
  // 세 카테고리 모두 동일 구조라 reportCategoryRoutes 팩토리로 5개씩 생성.
  // 내부규정 패턴보다 더 specific 키워드(협약/협의회)를 먼저 매칭.
  // ─────────────────────────────────────────
  ...reportCategoryRoutes({
    slug: "labor_agreement",
    labelRe: "단체\\s*협약",
    human: "단체협약",
    tools: {
      compare: "compare_alio_labor_agreements",
      searchText: "search_alio_labor_agreement_text",
      searchInstitution: "search_institution_labor_agreements",
      list: "list_alio_labor_agreements",
    },
  }),
  ...reportCategoryRoutes({
    slug: "wage_agreement",
    labelRe: "임금\\s*협약",
    human: "임금협약",
    tools: {
      compare: "compare_alio_wage_agreements",
      searchText: "search_alio_wage_agreement_text",
      searchInstitution: "search_institution_wage_agreements",
      list: "list_alio_wage_agreements",
    },
  }),
  ...reportCategoryRoutes({
    slug: "labor_council",
    labelRe: "노사\\s*협의\\s*회",
    human: "노사협의회",
    tools: {
      compare: "compare_alio_labor_council",
      searchText: "search_alio_labor_council_text",
      searchInstitution: "search_institution_labor_council",
      list: "list_alio_labor_council",
    },
  }),

  // ── ALIO 정식 기관명 + 규정 패턴 (institutions.json 동기 조회로 검증) ──
  // 환경변수 alias 미설정 상태에서도 "한국인터넷진흥원 인사규정" 같이
  // 정식 기관명 + 규정 키워드 조합이면 ALIO 로 라우팅.
  // 미수집 기관/일반 법령은 _skip 으로 양보 → explicit_law 등이 처리.
  {
    name: "alio_regulation_by_institution",
    patterns: [
      /^(.+?)\s+(.+?(?:규정|규칙|지침|정관|세칙|내규))\s*$/,
    ],
    tool: "list_alio_regulations",
    extract: (_query, match) => {
      const prefix = match?.[1]?.trim()
      const title = match?.[2]?.trim()
      if (!prefix || !title) return { _skip: true }
      // "시행규칙", "시행령" 등은 법제처 법령 패턴이므로 양보
      if (/^시행(규칙|령)$/.test(title)) return { _skip: true }
      const inst = lookupInstitutionByName(prefix)
      if (!inst) return { _skip: true }
      return { institution: inst.apbaId, titleFilter: title }
    },
    reason: "정식 기관명 + 규정/지침 패턴 → ALIO 규정 목록",
    priority: 2,
  },
  {
    name: "alio_regulation_direct",
    patterns: (() => {
      const ps: RegExp[] = [
        /(?:ALIO|공공\s*기관)\s*(?:규정|지침|정관|내부\s*규정)/i,
      ]
      // 기관 식별자(등록 약어/명칭 또는 apbaId)가 있을 때만 규정 키워드 동반 매칭
      const tokenAlt = ALIAS_ALTERNATION ? `${ALIAS_ALTERNATION}|C\\d{4}` : `C\\d{4}`
      const ruleAlt = "규정|규칙|지침|정관|세칙|내규"
      ps.push(new RegExp(`(${tokenAlt}).*(${ruleAlt})`))
      ps.push(new RegExp(`(${ruleAlt}).*(${tokenAlt})`))
      return ps
    })(),
    tool: "list_alio_regulations",
    extract: (query) => {
      const inst = extractAlioInstitution(query)
      return inst ? { institution: inst } : { _fallback: true, query }
    },
    reason: "공공기관 규정 키워드 → ALIO 규정 목록",
    priority: 2,
  },

  // ── 30. 명시적 법령명 (법, 령, 규칙으로 끝나는) ──
  // "등록면허세법" 같이 법명 자체에 다른 패턴 키워드가 포함된 경우
  // 법명 패턴이 우선해야 하므로 priority를 신고/등록(16)보다 높게 설정.
  // "방법" 같은 일반 단어를 걸러내기 위해 블랙리스트로 필터링.
  // 의도 키워드(목차, 최근, 통합검색 등)가 동반되면 _skip하여 다음 패턴에 위임.
  {
    name: "explicit_law",
    patterns: [
      // "XX법", "XX시행령", "XX규칙" 등 법령명으로 끝나는 경우
      /[가-힣]+(법|시행령|시행규칙|규칙|규정|령)\s*$/,
    ],
    tool: "search_law",
    extract: (query) => {
      const q = query.trim()
      // "방법", "변경법" 등 법령명이 아닌 일반 단어 블랙리스트
      const nonLawSuffixes = /^(방법|변경법|입법|사법|문법|용법|어법|수법|기법|활법|진법|심법|산법)$/
      if (nonLawSuffixes.test(q)) {
        // 단독 비법령어 → 다음 패턴으로 (없으면 chain_full_research 폴백)
        return { _skip: true }
      }
      const lastWord = q.split(/\s+/).pop() || ""
      if (nonLawSuffixes.test(lastWord)) {
        return { _skip: true }
      }
      // 의도 키워드가 동반되면 이 패턴은 양보 → 더 구체적인 패턴이 처리
      if (/목차|편장절|체계도|통합\s*검색|최근\s*개정|개정\s*현황|법령\s*통계|조례\s*비교|영문|영어|English/i.test(q)) {
        return { _skip: true }
      }
      return { query: q }
    },
    reason: "법령명 패턴 → 법령 검색",
    priority: 3,
  },
]

// 모듈 로드 시 한 번만 정렬
const sortedPatterns = [...routePatterns].sort((a, b) => a.priority - b.priority)

// ────────────────────────────────────────
// 라우터 본체
// ────────────────────────────────────────

/**
 * 자연어 질의를 분석하여 최적의 도구로 라우팅
 */
export function routeQuery(query: string): RouteResult {
  const q = query.trim()

  // 빈 쿼리
  if (!q) {
    return {
      tool: "search_all",
      params: { query: "" },
      reason: "빈 쿼리 → 통합검색",
    }
  }

  // 자연어 날짜 조건 추출 (검색어에서 시간 표현 분리)
  const dateParsed = parseDateRange(q)
  const dateRange = dateParsed.range

  // 날짜 표현이 제거된 순수 검색어로 패턴 매칭
  const routeInput = dateParsed.cleanQuery || q
  const result = _matchRoute(routeInput)

  // 날짜 범위가 있으면 결과에 첨부
  if (dateRange) {
    result.dateRange = dateRange
  }
  return result
}

/** 패턴 매칭 내부 함수 (routeQuery에서만 호출) */
function _matchRoute(q: string): RouteResult {
  for (const pattern of sortedPatterns) {
    for (const regex of pattern.patterns) {
      const match = q.match(regex)
      if (match) {
        const params = pattern.extract(q, match)

        // _skip 플래그: 이 패턴은 매칭되었으나 의도가 다름 → 다음 패턴으로 진행
        // break로 inner loop(regex 목록) 전체를 빠져나가야 outer loop(패턴 목록)이 다음으로 진행
        if (params._skip) {
          break
        }

        // _fallback 플래그: 법령명 없이 키워드만 → 종합 리서치
        if (params._fallback) {
          delete params._fallback
          return {
            tool: "chain_full_research",
            params: { query: q },
            reason: `${pattern.reason} (법령명 미지정 → 종합 리서치로 전환)`,
          }
        }

        // _reroute 플래그: 복합 의도에서 더 적합한 도구로 재라우팅
        if (params._reroute) {
          const rerouteTool = params._reroute as string
          delete params._reroute
          return {
            tool: rerouteTool,
            params,
            reason: `${pattern.reason} → ${rerouteTool}로 재라우팅`,
          }
        }

        // _needsMst 플래그: 법령 검색이 먼저 필요한 경우 파이프라인 구성
        if (params._needsMst) {
          const searchQuery = (params._searchQuery as string) || q
          delete params._needsMst
          delete params._searchQuery

          // 내부 플래그 제거 후 남은 파라미터를 파이프라인에 전달
          const pipeParams = { ...params }

          return {
            tool: "search_law",
            params: { query: searchQuery },
            reason: `${pattern.reason} (법령 검색 → 조문 조회 자동 연결)`,
            pipeline: [
              {
                tool: pattern.tool,
                params: pipeParams,
              },
            ],
          }
        }

        // 검색 도구에 상세조회 체인이 설정되어 있으면 자동 파이프라인 추가
        const chain = SEARCH_DETAIL_CHAINS[pattern.tool]
        if (chain) {
          return {
            tool: pattern.tool,
            params,
            reason: pattern.reason,
            pipeline: [{ tool: chain.detailTool, params: {} }],
            autoChain: true,
          }
        }

        return {
          tool: pattern.tool,
          params,
          reason: pattern.reason,
        }
      }
    }
  }

  // 기본 폴백: 종합 리서치 체인
  return {
    tool: "chain_full_research",
    params: { query: q },
    reason: "패턴 미매칭 → 종합 리서치 (AI검색+법령+판례+해석례 병렬)",
  }
}

/**
 * 쿼리 의도 분석 결과 (디버깅/로깅용)
 */
export function explainRoute(query: string): string {
  const result = routeQuery(query)
  let explanation = `질의: "${query}"\n`
  explanation += `도구: ${result.tool}\n`
  explanation += `근거: ${result.reason}\n`
  explanation += `파라미터: ${JSON.stringify(result.params, null, 2)}\n`

  if (result.dateRange) {
    explanation += `날짜범위: ${result.dateRange.from} ~ ${result.dateRange.to}\n`
  }

  if (result.pipeline) {
    explanation += `파이프라인:\n`
    for (const step of result.pipeline) {
      explanation += `  → ${step.tool}(${JSON.stringify(step.params)})\n`
    }
  }

  return explanation
}
