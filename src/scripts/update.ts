#!/usr/bin/env node

/**
 * korean-law-alio-mcp update
 *
 * 기존 설치 사용자를 위한 "최신 상태로 만들기" 통합 커맨드.
 * - 코드 버전: `npx korean-law-alio-mcp@latest update` 로 호출하면 npm registry 의 latest
 *             버전이 자동으로 캐시에 받혀 그 코드가 실행됨 (npx 동작). 본 커맨드는
 *             현재 실행 중인 버전을 표시해 사용자가 latest 여부를 확인할 수 있게 함.
 * - ALIO 데이터: fetch-data 와 동일 — 다운로드 후 안전 교체 (실패 시 기존 보존).
 *
 * 사용법:
 *   npx korean-law-alio-mcp@latest update            # npx 사용자 (권장)
 *   korean-law-alio-mcp update                        # 글로벌 설치 사용자
 *
 * fetch-data 와 차이: 동작 같음. update 는 "기존 사용자 갱신" 의미를 더 직관적으로 전달.
 */

import { runFetchData } from "./fetch-data.js"
import { VERSION } from "../version.js"

const ESC = "\x1b["
const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
}

export async function runUpdate(): Promise<void> {
  console.log()
  console.log(`  ${c.bold}${c.cyan}korean-law-alio-mcp 업데이트${c.reset}`)
  console.log(`  ${c.dim}실행 중인 버전: v${VERSION}${c.reset}`)
  console.log()
  console.log(`  ${c.dim}코드: \`npx korean-law-alio-mcp@latest update\` 로 호출하면 npm 의 최신 버전이 자동 적용됩니다.${c.reset}`)
  console.log(`  ${c.dim}      글로벌 설치 (\`npm install -g\`) 사용자는 \`npm update -g korean-law-alio-mcp\` 도 같이 실행 권장.${c.reset}`)
  console.log()
  console.log(`  ${c.dim}─${c.reset}`.repeat(40))

  // ALIO 데이터 갱신 — fetch-data 의 로직 재사용
  await runFetchData()
}
