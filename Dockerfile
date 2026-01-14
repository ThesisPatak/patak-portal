FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the React frontend with Vite
RUN npm run build

# Production stage - serve the built frontend and run the server
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Copy server code
COPY server ./server

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./public

EXPOSE 8080
CMD ["node", "server/index.js"]

