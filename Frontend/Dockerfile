# Dockerfile to run the Next.js project in a development environment

# Use a Node.js base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install ngrok (v3) binary in this image
RUN apk add --no-cache curl tar && \
    ARCH="$(uname -m)" && \
    case "$ARCH" in \
      x86_64) NGROK_ARCH="amd64" ;; \
      aarch64|arm64) NGROK_ARCH="arm64" ;; \
      *) echo "Unsupported architecture for ngrok: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${NGROK_ARCH}.tgz" -o /tmp/ngrok.tgz && \
    tar -xzf /tmp/ngrok.tgz -C /usr/local/bin && \
    chmod +x /usr/local/bin/ngrok && \
    rm -f /tmp/ngrok.tgz

# Copy package.json and package-lock.json to leverage Docker cache
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Startup script runs ngrok (if token provided) and then starts Next dev server
COPY docker/start-with-ngrok.sh /usr/local/bin/start-with-ngrok.sh
RUN chmod +x /usr/local/bin/start-with-ngrok.sh

# Expose the port the app runs on (from package.json dev script)
EXPOSE 9002
EXPOSE 4040

# Command to run frontend + ngrok tunnel
CMD ["/usr/local/bin/start-with-ngrok.sh"]
