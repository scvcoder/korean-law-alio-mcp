# Korean Law ALIO MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tools: 110](https://img.shields.io/badge/MCP%20Tools-110-blue.svg)](./docs/API.md)
[![ALIO Coverage: 35,000+](https://img.shields.io/badge/ALIO%20Regulations-35%2C000%2B-green.svg)](#-what-this-fork-adds-vs-upstream-v22)

---

An MCP for searching, comparing, and analyzing Korean national law (법제처) and the internal regulations of public institutions (ALIO).

110 MCP tools — 87 Korean Law portal + 23 ALIO public-institution regulations — perform the analysis.

Searches and compares 1,600 active laws, 10,000 administrative rules, tens of thousands of court precedents, and 35,000 internal regulations across 344 public institutions, then feeds the results to your AI assistant for higher-quality answers.

This project is derived from [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp).

![Korean Law ALIO MCP demo](./demo.png)

---

## Why this was built

Thanks to [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp), accessing Korea's national law has become much easier and supports public-sector work daily. Sincere thanks again to [chrisryugj](https://github.com/chrisryugj).

We believed that combining national laws with public-institution internal regulations would multiply the value. This fork was therefore developed using regulation data from [ALIO](https://alio.go.kr/).

May this help those who find legal access difficult, and the public-institution staff across the country who struggle with internal regulation management.

---

## v1.0.0 — Bridging Public-Institution Regulations with Korean National Law

On top of the upstream's 87 Korean-Law tools, this fork adds **23 ALIO public-institution tools + 3 tools that link the two areas** — 110 tools that search, compare, and analyze 1.27 GB of data (Korean Law portal + 35,000 public-institution internal regulations) through natural language.

### What this fork adds

- **23 ALIO tools** — integrates 35,000 internal regulations from 344 Korean public institutions (HWP/HWPX/PDF/XLSX auto-converted via the kordoc unified parser; on-demand disk reads)
- **3 tools that link public-institution regulations with Korean national laws**
  - Auto-extracts upper laws cited in a public-institution regulation's body and looks up each law's identifier at the Korean Law portal
  - Given a Korean Law portal statute, reverse-looks up the public-institution regulations across the country that cite it
  - Analyzes how articles within a single regulation cite/refer to one another
- **Natural-language routing** — canonical institution-name auto lookup (synchronous load of `institutions.json`), automatic branching across both areas
- **Clear API auth-failure guidance** — unified across 12 fetch sites; when IP/domain whitelisting blocks the request, the user is pointed to the registration page
- **Setup wizard** — `npx korean-law-alio-mcp setup` (API key → operating mode → multi-client selection → config auto-registration)
- **fly.io remote deployment** — `https://korean-law-alio-mcp.fly.dev` (110 tools + ALIO data mirror, best-effort refresh)
- **CLI surface polish** — `list`/`help`/`--category`/`explain`/REPL + bare-query natural language
- **168-case test suite** — build 6 + router 13 + cli 23 + alio 39 + law 87 (`npm test`)
- **License hygiene** — 4 files clean-room rewritten, zero BSL/Source-Available code

### Example — natural-language queries that span both areas

```
"Show me the upper laws related to ○○ Agency's HR regulations"
```

→ Given the natural-language query, the AI automatically:

- Analyzes the institution's HR regulation body and extracts cited upper laws
- Looks up each cited law's identifier at the Korean Law portal and attaches it
- Also matches internal upper regulations from the same institution

Example outcome:

> "Found about 10+ upper-law citations in the HR regulation body (e.g., general HR/labor laws, occupational safety laws, gender-equality laws, etc.). Identifiers are attached for follow-up lookups. An internal upper regulation from the same institution was also matched."

```
"Check whether ○○ Corporation's OOO directive complies with the Labor Standards Act"
```

→ Given the natural-language query, the AI automatically:

- Reverse-searches citations of the given law (e.g., the Labor Standards Act) across 35,000 public-institution regulations
- Compiles citation context (which article cites which clause, and how) for each matched directive
- Groups results per institution

Example outcome:

> "Citation cases of the law were detected across multiple institutions' directives. By comparing how each directive cites which clauses, the user can assess their own institution's compliance level."

**Trace upper laws from public-institution rules in one shot — for compliance review, audits, and policy analysis.**

---

## Installation & Usage

### Step 0: Get an API Key (free, 1 minute)

All methods share one prerequisite — a **Korean Law portal API key (OC)**:

1. Go to [open.law.go.kr](https://open.law.go.kr/LSO/openApi/guideResult.do)
2. Sign up & log in
3. Click "Open API 사용 신청" (apply for Open API access)
4. Submit the form → receive your **OC key** (email-ID format)

> All examples below use `your-api-key-here` as a placeholder — replace with your issued key. (Same convention as [`.env.example`](./.env.example))

### Method 1: Claude Code Plugin — One-line install Coming soon

> Marketplace registration is planned for the next release. For now, use Methods 2–5.

When activated:
```
/plugin marketplace add scvcoder/korean-law-alio-mcp
/plugin install korean-law-alio@korean-law-alio-marketplace
```

### Method 2: Use directly in Claude.ai web (no install) Easiest

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
"근로기준법 제74조 알려줘"                              → Korean Law (87 tools)
"○○진흥원 인사규정 알려줘"                              → ALIO (23 tools)
"○○진흥원 감사규정과 관련된 상위법령은 뭐니?"          → regulation → law linkage
"근로기준법과 OO공단의 인사규정의 관계는 어떻게 되니?"  → law → regulation reverse lookup
"공공기관 휴직 규정 비교해줘"                            → ALIO peer comparison
```

> ALIO data is periodically refreshed by the maintainer. Since ALIO does not provide an official API, real-time freshness is not guaranteed (periodic updates planned).

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

### Method 4: Install on Your Own Machine (offline-capable)

If you want to use it without an internet connection, or to avoid going through a remote server, you can install it directly.

**Prerequisite:** Node.js version 20 or higher.

**Automatic install (recommended):**

```bash
npx korean-law-alio-mcp setup
```

A setup wizard handles API key entry → AI client selection → config-file auto-registration in one go.
Supports Claude Desktop, Claude Code, Cursor, VS Code, and Windsurf.

**Manual install:**

```bash
npm install -g korean-law-alio-mcp
```

Add the following to your AI app's config file (replace `your-api-key-here` with your own key):

```json
{
  "mcpServers": {
    "korean-law-alio": {
      "command": "korean-law-alio-mcp",
      "env": {
        "LAW_OC": "your-api-key-here"
      }
    }
  }
}
```

**ALIO data preparation** — to use ALIO tools on your own PC, you need the data. Pick one of the two methods below.

#### (Option 1) Use the maintainer's mirror (5-15 min, recommended)

Download a pre-collected snapshot. ~200MB compressed → ~1.27GB after extraction.

**Mac, Linux:**
```bash
curl -L -o alio-data.tar.gz https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.tar.gz
tar -xzf alio-data.tar.gz -C data/
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri https://github.com/scvcoder/korean-law-alio-mcp/releases/latest/download/alio-data.zip -OutFile alio-data.zip
Expand-Archive -Path alio-data.zip -DestinationPath data\
```

#### (Option 2) Direct sync (6-12 hours)

Sync 35,000 regulations from 344 public institutions directly from ALIO. You stay on the latest data.

OS system tools recommended for converting some edge cases (scanned PDFs · HWP 3.0). Without them, common cases still work fine and only the edge cases are skipped.

> The HWP/HWPX/PDF unified parser (`kordoc`) is installed automatically with `npm install`. No separate setup needed; for cases kordoc cannot parse, `docling` · `tesseract` · `tesseract-lang` · `libreoffice` are used as additional parsers.

**macOS:**
```bash
brew install docling tesseract tesseract-lang libreoffice
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install tesseract-ocr tesseract-ocr-kor libreoffice
pip install docling
```

**Windows:**
Node.js alone is enough for sync to run (edge cases will be skipped).
If Node.js isn't installed, download the LTS (20 or higher) `.msi` from [nodejs.org](https://nodejs.org) and run the installer.

Once the parsing tools are installed, run the sync commands below.

Sync commands:
```bash
npm run alio:sync                   # All 344 institutions (6-12 hours)
npm run alio:sync -- --only C0xxx   # Single institution (apbaId 4-digit, minutes)
npm run alio:sync -- --resume       # Retry failed institutions only
```

Synced data lives in `data/alio/` (about 1.27 GB).

---

Restart the app — done!

### Method 5: Use from the terminal (CLI)

Developers can search Korean national law and public-institution regulations directly from the terminal.

```bash
# Install
npm install -g korean-law-alio-mcp

# Set the API key (replace your-api-key-here with your own key)
export LAW_OC=your-api-key-here     # Mac/Linux
set LAW_OC=your-api-key-here        # Windows CMD
$env:LAW_OC="your-api-key-here"    # Windows PowerShell

# Examples
korean-law-alio "민법 제1조"                                # Korean Law (natural language)
korean-law-alio "OO진흥원 인사규정"                         # ALIO (natural language)
korean-law-alio "OO진흥원 인사규정과 관련된 상위 법령"      # Cross-area linkage
korean-law-alio "공공기관 휴직 규정 비교해줘"                # ALIO peer comparison
korean-law-alio search_law --query "관세법"                 # Direct tool call
korean-law-alio list                                        # All 110 tools
korean-law-alio list --category ALIO                        # Filter by category
korean-law-alio help search_law                             # Per-tool help
korean-law-alio                                             # REPL (interactive)
```

> ALIO tools work **straight from the user's natural-language question** — no per-deployment configuration of comparison targets. The user can say "compare A·B·C", "pick 5 random", or just give a topic, and the LLM calls the right tool.

### API Key — How to pass it

You can pass the API key through any of the methods below. Earlier in the table = higher priority:

| Method | Usage | Use case |
|--------|-------|----------|
| In the URL | append `?oc=your-key` | Easiest for web clients |
| HTTP header | `apikey: your-key` | When integrating programmatically |
| Environment variable | `LAW_OC=your-key` | Local install (Methods 3, 4) |
| Tool parameter | `apiKey: "your-key"` | When a single request needs a different key |

---

## Examples

### Korean-Law tools — laws · precedents · interpretations

```
"민법 제1조 알려줘"
→ The AI searches for the law and auto-fetches the article

"음주운전 처벌 기준"
→ The AI auto-combines relevant statutes + precedents + interpretations

"근로기준법 제74조 해석례"
→ The AI auto-matches the article + government interpretations
```

### ALIO public-institution regulation tools

```
"OO Agency's HR regulations"
→ The AI auto-matches the canonical institution name → returns its regulation list

"Compare leave-of-absence rules across public institutions"
→ The AI auto-compares leave-related regulations across all collected institutions

"Rules that peer institutions have but ours doesn't"
→ The AI auto-extracts benchmarking candidates (peers' rules − ours)
```

### Tools that link the Korean Law portal with ALIO

Public-institution internal regulations inherently delegate from / cite upper national laws. Natural-language queries that span both areas are handled automatically:

```
"Show me the upper laws related to OO Agency's HR regulations"
→ The AI auto-extracts cited upper laws from the regulation body
   + Looks up each law's information at the Korean Law portal

"Check whether OO Corporation's OOO directive complies with the Labor Standards Act"
→ The AI reverse-searches citations of the law across 35,000 public-institution regulations
   → Returns matched directives' citation context + per-institution grouping
```

---

## Tool structure (110)

| Group | Count | Notes |
|-------|------:|-------|
| Laws · Admin rules · Local ordinances | 16 | search · get · compare · linkage |
| Precedents · Interpretations | 7 | Supreme Court · government interpretations |
| Committee decisions | 10 | Constitutional Court · FTC · PIPC · NLRC · ACR |
| Tax tribunal · Customs · Treaties · English law | 8 | per-domain decisions/originals |
| School rules · Public corps · Public institutions (Korean Law portal) | 6 | public/education |
| Annexes · structure · stats · history · term KB · misc | 24 | |
| Chain tools (auto-composition) | 8 | full research · law system · action basis · dispute · amendment · ordinance compare · procedure · doc review |
| Doc analysis · utils | 8 | article-number conversion, abbreviation dict, etc. |
| ALIO public-institution regulations | 22 | search · get · compare · benchmark · timeline · stats + 3 linkage tools |
| ALIO chain | 1 | institution benchmarking |
| **Total** | **110** | |

Per-tool details (names · parameters · examples) are in [`docs/API.md`](./docs/API.md).

---

## Highlights

- **110 integrated tools** — 87 Korean Law portal (upstream) + 23 ALIO public-institution (this fork)
- **Cross-area linkage** — auto-extract upper laws cited by a regulation + reverse lookup ALIO regulations from a national law + intra-document citation graph
- **Natural-language routing** — canonical institution-name auto-matching (across 344 collected institutions), automatic branching across both areas
- **MCP + CLI** — same tools usable from Claude Desktop · Cursor · Windsurf and from the terminal
- **Legal-domain specialization** — abbreviation auto-recognition, article-number conversion, delegation-structure visualization
- **Annex / form extraction** — HWPX · HWP · PDF · XLSX · DOCX auto-conversion (kordoc engine)
- **Clear API auth-failure guidance** — guides the user to the registration page when IP/domain whitelisting blocks the request
- **Remote + local modes** — instant `https://korean-law-alio-mcp.fly.dev` OR own-PC data (`npm run alio:sync`)
- **Setup wizard** — `npx korean-law-alio-mcp setup` (auto-registers with 5 client types)
- **Verified** — 168 automated test cases (`npm test` — build · router · CLI · ALIO · Korean Law)
- **License hygiene** — single MIT license, zero BSL/Source-Available code

---

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `LAW_OC` | ✅ | Korean Law portal Open API key |

See [`.env.example`](./.env.example) for the full list with examples.

---

## Documentation

| Doc | Purpose |
|------|---------|
| [`README-EN.md`](./README-EN.md) | English README (this document) |
| [`README.md`](./README.md) | Korean README |
| [`docs/API.md`](./docs/API.md) | 110-tool reference |
| [`LICENSE`](./LICENSE) | MIT |
| [`NOTICE`](./NOTICE) | Sources and licenses of external libraries and data used |

---

## Acknowledgements

This project was made possible thanks to:

- chrisryugj — without the [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) and [kordoc](https://github.com/chrisryugj/kordoc) projects, this project could not have started. Sincere thanks.
- jkg — thank you for the idea of integrating ALIO public-institution internal regulations.

---

## License

[MIT](./LICENSE)

---

<sub>Made by <a href="https://github.com/scvcoder">scvcoder</a></sub>
