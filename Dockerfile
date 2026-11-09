FROM node:24.20.0-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs engine.mjs content.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV BIND=0.0.0.0 PORT=4173 DB_PATH=/app/data/event.sqlite COOKIE_SECURE=1
EXPOSE 4173
CMD ["node","server.mjs"]
