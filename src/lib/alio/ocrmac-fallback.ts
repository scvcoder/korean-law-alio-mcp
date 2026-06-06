/**
 * Apple Vision (ocrmac) 직접 OCR fallback — docling/tesseract 가 실패한 스캔 PDF 전용
 *
 * 배경: docling 의 ocrmac 백엔드는 한국어 처리에서 UnicodeDecodeError 로 깨진다.
 * 반면 ocrmac(파이썬, Apple Vision Framework) 을 직접 호출하면 불량 스캔본 한국어를
 * tesseract 대비 압도적으로 정확하게 인식한다 (tesseract 가 빈 출력/깨짐을 내는 PDF 도 복구).
 *
 * 그래서 이 모듈은 docling 을 거치지 않고:
 *   PDF → pdftoppm(PNG, 고해상도) → ocrmac(페이지별 Apple Vision OCR) → markdown 조립
 *
 * macOS 전용 (Apple Vision). 비-macOS 또는 미설치 환경에서는 isOcrmacAvailable()=false → 자동 skip.
 *
 * 요구사항:
 *   - macOS (darwin)
 *   - pdftoppm (poppler) — brew install poppler
 *   - python3 + ocrmac — pip3 install ocrmac
 *
 * 환경변수:
 *   - OCRMAC_PYTHON      : python 실행 파일 (기본: "python3")
 *   - OCRMAC_LANG        : Apple Vision 언어 우선순위 (기본: "ko-KR,en-US")
 *   - OCRMAC_DPI         : pdftoppm 렌더 해상도 (기본: "300")
 *   - OCRMAC_TIMEOUT_MS  : PDF 1건 전체 timeout (기본: 300000 = 5분)
 */

import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"

const OCRMAC_PYTHON = process.env.OCRMAC_PYTHON || "python3"
const OCRMAC_LANG = process.env.OCRMAC_LANG || "ko-KR,en-US"
const OCRMAC_DPI = process.env.OCRMAC_DPI || "300"
const OCRMAC_TIMEOUT_MS = Number(process.env.OCRMAC_TIMEOUT_MS || 300_000)
const PDFTOPPM_BIN = process.env.PDFTOPPM_BIN || "pdftoppm"

export interface OcrmacResult {
  success: boolean
  markdown?: string
  error?: string
  elapsedMs: number
}

/** 페이지별 OCR 을 수행하는 파이썬 스크립트 (이미지 디렉터리 → stdout markdown) */
const OCR_PY = `
import sys, glob, os
from ocrmac import ocrmac
img_dir = sys.argv[1]
langs = [s for s in sys.argv[2].split(',') if s] or ['ko-KR', 'en-US']
imgs = sorted(glob.glob(os.path.join(img_dir, '*.png')))
parts = []
for img in imgs:
    try:
        res = ocrmac.OCR(img, language_preference=langs).recognize()
        parts.append('\\n'.join(t for (t, conf, box) in res))
    except Exception as e:
        parts.append('')
sys.stdout.buffer.write(('\\n\\n'.join(parts)).encode('utf-8'))
`

let cachedAvailability: boolean | null = null

/** macOS + pdftoppm + python3/ocrmac 가용 여부 (1회 체크 후 캐시). */
export async function isOcrmacAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability
  if (process.platform !== "darwin") {
    cachedAvailability = false
    return false
  }
  try {
    const pdftoppm = await checkExit(PDFTOPPM_BIN, ["-h"])
    const py = await checkExit(OCRMAC_PYTHON, ["-c", "import ocrmac"])
    cachedAvailability = pdftoppm && py
  } catch {
    cachedAvailability = false
  }
  return cachedAvailability
}

function checkExit(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "ignore"] })
    let done = false
    const fin = (ok: boolean) => {
      if (done) return
      done = true
      resolve(ok)
    }
    child.on("error", () => fin(false))
    // pdftoppm -h 는 exit 0, 그 외 0 이면 성공. (pdftoppm 은 인자 없으면 99 라 -h 사용)
    child.on("exit", (code) => fin(code === 0))
    setTimeout(() => {
      child.kill()
      fin(false)
    }, 10_000)
  })
}

/** ocrmac 가 직접 OCR 가능한 래스터 이미지 확장자 (PDF 변환 없이 Apple Vision 으로 바로 처리) */
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "tif", "tiff", "bmp", "webp", "heic"])

/** 파일명이 ocrmac 직접 OCR 대상 이미지인지 */
export function isOcrmacImage(filename: string): boolean {
  return IMAGE_EXTS.has((filename.toLowerCase().split(".").pop() || ""))
}

/**
 * 스캔 PDF 를 Apple Vision 으로 OCR 하여 markdown 반환.
 * 성공 시 markdown, 실패/빈출력 시 success=false + error.
 */
export async function parsePdfWithOcrmac(
  bytes: Buffer,
  hintName = "input.pdf"
): Promise<OcrmacResult> {
  const startedAt = Date.now()
  const id = crypto.randomBytes(6).toString("hex")
  const tmpBase = path.join(os.tmpdir(), `alio-ocrmac-${id}`)
  const tmpInput = `${tmpBase}.pdf`
  const tmpImgDir = `${tmpBase}-img`
  await fs.mkdir(tmpImgDir, { recursive: true })
  await fs.writeFile(tmpInput, bytes)

  try {
    // PDF → PNG (pdftoppm). 출력: {tmpImgDir}/page-1.png, page-2.png ...
    const ppm = await runProc(
      PDFTOPPM_BIN,
      ["-png", "-r", OCRMAC_DPI, tmpInput, path.join(tmpImgDir, "page")],
      OCRMAC_TIMEOUT_MS
    )
    if (ppm.code !== 0) {
      return {
        success: false,
        error: `pdftoppm exit ${ppm.code}: ${ppm.stderr.slice(-300)}`,
        elapsedMs: Date.now() - startedAt,
      }
    }
    const pageCount = (await fs.readdir(tmpImgDir)).filter((f) => f.endsWith(".png")).length
    if (pageCount === 0) {
      return { success: false, error: "pdftoppm 이 페이지 이미지를 만들지 못함", elapsedMs: Date.now() - startedAt }
    }
    return await ocrImageDir(tmpImgDir, startedAt, `${pageCount} pages @ ${OCRMAC_DPI}dpi`, hintName)
  } finally {
    await fs.rm(tmpInput, { force: true }).catch(() => {})
    await fs.rm(tmpImgDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * 래스터 이미지 파일(jpg/png/gif 등)을 Apple Vision 으로 직접 OCR.
 * kordoc 이 "지원하지 않는 형식"으로 거부하는 원시 이미지 첨부 복구용 (PDF 변환 불필요).
 */
export async function parseImageWithOcrmac(
  bytes: Buffer,
  hintName = "input.png"
): Promise<OcrmacResult> {
  const startedAt = Date.now()
  const id = crypto.randomBytes(6).toString("hex")
  const tmpImgDir = path.join(os.tmpdir(), `alio-ocrmac-img-${id}`)
  await fs.mkdir(tmpImgDir, { recursive: true })
  // ocrmac 은 png/jpg 등을 직접 읽으므로 확장자 보존해 저장. OCR_PY 는 *.png 만 glob 하므로
  // PIL(Pillow) 로 png 변환을 거치지 않고, 비-png 는 png 로 심볼릭하게 복사 대신 확장자만 png 로 저장.
  // (Apple Vision 은 내용 기반으로 디코딩하므로 확장자는 무관)
  await fs.writeFile(path.join(tmpImgDir, "page-1.png"), bytes)
  try {
    return await ocrImageDir(tmpImgDir, startedAt, "1 image", hintName)
  } finally {
    await fs.rm(tmpImgDir, { recursive: true, force: true }).catch(() => {})
  }
}

/** 이미지 디렉터리(*.png)를 ocrmac python 으로 OCR → markdown 조립 (공통 단계) */
async function ocrImageDir(
  imgDir: string,
  startedAt: number,
  pageInfo: string,
  hintName: string
): Promise<OcrmacResult> {
  const tmpScript = `${imgDir}.py`
  await fs.writeFile(tmpScript, OCR_PY)
  try {
    const ocr = await runProc(OCRMAC_PYTHON, [tmpScript, imgDir, OCRMAC_LANG], OCRMAC_TIMEOUT_MS)
    if (ocr.code !== 0) {
      return { success: false, error: `ocrmac exit ${ocr.code}: ${ocr.stderr.slice(-300)}`, elapsedMs: Date.now() - startedAt }
    }
    if (!ocr.stdout.trim()) {
      return { success: false, error: "ocrmac 출력이 비어 있습니다 (Apple Vision 이 텍스트를 못 찾음)", elapsedMs: Date.now() - startedAt }
    }
    // Apple Vision 출력은 어절 띄어쓰기가 정확하므로 tesseract 용 공백제거 정규화는 미적용 (경량 정리만)
    const header = `<!-- parsed by ocrmac/AppleVision (fallback from kordoc+docling), ${pageInfo}, source: ${hintName} -->\n\n`
    return { success: true, markdown: header + lightCleanup(ocr.stdout), elapsedMs: Date.now() - startedAt }
  } finally {
    await fs.rm(tmpScript, { force: true }).catch(() => {})
  }
}

/** Apple Vision 출력 경량 정리 — 줄끝 공백 제거 + 3줄 이상 연속 빈 줄 → 2줄. 어절 공백은 보존. */
function lightCleanup(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function runProc(
  bin: string,
  args: string[],
  timeoutMs: number
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONWARNINGS: "ignore" },
    })
    const stdoutChunks: Buffer[] = []
    let stderr = ""
    child.stdout?.on("data", (c) => stdoutChunks.push(Buffer.from(c)))
    child.stderr?.on("data", (c) => {
      stderr += c.toString("utf8")
      if (stderr.length > 40_000) stderr = stderr.slice(-20_000)
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, timeoutMs)
    child.on("error", (err) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout: "", stderr: stderr + "\nspawn error: " + err.message })
    })
    child.on("exit", (code) => {
      clearTimeout(timer)
      const stdout = Buffer.concat(stdoutChunks).toString("utf8")
      if (timedOut) {
        resolve({ code: -2, stdout, stderr: stderr + `\ntimeout after ${timeoutMs}ms` })
        return
      }
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}
