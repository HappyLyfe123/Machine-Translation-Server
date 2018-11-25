'use strict'

// Server main modules
const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const mongoose = require('mongoose');
const serverConfig = require('./config/server.json');
const dbConfig = require('./config/mongo.json');
const http = require('http');
const https = require('https');
const routes = require('./app/router');
const util = require('./app/helper/utilities');
const { fork } = require('child_process');
// Server routing modules
const express = require('express');
const bodyParser = require('body-parser');
// Server security modules
const helmet = require('helmet');

// Setup main processes
// Increase the number of listeners for the current process
require('events').EventEmitter.defaultMaxListeners = 20;

// Setup express
const router = routes(express.Router());
const httpApp = express();
const httpsApp = express();
httpsApp.use(bodyParser.urlencoded({limit: '5mb', extended: true }));
httpsApp.use(bodyParser.json({limit: '3mb', extended: true }));
httpsApp.use('/', router);

// Setup server security configurations
// Redirect HTTP connections to HTTPS
httpApp.get('*', function(req, res, next) {
    res.redirect('https://' + req.headers.host + req.originalUrl);
});
// Setup HSTS
httpsApp.use(helmet.hsts({
    maxAge : serverConfig.hstsTimeLimit,
    includeSubdomains : true,
    force : true
}));

// Setup HTTP and HTTPS listeners
http.createServer(httpApp).listen(serverConfig.httpPort, () =>{
    util.log(`HTTP Listening on Port ${serverConfig.httpPort}`)
});
https.createServer({
    key: fs.readFileSync(serverConfig.privKeyPath),
    cert: fs.readFileSync(serverConfig.fullchainPath),
    ciphers: serverConfig.cipherKey
}, httpsApp).listen(serverConfig.httpsPort, () => {
    util.log(`HTTPS Listening on Port ${serverConfig.httpsPort}`)
});

// Connect to mongo
mongoose.connect(dbConfig.url, {useNewUrlParser : true }, (err) => {
    if (err) {
        util.log(`Error in Mongoose Connect.\nError Message: ${err.message}`);
    } else {
        util.log('Successfully connected to Mongo');
    }
});

// The process for Monitoring
fork('monitor.js');

