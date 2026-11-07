FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

EXPOSE 4000
CMD ["node", "dist/index.js"]
