'use strict'

// Server Modules
const util = require('./app/helper/utilities');
const serverConfig = require('./config/server.json');
const textUtil = require('util');
// Network Modules
const dgram = require('dgram');
const ipc = require('node-ipc');
// IPC and UDP server variables
const allowedMonitorAddressList = new Set();
const monitoringApplications = new Set();

util.log('Initializing Server Monitoring');

// Initialize process methods for monitoring sockets that communicate with an application
const monitoringSocket = dgram.createSocket('udp4');
monitoringSocket.on('listening', ()=>{
    util.log(`Monitoring online on port ${serverConfig.monitorPort}`);
});
monitoringSocket.on('message', (msg, rinfo)=>{
    let senderSocket = `${rinfo.address}:${rinfo.port}`;
    util.log(`Monitoring received a message from ${senderSocket}`);
    // A close message from a port
    if(msg == 'close') {
        util.log(`Removing sender socket: ${senderSocket} to listening monitors monitors`);
        monitoringApplications.delete(senderSocket);
    } else if(msg == 'connect') {
        // Only add android udp connections if they are authorized,
        // otherwise, do nothing
        if(allowedMonitorAddressList.has(rinfo.address)){
            util.log(`Adding sender socket: ${senderSocket} to listening monitors`);
            monitoringApplications.add(senderSocket);   
        }
    }
});
// Create the socket with the specified port
monitoringSocket.bind(serverConfig.monitorPort);

// Initialize process methods for interprocess communication
ipc.config.id = 'MonitorServer';
ipc.config.retry = 3000;
// Create the IPC server
ipc.serve(()=>{
    // Once created, setup ipc methods
    // When the ipc server receives a message
    ipc.server.on('message', (data, socket)=>{
        util.log('Sending annotations to monitors');
        
        // The amount of bytes we are sending
        // Create an encoder object
        const encoder = new textUtil.TextEncoder();
        let byteCount = encoder.encode(data).length;
        util.log(`Sending ${byteCount} bytes to monitors`);

        // Send message to the listening applications
        let setIter = monitoringApplications.values();
        while(true) {
            let socket = setIter.next().value;
            if(!socket) {
                break;
            }
            socket = socket.split(":");
            monitoringSocket.send(data, 0, byteCount, 
            socket[1], socket[0], (err, bytes) => {
                if(err) throw err;
            });
        }
    });
    // When the IPC server receives a message of an authorized client
    ipc.server.on('accessAddress', (data, socket) => {
        data = data.split(':')[3];
        ipc.log(`Adding ${data} to the list of allowed monitoring addresses`);
        allowedMonitorAddressList.add(data);
    });
})
// Begin the server
ipc.server.start();