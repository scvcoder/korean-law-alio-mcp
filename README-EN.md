# Korean Law ALIO MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tools: 110](https://img.shields.io/badge/MCP%20Tools-110-blue.svg)](./docs/API.md)
[![ALIO Coverage: 35,000+](https://img.shields.io/badge/ALIO%20Regulations-35%2C000%2B-green.svg)](#-what-this-fork-adds-vs-upstream-v22)

---

An MCP for searching, comparing, and analyzing Korean national law (법제처) and the internal regulations of public institutions (ALIO).

110 MCP tools — 87 Korean Law portal + 23 ALIO public-institution regulations — perform the analysis.

Searches and compares 1,600 active laws, 10,000 administrative rules, tens of thousands of court precedents, and 35,000 internal regulations across 344 public institutions, then feeds the results to your AI assistant for higher-quality answers.

This project is forked and derived from [chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp).

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

> **Recommended: leave the IP/domain registration field empty** when applying — keys without IP registration work from anywhere (local & remote). If you do register IPs/domains, the key only works from those — and remote methods (2 & 3) will require you to add `korean-law-alio-mcp.fly.dev` to your whitelist.

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
"Show me Article 74 of the Labor Standards Act"        → Korean Law (87 tools)
"Show ○○ Agency's HR regulations"                      → ALIO (23 tools)
"What upper laws does ○○ Agency's HR rule cite?"       → regulation → law linkage
"Public-institution rules following the Labor Std Act" → law → regulation reverse lookup
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

> **The data mirror is best-effort** — the Releases `tag` is the snapshot date; the `fetchedAt` field inside `manifest.json` gives the exact timestamp. For time-sensitive use, run `npm run alio:sync` to refresh from source. Any harm caused by snapshot drift is the user's responsibility. Full responsibility allocation: [`NOTICE`](./NOTICE).

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

> Before npm publish — to use right now, follow [Method 4-B](#4-b-manual-install-works-today)'s git clone + build, then replace `korean-law-alio` above with `node build/cli.js`.
>
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

## Examples

> The `OO Agency` / `OO Corporation` placeholders below are anonymized — replace with the actual institution name you want to query.

### Korean-Law tools — laws · precedents · interpretations (87 from upstream)

```
"민법 제1조 알려줘"
→ The AI searches for the law and auto-fetches the article

"음주운전 처벌 기준"
→ The AI auto-combines relevant statutes + precedents + interpretations

"관세법 3단비교"
→ The AI auto-analyzes the Act → Decree → Rules delegation structure

"근로기준법 제74조 해석례"
→ The AI auto-matches the article + government interpretations

"종로구 주차 조례"
→ The AI searches local ordinances
```

For richer scenarios, see [`README-EN-UPSTREAM.md`](./README-EN-UPSTREAM.md).

### ALIO public-institution tools (23 new in this fork)

```
"OO Agency's HR regulations"
→ The AI auto-matches the canonical institution name → returns its regulation list

"Compare leave-of-absence rules across public institutions"
→ The AI auto-compares leave-related regulations across all collected institutions

"Rules that peer institutions have but ours doesn't"
→ The AI auto-extracts benchmarking candidates (peers' rules − ours)

"Which institutions changed HR rules in the last 3 months?"
→ The AI auto-sorts recent revision history

"What's in the ALIO data?"
→ The AI auto-summarizes statistics across the collected dataset
```

### Tools linking the two areas (3 new in this fork)

Public-institution internal regulations inherently delegate from / cite upper national laws. Natural-language queries that span both areas are handled automatically:

```
"Show me the upper laws related to OO Agency's HR regulations"
→ The AI auto-extracts cited upper laws from the regulation body
   + Looks up each law's information at the Korean Law portal

"Check whether OO Corporation's OOO directive complies with the Labor Standards Act"
→ The AI reverse-searches citations of the law across 35,000 public-institution regulations
   → Returns matched directives' citation context + per-institution grouping
```

Full 110-tool reference: [`docs/API.md`](./docs/API.md). Motivation & roadmap: [`ROADMAP.md`](./ROADMAP.md).

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

## Acknowledgements

This project was made possible thanks to:

- chrisryugj — without the [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) and [kordoc](https://github.com/chrisryugj/kordoc) projects, this project could not have started. Sincere thanks.
- jkg — thank you for the idea of integrating ALIO public-institution internal regulations.

---

## License

[MIT](./LICENSE)

---

<sub>Made by <a href="https://github.com/scvcoder">scvcoder</a></sub>
