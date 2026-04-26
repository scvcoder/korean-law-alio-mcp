# Korean Law ALIO MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tools: 110](https://img.shields.io/badge/MCP%20Tools-110-blue.svg)](./docs/API.md)
[![ALIO Coverage: 35,000+](https://img.shields.io/badge/ALIO%20Regulations-35%2C000%2B-green.svg)](#-what-this-fork-adds-vs-upstream-v22)

---

An MCP for searching, comparing, and analyzing Korean national law (법제처) and the internal regulations of public institutions (ALIO).

110 MCP tools — 87 Korean Law portal + 23 ALIO public-institution regulations — perform the analysis.

Searches and compares 1,600 active laws, 10,000 administrative rules, tens of thousands of court precedents, and 35,000 internal regulations across 344 public institutions, then feeds the results to your AI assistant for higher-quality answers.

<sub>This project is forked and derived from [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp).</sub>

![Korean Law ALIO MCP demo](./demo.png)

---

## ✨ What this fork adds (vs upstream v2.2)

| Area | Upstream (v2.2) | This fork (v1.0.0) |
|------|----------------|--------------------|
| MCP tools | 87 (Korean Law) | **110** (87 Law + 23 ALIO) |
| Data | Korean Law portal only | + **ALIO 344 public institutions / 35,208 internal regulations** |
| Value | Reads | Reads + **compares + benchmarks** |
| License | MIT | MIT (4 files clean-room rewritten — zero BSL / Source-Available code) |

The 87 Korean-Law tools that the upstream author built solidly are kept as-is. This fork adds ALIO public-institution regulation integration, generalization, and license-hygiene work on top.
For the upstream's rich marketing copy, tool categories, and chain-tool descriptions, see [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md).

---

## 🚀 Installation & Usage

### Step 0: Get an API Key (free, 1 minute)

All methods share one prerequisite — a **Korean Law portal API key (OC)**:

1. Go to [open.law.go.kr](https://open.law.go.kr/LSO/openApi/guideResult.do)
2. Sign up & log in
3. Click "Open API 사용 신청" (apply for Open API access)
4. Submit the form → receive your **OC key** (email-ID format)

> All examples below use `your-api-key-here` as a placeholder — replace with your issued key. (Same convention as [`.env.example`](./.env.example))

> ⓘ **Recommended: leave the IP/domain registration field empty** when applying — keys without IP registration work from anywhere (local & remote). If you do register IPs/domains, the key only works from those — and remote methods (2 & 3) will require you to add `korean-law-alio-mcp.fly.dev` to your whitelist.

### Method 1: Claude Code Plugin — One-line install ⏳ Coming soon

> Marketplace registration is planned for the next release. For now, use Methods 2–5.

When activated:
```
/plugin marketplace add scvcoder/korean-law-alio-mcp
/plugin install korean-law-alio@korean-law-alio-marketplace
```

### Method 2: Use directly in Claude.ai web (no install) ⚡ Easiest

Add a custom connector at [claude.ai](https://claude.ai). Requires Pro/Max/Team/Enterprise plan (Free plan limits to 1 connector).

**How to add the connector**:

1. Log in to claude.ai
2. Sidebar bottom (your name) → "Settings" → "Connectors"
3. "Custom Connectors" → "Add custom connector"
4. Enter (replace `your-api-key-here` with your actual key):
   - **Name**: `korean-law-alio` (free choice)
   - **URL**: `https://korean-law-alio-mcp.fly.dev/mcp?oc=your-api-key-here`
5. Click "Add" → done

**Activate tools (important)**: open the connector's "Configure" → set **all tools to "Always allow"**. The AI can then call them without per-request approval.

Now ask in natural language:

```
"Show me Article 74 of the Labor Standards Act"        → Korean Law (87 tools)
"Show ○○ Agency's HR regulations"                      → ALIO (23 tools)
"What upper laws does ○○ Agency's HR rule cite?"       → cross-domain (ALIO → Korean Law)
"Public-institution rules following the Labor Std Act" → cross-domain (reverse)
"Compare leave-of-absence rules across institutions"   → ALIO peer comparison
```

> **Calls go under your key** — they pass through the maintainer's fly server but are billed against *your* quota at the Korean Law portal. The maintainer's quota is unaffected.
>
> **ALIO data is refreshed best-effort by the maintainer** — every response preserves `fetchedAt` (snapshot time) and `sourceDetailUrl` (live ALIO link). For time-sensitive use, verify against the live source. See the "Data sources" section in [`NOTICE`](./NOTICE) for the full per-mode responsibility allocation.

### Method 3: AI Desktop Apps (Claude Desktop · Cursor · Windsurf)

Add to your config file:

```json
{
  "mcpServers": {
    "korean-law-alio": {
      "url": "https://korean-law-alio-mcp.fly.dev/mcp?oc=your-api-key-here"
    }
  }
}
```

**Config file locations**:

| App | macOS | Windows |
|-----|-------|---------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `<project>/.cursor/mcp.json` | `<project>/.cursor/mcp.json` |
| Windsurf | `<project>/.windsurf/mcp.json` | `<project>/.windsurf/mcp.json` |

If you already have other MCP servers configured, just add the `"korean-law-alio": { ... }` entry inside `"mcpServers": { ... }`. Restart the app.

### Method 4: Install on Your Own Machine (offline · security-sensitive · data control)

Runs on your own PC without going through any remote server. You control the ALIO data. **Prereq**: Node.js ≥ 20.

#### 4-A. Setup wizard

An interactive wizard handles ① API key entry → ② operating mode (remote fly / local stdio) → ③ AI client selection (Claude Desktop · Code · Cursor · VS Code · Windsurf) → ④ config-file auto-registration.

```bash
# Available today — after local git clone + build
git clone https://github.com/scvcoder/korean-law-alio-mcp
cd korean-law-alio-mcp && npm install && npm run build
node build/index.js setup

# Coming after npm publish — same wizard in one line
npx korean-law-alio-mcp setup
```

#### 4-B. Manual install (works today)

```bash
git clone https://github.com/scvcoder/korean-law-alio-mcp
cd korean-law-alio-mcp
npm install && npm run build
echo "LAW_OC=your-api-key-here" > .env
```

Prepare ALIO data — pick one:

```bash
# (i) Direct sync — slower but full control (6-12 h, external tools recommended)
#     macOS:   brew install docling tesseract tesseract-lang libreoffice
#     Linux:   sudo apt install tesseract-ocr tesseract-ocr-kor libreoffice && pip install docling
#     Windows: Node.js alone works (only edge cases get parseError)
npm run alio:sync                   # all 344 institutions
npm run alio:sync -- --only C0xxx   # single institution (apbaId 4-digit, minutes)

# (ii) Use the maintainer's mirror — faster, no external tools (5-15 min, best-effort refresh)
# macOS/Linux:
curl -L -o alio-data.tar.gz \
  https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.tar.gz
tar -xzf alio-data.tar.gz -C data/
# Windows (PowerShell):
Invoke-WebRequest -Uri https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.zip -OutFile alio-data.zip
Expand-Archive -Path alio-data.zip -DestinationPath data\
```

Register with your AI client in stdio mode:

```json
{
  "mcpServers": {
    "korean-law-alio": {
      "command": "node",
      "args": ["/absolute/path/korean-law-alio-mcp/build/index.js"],
      "env": { "LAW_OC": "your-api-key-here" }
    }
  }
}
```

> ⚠️ **The data mirror is best-effort** — the Releases `tag` is the snapshot date; the `fetchedAt` field inside `manifest.json` gives the exact timestamp. For time-sensitive use, run `npm run alio:sync` to refresh from source. Any harm caused by snapshot drift is the user's responsibility. Full responsibility allocation: [`NOTICE`](./NOTICE).

### Method 5: Use from the terminal (CLI)

Developers can search with a single natural-language line.

#### 5-A. Global install ⏳ Coming soon

```bash
# Activated after npm publish
npm install -g korean-law-alio-mcp
export LAW_OC=your-api-key-here     # Mac/Linux
korean-law-alio "Civil Act Article 1"
```

#### 5-B. Local build (works today — after Method 4-B)

```bash
cd korean-law-alio-mcp
node build/cli.js "민법 제1조"                              # natural language → auto routing
node build/cli.js "○○진흥원 인사규정"                       # ALIO natural language
node build/cli.js "○○진흥원 인사규정 상위법"                # cross-domain (ALIO → Korean Law)
node build/cli.js "근로기준법 따르는 공공기관 규정"          # cross-domain (reverse)
node build/cli.js search_law --query "관세법"               # direct tool call
node build/cli.js list                                      # all 110 tools
node build/cli.js list --category ALIO                      # filter (ALIO/판례/법령검색/etc.)
node build/cli.js help search_law                           # per-tool help
node build/cli.js                                           # REPL (interactive)
```

> ALIO tools work **straight from the user's natural-language question** — no per-deployment configuration of comparison targets. The user can say "compare A·B·C", "pick 5 random", or just give a topic, and the LLM calls the right tool.

### API Key Channels — Summary

Multiple channels available. Higher in the table = higher priority:

| Channel | Usage | Recommended for |
|---------|-------|-----------------|
| URL query | `?oc=your-key` | Methods 2 & 3 (web/desktop URL) — easiest |
| HTTP header | `apikey: your-key` (also `x-api-key`, `Authorization: Bearer your-key`) | Programmatic integration |
| Environment | `LAW_OC=your-key` | Methods 4 & 5 (local) |
| Tool argument | `apiKey: "your-key"` | Per-call key override |

> **For users with IP/domain registration enabled on their key**: to use Methods 2 & 3 (remote), add `korean-law-alio-mcp.fly.dev` to your whitelist at [open.law.go.kr/LSO/openApi/userMypage.do](https://open.law.go.kr/LSO/openApi/userMypage.do). Users without IP/domain registration (default) need no extra setup — works immediately.

---

## 💬 Examples (natural language)

> ⓘ The `○○ Agency` / `○○진흥원` / `C0xxx` placeholders below should be replaced with the actual institution name or apbaId you want to query (e.g. `KISA`, `Korea Electric Power Corp`). Look up canonical names in `data/alio/institutions.json` or via the `search_institution` tool.

### Korean-Law tools (87 — upstream)

```
"민법 제1조 알려줘"                        → search_law + get_law_text auto-chain
"음주운전 처벌 기준"                       → comprehensive research (chain_full_research)
"관세법 3단비교"                           → 3-tier (Act → Decree → Rules) delegation analysis
"건축허가 거부 판례"                       → search_precedents
"근로기준법 제74조 해석례"                 → search_interpretations
"종로구 주차 조례"                         → search_ordinance (local ordinance)
"여권발급 절차 수수료"                     → chain_procedure_detail
```

For richer scenarios, see [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md).

### ALIO public-institution tools (23 — new in this fork)

```
"○○진흥원 인사규정"                        → list_alio_regulations (canonical-name auto lookup)
"공공기관 휴직 규정 비교해줘"                → compare_alio_regulations (auto across all collected)
"○○진흥원 규정 체계 요약"                  → get_alio_institution_profile
"우리 기관에 없는 동종 기관 규정"            → suggest_alio_benchmark
"최근 3개월 내 인사 규정 바뀐 기관?"         → get_recent_alio_revisions
"C0xxx 와 비슷한 직제규정 다른 기관에"       → find_similar_regulations
"ALIO에 어떤 데이터가 있어?"                 → get_alio_statistics
```

### Cross-domain bridges (new in this fork — ALIO ↔ Korean Law)

Public-institution internal regulations inherently delegate from / cite upper national laws. Natural-language queries that bridge the two domains route automatically — without the user knowing tool names:

```
"○○진흥원 인사규정 상위법"                  → analyze_regulation_delegation
                                             (extracts cited laws from body + auto-calls search_law)
"○○진흥원 인사규정 위임 분석"               → analyze_regulation_delegation
"근로기준법 따르는 공공기관 규정"            → find_regulations_by_upper_law
                                             (Korean-Law statute → ALIO regulations citing it, reverse lookup)
"근로기준법 제74조 따르는 공공기관 규정"     → find_regulations_by_upper_law (article-scoped)
"○○진흥원 인사규정 인용 분석"               → parse_alio_article_links (intra-doc citation graph)
```

Full reference for 23 ALIO tools + 3 cross-domain bridges: [`docs/API.md`](./docs/API.md) or [`ROADMAP.md`](./ROADMAP.md).

---

## 🔧 Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `LAW_OC` | ✅ | Korean Law portal API ID |
| `ALIO_DATA_DIR` | ❌ | Override `data/alio/` path |
| `ALIO_INSTITUTION_ALIASES` | ❌ | NL routing aliases (JSON, e.g. `{"MYORG":"My Org"}`) |
| `DOCLING_*` | ❌ | OCR fallback engine/lang/device |

See [`.env.example`](./.env.example) for the full list with examples.

---

## 📚 Documentation

| Doc | Purpose |
|------|---------|
| [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md) | 📜 Upstream original README (English) — rich tool categories / chains |
| [`README.md`](./README.md) | Korean version of this fork |
| [`README-UPSTREAM.md`](./README-UPSTREAM.md) | 📜 Upstream original README (Korean) |
| [`CLAUDE.md`](./CLAUDE.md) | Code guide for AI assistants and contributors |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Contribution guide — PR checklist, license compatibility policy |
| [`ROADMAP.md`](./ROADMAP.md) | This fork's motivation, future plans, and acknowledgements |
| [`CHANGELOG.md`](./CHANGELOG.md) | Changes since fork |
| [`docs/API.md`](./docs/API.md) | 110-tool reference |
| [`TEST-REPORT.md`](./TEST-REPORT.md) | Comprehensive test results (168 cases ALL PASS) |
| [`LICENSE`](./LICENSE) | MIT (dual copyright: upstream + this fork) |
| [`NOTICE`](./NOTICE) | All dependency attributions |

---

## 🙏 Acknowledgements

This fork stands on the shoulders of:

- **[@chrisryugj](https://github.com/chrisryugj)** — author of [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) (the 87 Korean-Law tools) and [kordoc](https://github.com/chrisryugj/kordoc) (HWP/HWPX/PDF unified parser).
  **Without these two projects, this fork could not have started.** Sincere thanks.
- **jkg** — provided the core idea of integrating ALIO public-institution internal regulations.
- **Claude (Anthropic)** — assisted with code, review, and documentation throughout.

Full dependency attributions are in [`NOTICE`](./NOTICE); motivation in [`ROADMAP.md`](./ROADMAP.md).

---

## 📜 License

[MIT](./LICENSE) — dual copyright: upstream (Chris, 2025) + this fork (scvcoder, 2026).

All first-party code in this project is licensed under MIT only. No BSL or Source-Available code is bundled.
([Details on license-hygiene work](./CHANGELOG.md#security--license-hygiene))

---

## 📂 Notes — fork info

This project was **forked on 2026-04-25** from [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp).

- The original README is preserved as-is in [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md)
- Korean: [`README.md`](./README.md) · Original Korean README: [`README-UPSTREAM.md`](./README-UPSTREAM.md)

---

<sub>Maintained by <a href="https://github.com/scvcoder">scvcoder</a> · Forked from <a href="https://github.com/chrisryugj/korean-law-mcp">chrisryugj/korean-law-mcp</a> on 2026-04-25</sub>
