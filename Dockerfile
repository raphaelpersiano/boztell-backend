# syntax=docker/dockerfile:1
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install prod deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev

COPY ./src ./src

EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
