#!/usr/bin/env node

/**
 * korean-law-alio-mcp fetch-data
 *
 * ALIO 데이터 단독 다운로드 + 압축 해제.
 * `npm install -g korean-law-alio-mcp` 후 데이터까지 받고 싶을 때 사용.
 *
 * 대상 디렉터리 결정:
 *   1. ALIO_DATA_DIR 환경변수가 있으면 그 경로
 *   2. 없으면 ~/.korean-law-alio-mcp/data/alio (사용자 홈 — sudo 불필요)
 *
 * 런타임의 alioDataDir() 도 동일 user home 을 폴백으로 인식하므로 별도 환경변수 설정 없이
 * fetch-data 후 바로 사용 가능.
 */

import path from "node:path"
import { ensureAlioData } from "./setup.js"
import { userAlioDataDir } from "../lib/alio/paths.js"

const ESC = "\x1b["
const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  red: `${ESC}31m`,
}

export async function runFetchData(): Promise<void> {
  const override = process.env.ALIO_DATA_DIR
  const destDir = override?.trim() ? path.resolve(override.trim()) : userAlioDataDir()

  console.log()
  console.log(`  ${c.bold}${c.cyan}ALIO 데이터 다운로드 (강제 갱신)${c.reset}`)
  console.log(`  ${c.dim}대상: ${destDir}${c.reset}`)
  if (override?.trim()) {
    console.log(`  ${c.dim}(ALIO_DATA_DIR 환경변수 존중)${c.reset}`)
  }
  console.log(`  ${c.dim}기존 데이터가 있으면 다운로드 성공 후 자동 갱신 (다운로드 실패 시 기존 데이터 보존)${c.reset}`)
  console.log()

  try {
    const result = await ensureAlioData(destDir, { force: true })
    const action = result.refreshed ? "갱신" : "신규 받기"
    console.log(
      `  ${c.green}✓${c.reset} ${action} 완료${result.sizeMb ? ` (~${result.sizeMb}MB)` : ""}`
    )
    console.log()
    console.log(`  ${c.dim}이제 ${c.bold}korean-law-alio "..."${c.reset}${c.dim} 같이 CLI 또는 MCP 도구로 ALIO 자료 호출 가능${c.reset}`)
    console.log()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ${c.red}✗${c.reset} 다운로드 실패: ${msg}`)
    console.error()
    console.error(`  ${c.dim}수동 fallback:${c.reset}`)
    console.error(
      `  ${c.dim}  curl -L -o /tmp/alio-data.tar.gz https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.tar.gz${c.reset}`
    )
    console.error(`  ${c.dim}  mkdir -p "${destDir}"${c.reset}`)
    console.error(`  ${c.dim}  tar -xzf /tmp/alio-data.tar.gz -C "${destDir}"${c.reset}`)
    process.exit(1)
  }
}
