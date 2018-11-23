# Parent image
FROM node:10

# Main Work Directory
WORKDIR /server

# Commands to run to initialize the container
RUN apt update; apt upgrade;
RUN apt install 

# Expose a port from the container for communication with client
EXPOSE 80/tcp
EXPOSE 443/tcp
EXPOSE 3000/tcp
EXPOSE 8000/tcp

# Expose a port from the container for communication
EXPOSE 9000/udp