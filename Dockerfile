# syntax=docker/dockerfile:1

# --- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage -----------------------------------------------------------
# Statyczna aplikacja SPA: cała konwersja działa w przeglądarce użytkownika,
# serwer tylko dostarcza pliki HTML/JS/CSS. Nie ma backendu ani bazy danych.
# Obraz "unprivileged" nasłuchuje na porcie 8080 i działa jako użytkownik
# bez uprawnień roota.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
