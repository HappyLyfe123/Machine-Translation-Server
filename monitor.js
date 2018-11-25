'use strict'

// Server Modules
const util = require('./app/helper/utilities');
const serverConfig = require('./config/server.json');
// Network Modules
const dgram = require('dgram');
const ipc = require('node-ipc');

// Process variables
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
    if(msg === 'close') {
        util.log(`Removing sender socket: ${senderSocket} from monitors`);
        monitoringApplications.delete(senderSocket);
    } else if(msg === 'connect') {
        util.log(`Adding sender socket: ${senderSocket} from monitors`);
        monitoringApplications.add(senderSocket);
    }
});
// Create the socket with the specified port
monitoringSocket.bind(serverConfig.monitorPort + 3000);

// Initialize process methods for interprocess communication
ipc.config.id = 'MonitorServer';
ipc.config.retry = 3000;
// Create the IPC server
ipc.serve(()=>{
    // Once created, setup ipc methods
    // When the ipc server receives a message
    ipc.server.on('message', (data, socket)=>{
        // Send message to the listening applications
        let setIter = monitoringApplications.values();
        while(true) {
            let socket = setIter.next().value;
            if(socket) {
                break;
            }
            socket = socket.split(":");
            monitoringSocket.send(data, 0, (new TextEncoder('utf-8').encode(data)).length, 
            socket[1], socket[0], (err, bytes) => {
                if(err) throw err;
            });
            
        }
    });
})
// Begin the server
ipc.server.start();