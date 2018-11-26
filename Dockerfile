# Parent image
FROM node:8

# Main Work Directory
WORKDIR /server


# Install application dependencies
COPY package*.json ./
RUN npm install

# Copy the application Code
COPY . .

# Expose a port from the container for communication with client
EXPOSE 80/tcp
EXPOSE 443/tcp
EXPOSE 30000/udp

# Run script for node process
RUN sudo npm start