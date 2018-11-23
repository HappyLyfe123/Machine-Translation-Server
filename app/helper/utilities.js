'use strict'

// Modules
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const serverConfig = require('../../config/server.json');
const constants = require('./constants');

// Initialize Winston Module
const printFormat = printf(info => {
    return `${info.timestamp} [${info.label}] \n${info.level}: ${info.message}`;
  });
const logger = createLogger({
    level: 'info',
    format: combine(
        label({ label: 'Runtime Debug'}),
        timestamp(),
        printFormat
    ),
    transports: [new transports.Console()]
});

// Log messages to the console
function log(message) {
    logger.info(message);
}

// Authenticates applications
function authenticateApp(clientId) {
    return new Promise((resolve, reject) => {
        let err = null;

        if (!clientId) {
            log('Error in Create User.\nClient missing client ID');
            err = new Error('Request must contain a client Id');
            err.code = constants.BAD_REQUEST;
        } else if(serverConfig.clientId !== clientId) {
            log('Error in Create User.\nWrong client ID value');
            err = new Error('Unauthorized client request');
            err.code= constants.UNAUTHORIZED;
        }

        if (err) {
            reject(err);
        } else {
            resolve(null);
        }
    })
}

// Generates a random number
function getRandomNumber(low, high) {
    return Math.floor(Math.random() * (high - low)) + low;
}

// Strips a string of its capitalizations and punctuations
function strip(text) {
    return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
}

// Evaluates a string into a boolean value
function evalBoolean(string) {
    return (string.toLowerCase() === 'true');
}

module.exports = {
    log,
    strip,
    evalBoolean,
    getRandomNumber,
    authenticateApp
}