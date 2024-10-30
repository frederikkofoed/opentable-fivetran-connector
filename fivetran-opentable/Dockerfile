# Use the official Node.js 14 image as a parent image
FROM node:14-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy local code to the container image
COPY . .

# Set the Cloud Run environment variable
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Run the web service on container startup
CMD [ "node", "index.js" ]