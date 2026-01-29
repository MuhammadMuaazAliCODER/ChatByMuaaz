# Use Node LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy backend code
COPY . .

# Expose port (same as in your .env PORT)
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
