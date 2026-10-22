# Practical 11: Containerization with Docker
# Base Image: Lightweight Node 18 LTS on Alpine Linux
FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose API port
EXPOSE 5000

# Start Express server
CMD ["node", "server.js"]
