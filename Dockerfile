FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
WORKDIR /app
COPY --chown=node:node package.json server.mjs engine.mjs content.mjs command-checkpoint.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV BIND=0.0.0.0 PORT=4173 DB_PATH=/app/data/event.sqlite COOKIE_SECURE=1
EXPOSE 4173
CMD ["node","server.mjs"]
