#!/usr/bin/env node

/**
 * korean-law-alio-mcp uninstall
 *
 * 설치된 흔적을 일괄 정리:
 *   1. 각 MCP 클라이언트 설정 파일에서 'korean-law-alio' 항목 삭제
 *      (다른 MCP 서버는 보존)
 *   2. ALIO 데이터 디렉터리 삭제 (~/.korean-law-alio-mcp/)
 *   3. 우리 패키지가 들어있는 npx 캐시 삭제 — 단, 현재 실행 중인 캐시는 제외
 *      (자기 자신은 삭제 못 함 — OS 가 사용 중)
 *
 * 사용자 확인 prompt 후 실행 (기본 No — 실수 방지).
 *
 * 사용법:
 *   npx korean-law-alio-mcp@latest uninstall
 *   korean-law-alio-mcp uninstall   (글로벌 설치)
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { existsSync } from "node:fs"
import { readFile, writeFile, rm, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { detectClients } from "./setup.js"
import { userAlioDataDir } from "../lib/alio/paths.js"

const SERVER_NAME = "korean-law-alio"
const NPM_PACKAGE = "korean-law-alio-mcp"

const ESC = "\x1b["
const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  red: `${ESC}31m`,
  white: `${ESC}37m`,
}

interface FoundClientEntry {
  readonly name: string
  readonly configPath: string
  readonly hasEntry: boolean
}

async function ask(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  try {
    const ans = await rl.question(prompt)
    return ans.trim()
  } catch {
    return ""
  }
}

/** 디렉터리 사이즈 (간단 — du 가 정확하지만 cross-platform 위해 readdir 재귀) */
async function dirSizeMb(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0
  const { stat } = await import("node:fs/promises")
  let total = 0
  async function walk(p: string): Promise<void> {
    const entries = await readdir(p, { withFileTypes: true })
    for (const e of entries) {
      const child = path.join(p, e.name)
      if (e.isDirectory()) await walk(child)
      else if (e.isFile()) {
        try {
          const s = await stat(child)
          total += s.size
        } catch { /* ignore */ }
      }
    }
  }
  try { await walk(dir) } catch { /* ignore */ }
  return Math.round(total / 1024 / 1024)
}

/** ~/.npm/_npx 안에서 우리 패키지가 들어있는 디렉터리 목록 */
async function findNpxCaches(): Promise<string[]> {
  const npxRoot = path.join(homedir(), ".npm", "_npx")
  if (!existsSync(npxRoot)) return []
  const result: string[] = []
  try {
    const entries = await readdir(npxRoot)
    for (const entry of entries) {
      const pkgPath = path.join(npxRoot, entry, "node_modules", NPM_PACKAGE)
      if (existsSync(pkgPath)) result.push(path.join(npxRoot, entry))
    }
  } catch { /* ignore */ }
  return result
}

/** 현재 실행 중인 스크립트가 위치한 npx 캐시 디렉터리 (있다면) */
function currentNpxCache(): string | null {
  const here = fileURLToPath(import.meta.url)
  const m = here.match(/(.*\/\.npm\/_npx\/[^/]+)\//)
  return m ? m[1] : null
}

export async function runUninstall(): Promise<void> {
  console.log()
  console.log(`  ${c.bold}${c.red}korean-law-alio-mcp 제거${c.reset}`)
  console.log()

  // 1. 검사
  console.log(`  ${c.dim}검사 중...${c.reset}`)
  console.log()

  const clients = detectClients()
  const foundClients: FoundClientEntry[] = []
  for (const cl of clients) {
    if (!existsSync(cl.configPath)) continue
    let hasEntry = false
    try {
      const raw = await readFile(cl.configPath, "utf-8")
      const config = JSON.parse(raw) as Record<string, unknown>
      const servers = (config[cl.format] as Record<string, unknown> | undefined) ?? {}
      hasEntry = SERVER_NAME in servers
    } catch { /* JSON 파싱 실패면 skip */ }
    if (hasEntry) foundClients.push({ name: cl.name, configPath: cl.configPath, hasEntry })
  }

  const aliasDir = path.join(homedir(), ".korean-law-alio-mcp")
  const dataExists = existsSync(userAlioDataDir())
  const dataMb = dataExists ? await dirSizeMb(aliasDir) : 0

  const npxCaches = await findNpxCaches()
  const currentCache = currentNpxCache()
  const removableCaches = npxCaches.filter((d) => d !== currentCache)
  let cacheMb = 0
  for (const d of removableCaches) cacheMb += await dirSizeMb(d)

  // 보고
  console.log(`  ${c.bold}발견:${c.reset}`)
  if (foundClients.length === 0) {
    console.log(`    ${c.dim}- 등록된 MCP 클라이언트 없음${c.reset}`)
  } else {
    for (const f of foundClients) {
      console.log(`    ${c.green}✓${c.reset} ${c.white}${f.name}${c.reset} ${c.dim}(${f.configPath})${c.reset}`)
    }
  }
  if (dataExists) {
    console.log(`    ${c.green}✓${c.reset} ALIO 데이터 ${c.dim}(${aliasDir} — 약 ${dataMb}MB)${c.reset}`)
  } else {
    console.log(`    ${c.dim}- ALIO 데이터 없음${c.reset}`)
  }
  if (removableCaches.length > 0) {
    console.log(`    ${c.green}✓${c.reset} npx 캐시 ${removableCaches.length}건 ${c.dim}(약 ${cacheMb}MB)${c.reset}`)
    for (const d of removableCaches) console.log(`        ${c.dim}${d}${c.reset}`)
  }
  if (currentCache) {
    console.log(
      `    ${c.yellow}!${c.reset} 현재 실행 중인 캐시는 자동 삭제 못 함 ${c.dim}(${currentCache})${c.reset}`
    )
  }
  console.log()

  if (foundClients.length === 0 && !dataExists && removableCaches.length === 0 && !currentCache) {
    console.log(`  ${c.yellow}제거할 항목이 없습니다.${c.reset}`)
    console.log()
    return
  }

  // 2. 확인
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const ans = await ask(
      rl,
      `  ${c.cyan}>${c.reset} 위 항목들을 제거합니다. 계속하시겠습니까? ${c.bold}[y/N]${c.reset}: `
    )
    const trimmed = ans.toLowerCase()
    if (trimmed !== "y" && trimmed !== "yes" && trimmed !== "예") {
      console.log()
      console.log(`  ${c.yellow}취소됨.${c.reset}`)
      console.log()
      return
    }
  } finally {
    rl.close()
  }

  console.log()
  console.log(`  ${c.bold}제거 진행...${c.reset}`)
  console.log()

  // 3. 클라이언트 설정 정리
  for (const f of foundClients) {
    try {
      const raw = await readFile(f.configPath, "utf-8")
      const config = JSON.parse(raw) as Record<string, unknown>
      const servers = (config["mcpServers"] as Record<string, unknown> | undefined) ?? {}
      delete servers[SERVER_NAME]
      config["mcpServers"] = servers
      await writeFile(f.configPath, JSON.stringify(config, null, 2) + "\n", "utf-8")
      console.log(`  ${c.green}✓${c.reset} ${f.name} ${c.dim}— ${SERVER_NAME} 항목 제거${c.reset}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${c.red}✗${c.reset} ${f.name} ${c.dim}— 실패: ${msg}${c.reset}`)
    }
  }

  // 4. ALIO 데이터 삭제
  if (dataExists) {
    try {
      await rm(aliasDir, { recursive: true, force: true })
      console.log(`  ${c.green}✓${c.reset} ALIO 데이터 삭제 ${c.dim}(~${dataMb}MB 회수)${c.reset}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${c.red}✗${c.reset} ALIO 데이터 삭제 실패: ${c.dim}${msg}${c.reset}`)
    }
  }

  // 5. npx 캐시 삭제 (현재 캐시 제외)
  for (const d of removableCaches) {
    try {
      await rm(d, { recursive: true, force: true })
      console.log(`  ${c.green}✓${c.reset} npx 캐시 삭제 ${c.dim}(${d})${c.reset}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${c.red}✗${c.reset} npx 캐시 삭제 실패: ${c.dim}${d} — ${msg}${c.reset}`)
    }
  }

  // 6. 수동 정리 안내
  console.log()
  console.log(`  ${c.bold}추가 정리 (수동):${c.reset}`)
  if (currentCache) {
    console.log(
      `    ${c.dim}- 현재 실행 중인 npx 캐시 (이 스크립트 종료 후 삭제):${c.reset}`
    )
    console.log(`      ${c.cyan}rm -rf "${currentCache}"${c.reset}`)
  }
  console.log(`    ${c.dim}- 글로벌 설치 사용자라면:${c.reset}`)
  console.log(`      ${c.cyan}npm uninstall -g ${NPM_PACKAGE}${c.reset}`)
  console.log(
    `    ${c.dim}- ${c.bold}LAW_OC${c.reset}${c.dim} 환경변수가 ~/.zshrc / ~/.bashrc 에 있다면 수동으로 줄 삭제${c.reset}`
  )
  console.log()
  console.log(`  ${c.green}${c.bold}제거 완료.${c.reset}`)
  console.log()
}
