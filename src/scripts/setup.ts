#!/usr/bin/env node

/**
 * korean-law-alio-mcp setup wizard
 *
 * 사용:
 *   npx korean-law-alio-mcp setup        # npm publish 후
 *   node build/index.js setup            # 로컬 빌드에서
 *
 * 흐름:
 *   1. API 키 입력 (옵셔널)
 *   2. 운영 모드 선택 — 원격 fly / 로컬 stdio
 *   3. AI 클라이언트 다중 선택 (Claude Desktop · Code · Cursor · VS Code · Windsurf)
 *   4. 각 클라이언트의 mcpServers JSON 자동 업데이트
 *   5. 다음 액션 안내 (로컬 모드: ALIO 데이터 준비)
 *
 * 디자인 참고: 원작자(@chrisryugj) src/setup.ts — interactive wizard 패턴.
 * 우리 추가: 운영 모드(원격/로컬) 분기 + ALIO 데이터 준비 안내.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { existsSync } from "node:fs"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const REMOTE_URL = "https://korean-law-alio-mcp.fly.dev/mcp"
const SERVER_NAME = "korean-law-alio"
const NPM_PACKAGE = "korean-law-alio-mcp"

interface ClientConfig {
  readonly name: string
  readonly configPath: string
  readonly format: "mcpServers" // (Zed 의 context_servers 는 향후 추가)
}

function detectClients(): readonly ClientConfig[] {
  const home = homedir()
  const clients: ClientConfig[] = []

  // Claude Desktop — OS 별 경로
  const claudePaths: Record<string, string> = {
    darwin: resolve(home, "Library/Application Support/Claude/claude_desktop_config.json"),
    win32: resolve(process.env.APPDATA ?? resolve(home, "AppData/Roaming"), "Claude/claude_desktop_config.json"),
    linux: resolve(home, ".config/Claude/claude_desktop_config.json"),
  }
  const claudePath = claudePaths[process.platform]
  if (claudePath) {
    clients.push({ name: "Claude Desktop", configPath: claudePath, format: "mcpServers" })
  }

  // Claude Code (project-level .mcp.json)
  clients.push({
    name: "Claude Code (project .mcp.json)",
    configPath: resolve(process.cwd(), ".mcp.json"),
    format: "mcpServers",
  })

  // Cursor (user-level)
  clients.push({
    name: "Cursor",
    configPath: resolve(home, ".cursor/mcp.json"),
    format: "mcpServers",
  })

  // VS Code (project-level)
  clients.push({
    name: "VS Code (project .vscode/mcp.json)",
    configPath: resolve(process.cwd(), ".vscode/mcp.json"),
    format: "mcpServers",
  })

  // Windsurf (user-level)
  clients.push({
    name: "Windsurf",
    configPath: resolve(home, ".codeium/windsurf/mcp_config.json"),
    format: "mcpServers",
  })

  return clients
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  if (!existsSync(path)) return {}
  const raw = await readFile(path, "utf-8")
  if (!raw.trim()) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

async function writeJsonFile(path: string, data: Record<string, unknown>): Promise<void> {
  const dir = dirname(path)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

type InstallMode =
  | { type: "remote"; url: string }
  | { type: "local"; buildPath: string }
  | { type: "global" }

function buildServerEntry(
  apiKey: string,
  mode: InstallMode,
  clientName?: string
): Record<string, unknown> {
  if (mode.type === "remote") {
    const url = apiKey ? `${mode.url}?oc=${encodeURIComponent(apiKey)}` : mode.url
    // Claude Desktop 은 mcpServers 에서 "url" 필드를 지원하지 않음 (stdio 만).
    // 또한 streamable-HTTP 직접 등록 시 Anthropic 측 알려진 버그
    // (anthropics/claude-ai-mcp#211) 로 성공한 도구 호출에도 "Tool result could
    // not be submitted" 배너가 뜸. mcp-remote 가 stdio 로 변환해 양쪽 모두 우회.
    if (clientName === "Claude Desktop") {
      return { command: "npx", args: ["mcp-remote", url] }
    }
    return { url }
  }
  const env: Record<string, string> = {}
  if (apiKey) env.LAW_OC = apiKey
  if (mode.type === "global") {
    return { command: "npx", args: ["-y", NPM_PACKAGE], env }
  }
  return { command: "node", args: [mode.buildPath], env }
}

// ─────────────────────────────────────────
// ANSI helpers (no deps)
// ─────────────────────────────────────────
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
} as const

function printBanner(): void {
  console.log()
  console.log(`  ${c.bold}${c.cyan}Korean Law + ALIO MCP — Setup Wizard${c.reset}`)
  console.log(`  ${c.dim}법제처 87 + ALIO 23 = 110개 도구 · 자연어 자동 라우팅 + cross-domain 브리지${c.reset}`)
  console.log()
  console.log(`  ${c.dim}${"━".repeat(64)}${c.reset}`)
  console.log()
}

function stepHeader(step: number, total: number, title: string): void {
  console.log(`  ${c.cyan}${c.bold}[${step}/${total}]${c.reset} ${c.white}${c.bold}${title}${c.reset}`)
  console.log()
}

function ok(label: string, detail = ""): void {
  console.log(`  ${c.green}✓${c.reset} ${c.white}${label}${c.reset}${detail ? `\n    ${c.dim}${detail}${c.reset}` : ""}`)
}

function fail(label: string, detail: string): void {
  console.log(`  ${c.red}✗${c.reset} ${c.white}${label}${c.reset}\n    ${c.dim}${detail}${c.reset}`)
}

function detectLocalBuild(): string | null {
  // 자기 위치(build/scripts/setup.js) → 2단 위 build 디렉터리 → index.js
  const here = fileURLToPath(import.meta.url)
  const indexPath = resolve(dirname(here), "..", "index.js")
  return existsSync(indexPath) ? indexPath : null
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

/** readline.question 안전판 — stdin EOF 시 빈 문자열 반환 (Ctrl+D 또는 pipe close 대응) */
async function ask(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  try {
    const ans = await rl.question(prompt)
    return ans.trim()
  } catch {
    return ""
  }
}

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout })

  try {
    printBanner()

    // ── Step 1: API 키 ──
    stepHeader(1, 4, "법제처 API 키")
    console.log(`  ${c.dim}발급(무료, 1분): https://open.law.go.kr/LSO/openApi/guideResult.do${c.reset}`)
    console.log(`  ${c.dim}IP/도메인 등록은 비워두는 것을 권장 — 어디서든 호출 가능${c.reset}`)
    console.log(`  ${c.dim}Enter로 건너뛰기 — 나중에 설정 파일에서 수동 입력 가능${c.reset}`)
    console.log()
    const apiKey = await ask(rl, `  ${c.cyan}>${c.reset} API 키: `)
    if (apiKey) ok("키 등록됨")
    else console.log(`  ${c.yellow}-${c.reset} 건너뜀`)
    console.log()

    // ── Step 2: 운영 모드 ──
    stepHeader(2, 4, "운영 모드 선택")
    const localBuild = detectLocalBuild()
    console.log(`  ${c.cyan}1${c.reset}) ${c.white}원격 모드${c.reset}    ${c.dim}— 운영자 fly 서버 사용 (${REMOTE_URL})${c.reset}`)
    console.log(`     ${c.dim}즉시 110개 도구 + ALIO 데이터 mirror 사용 (best-effort 갱신)${c.reset}`)
    if (localBuild) {
      console.log(`  ${c.cyan}2${c.reset}) ${c.white}로컬 모드 (이 빌드)${c.reset}  ${c.dim}— stdio + ${localBuild}${c.reset}`)
      console.log(`     ${c.dim}자기 PC 에서 실행 — ALIO 데이터 별도 준비 필요${c.reset}`)
    } else {
      console.log(`  ${c.dim}2) 로컬 모드 — 빌드 미감지 (npm run build 후 다시 실행)${c.reset}`)
    }
    console.log()
    const modeInput = (await ask(rl, `  ${c.cyan}>${c.reset} 번호 (기본 1): `)) || "1"

    let mode: InstallMode
    if (modeInput === "2" && localBuild) {
      mode = { type: "local", buildPath: localBuild }
      ok("로컬 모드", localBuild)
    } else {
      mode = { type: "remote", url: REMOTE_URL }
      ok("원격 모드", REMOTE_URL)
    }
    console.log()

    // ── Step 3: 클라이언트 선택 ──
    stepHeader(3, 4, "MCP 클라이언트 선택 (다중 가능, 쉼표 구분)")
    const clients = detectClients()
    clients.forEach((cl, i) => {
      const exists = existsSync(cl.configPath)
      const badge = exists ? ` ${c.green}[감지됨]${c.reset}` : ""
      console.log(`  ${c.cyan}${String(i + 1).padStart(2)}${c.reset}) ${c.white}${cl.name}${c.reset}${badge}`)
      console.log(`      ${c.dim}${cl.configPath}${c.reset}`)
    })
    console.log()
    const clientInput = await ask(rl, `  ${c.cyan}>${c.reset} 번호 (예: 1,3 / Enter로 수동 안내): `)

    if (!clientInput) {
      console.log()
      printManualConfig(apiKey, mode)
      return
    }

    const indices = clientInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((i) => i >= 0 && i < clients.length)

    if (indices.length === 0) {
      console.log(`\n  ${c.yellow}유효한 선택 없음${c.reset}`)
      printManualConfig(apiKey, mode)
      return
    }

    // ── Step 4: 설정 파일 업데이트 ──
    console.log()
    stepHeader(4, 4, "설정 파일 업데이트")

    for (const idx of indices) {
      const client = clients[idx]
      try {
        const entry = buildServerEntry(apiKey, mode, client.name)
        const config = await readJsonFile(client.configPath)
        const servers = (config[client.format] ?? {}) as Record<string, unknown>
        servers[SERVER_NAME] = entry
        config[client.format] = servers
        await writeJsonFile(client.configPath, config)
        ok(client.name, client.configPath)
      } catch (err) {
        fail(client.name, err instanceof Error ? err.message : String(err))
      }
    }

    printComplete(apiKey, mode)
  } finally {
    rl.close()
  }
}

function printComplete(apiKey: string, mode: InstallMode): void {
  console.log()
  console.log(`  ${c.green}${c.bold}╔${"═".repeat(58)}╗${c.reset}`)
  console.log(
    `  ${c.green}${c.bold}║${c.reset}${" ".repeat(20)}${c.green}${c.bold}Setup Complete!${c.reset}${" ".repeat(23)}${c.green}${c.bold}║${c.reset}`
  )
  console.log(`  ${c.green}${c.bold}╚${"═".repeat(58)}╝${c.reset}`)
  console.log()

  if (!apiKey) {
    console.log(
      `  ${c.yellow}!${c.reset} API 키 미설정 — 환경변수 ${c.bold}LAW_OC${c.reset} 또는 설정 파일의 ${c.bold}env.LAW_OC${c.reset} 직접 수정`
    )
    console.log()
  }

  if (mode.type === "local") {
    console.log(`  ${c.bold}다음 단계 — ALIO 데이터 준비${c.reset}`)
    console.log(`  ${c.dim}로컬 모드는 자기 PC 에 ALIO 데이터를 보관해야 합니다:${c.reset}`)
    console.log(`  ${c.dim}  • 직접 sync (6-12시간):     npm run alio:sync${c.reset}`)
    console.log(
      `  ${c.dim}  • Releases mirror (5-15분):  github.com/scvcoder/korean-law-alio-mcp/releases${c.reset}`
    )
    console.log()
  } else {
    console.log(`  ${c.dim}원격 모드 — 운영자가 갱신하는 ALIO 데이터를 best-effort 사용${c.reset}`)
    console.log(
      `  ${c.dim}응답의 fetchedAt 으로 시점 확인 권장. 자세한 책임 분담은 NOTICE 참고${c.reset}`
    )
    console.log()
  }

  console.log(
    `  ${c.dim}AI 클라이언트를 ${c.bold}재시작${c.reset}${c.dim}하면 ${c.bold}${SERVER_NAME}${c.reset}${c.dim} MCP 서버가 활성화됩니다.${c.reset}`
  )
  console.log()
}

function printManualConfig(apiKey: string, mode: InstallMode): void {
  const entry = buildServerEntry(apiKey, mode)
  console.log(`  ${c.dim}아래 JSON 을 클라이언트 설정 파일의 mcpServers 에 추가하세요:${c.reset}`)
  console.log()
  console.log(`  ${c.cyan}"${SERVER_NAME}"${c.reset}: ${JSON.stringify(entry, null, 4).split("\n").join("\n  ")}`)
  console.log()
}
