FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node server ./server
COPY --chown=node:node demo-data/ka-a-activity.json ./demo-data/ka-a-activity.json
COPY --chown=node:node demo-data/runtime-state.example.json ./demo-data/runtime-state.example.json
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node", "server/start.mjs"]
