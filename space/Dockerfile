# syntax=docker/dockerfile:1.7
# ===========================================================
# Imagen de SPACE para el SaaS: el tag v1.7.1 de SCORELabUS/space con los
# parches de `patches/`.
#
# No se usa la imagen publicada (ghcr.io/scorelabus/space-api:1.7.1) porque
# trae el fallo de renovación que corrige 0001: sin él, los límites de unidades
# por minuto, hora y mes solo se aplican en su primer periodo.
#
# Se construye desde el tag, comprobando el commit: un tag se puede mover, un
# commit no. Las dos etapas de compilación y ejecución son las del Dockerfile
# de release de SPACE (api/docker/release/Dockerfile).
# ===========================================================

FROM alpine:3.20 AS source
ARG SPACE_REF=v1.7.1
ARG SPACE_COMMIT=ef4dc8949435d998e2aff525226e3fcc85e2f7ba
RUN apk add --no-cache git
RUN git clone --depth 1 --branch "$SPACE_REF" https://github.com/SCORELabUS/space.git /src \
    && test "$(git -C /src rev-parse HEAD)" = "$SPACE_COMMIT"
COPY patches/ /patches/
# `git apply` se niega a aplicar un parche que no encaja: si el tag cambiara
# por debajo, la construcción falla aquí y no con un SPACE a medio parchear.
RUN cd /src && git apply --verbose /patches/*.patch

FROM node:21.1-slim AS build
WORKDIR /usr/src/server
RUN npm install -g pnpm@10.9.0
COPY --from=source /src/api/package.json /src/api/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --from=source /src/api/tsconfig.json ./
COPY --from=source /src/api/src/main ./src
RUN pnpm run build \
    && pnpm exec tsc-alias --project ./tsconfig.json --resolve-full-paths

FROM node:21.1-slim
WORKDIR /usr/src/server
ENV NODE_ENV=production
# node_modules conserva las dependencias de desarrollo a propósito, como en el
# Dockerfile de SPACE: la API importa algunas en ejecución (p. ej. dotenv).
COPY --from=build /usr/src/server/node_modules ./node_modules
COPY --from=build /usr/src/server/dist ./dist
COPY --from=build /usr/src/server/package.json ./
RUN mkdir -p public/static/pricings && chown -R node:node /usr/src/server/public
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
