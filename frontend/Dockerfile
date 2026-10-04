# ANVESHAK frontend — React 19 + TypeScript + Vite.
#
# Runs Vite's own dev server rather than a build+static-serve stage. Rationale: this repo's
# CLAUDE.md says frontend/ is "the real app, build here now" — it is still under active
# development for the hackathon demo, so hot-reload matters more than a production-optimized
# static bundle. `--host 0.0.0.0` is required so the dev server (which binds to localhost only
# by default) is reachable from outside the container; this is passed as a CMD flag rather
# than edited into package.json's "dev" script, per this task's file-scope limits.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
