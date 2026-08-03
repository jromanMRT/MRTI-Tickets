FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json tsconfig.node.json vite.config.ts ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview"]
