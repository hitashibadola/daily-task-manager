# Simple, lightweight Node.js image
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Cloud Run injects PORT - the app reads it via process.env.PORT
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
