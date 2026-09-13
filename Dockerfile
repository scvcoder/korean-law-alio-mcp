# Korean Law + ALIO MCP Server — Docker 배포용 (Mode B: ALIO 데이터 포함)
#
# 본 이미지 구성:
#   - 법제처 87개 도구: 외부 API 호출 (LAW_OC secret 필요)
#   - ALIO 38개 도구(내부규정 23 + 보고서형 15): data/alio/ 를 이미지에 굽기 (~2.4GB) — 원격에서 즉시 사용 가능
#     · manifest.json 은 메모리 인덱스로 로드 (~36MB → ~80-100MB heap)
#     · regulations/*.md 및 보고서형 3종(labor-agreements/wage-agreements/labor-council) MD 는 디스크에서 on-demand 읽기
#   - .dockerignore 가 secrets/.env/.git/dev artifact 모두 제외
#
# 데이터 업데이트 워크플로:
#   1. 로컬에서 `npm run alio:sync` 실행
#   2. `fly deploy` — Docker layer cache 가 unchanged 시 데이터 layer 재사용

# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json ./

RUN npm run build
RUN npm prune --production

# --- Runtime Stage ---
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ALIO 데이터 layer 먼저 (변경 빈도 낮음 → Docker layer cache 친화적)
# .dockerignore 가 sync-state.json / .DS_Store / *.raw.* / *.hwp* 모두 제외
COPY data ./data

# 앱 layer (변경 빈도 높음)
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "build/index.js", "--mode", "sse", "--port", "3000"]
