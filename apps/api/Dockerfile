FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/worker/package*.json ./apps/worker/
COPY packages/db/package*.json ./packages/db/
COPY packages/youtube/package*.json ./packages/youtube/
COPY packages/queue/package*.json ./packages/queue/
COPY packages/typescript-config/package*.json ./packages/typescript-config/

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--workspace=@youtube-sync/api"]
