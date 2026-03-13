# Dockerfile to run the Next.js project in a development environment

# Use a Node.js base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (from package.json dev script)
EXPOSE 9002

# Command to run the app in development mode
CMD ["npm", "run", "dev"]