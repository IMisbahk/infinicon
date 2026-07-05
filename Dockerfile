FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY src ./src
RUN bun install --frozen-lockfile && bun run build:server

FROM oven/bun:1.3-slim
WORKDIR /app
COPY --from=build /app/packages/server/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "dist/server.js"]
