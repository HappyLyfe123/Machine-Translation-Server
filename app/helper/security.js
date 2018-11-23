'use strict'

// Modules
const serverConfig = require('../../config/server.json');
const util = require('./utilities');
const uuid = require('uuid/v4');
const constants = require('./constants');
const crypto = require('crypto');
const User = require('../schemas/user');
const moment = require('moment');

// File public constants
const Token = {
    ACCESS : 0,
    REFRESH : 1
}

// Authenticates applications
function authenticateApp(clientId) {
    return new Promise((resolve, reject) => {
        let err = null;

        if (!clientId) {
            util.log('Error in Create User.\nClient missing client ID');
            err = new Error('Request must contain a client Id');
            err.code = constants.BAD_REQUEST;
        } else if(serverConfig.clientId !== clientId) {
            util.log('Error in Create User.\nWrong client ID value');
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

// Generate Access Token
function generateToken(type) {
    // Valid password, return a new access token and refresh token object
    let token = uuid();
    let currTime = new Date();

    if (type === Token.ACCESS) {
        util.log('Generating Access token');
        // Expiration for Access Token = Current Time + 15 minutes
        var expiration = moment(currTime).add(15, 'm').toDate();
    } else if(type === Token.REFRESH) {
        util.log('Generating Refresh token');
        // Expiration for Refresh Token = Current Time + 4 Hours
        var expiration = moment(currTime).add(4, 'h').toDate();
    } else {
        let err = new Error('Paramereter must be of type security.Token');
        err.code = constants.INTERNAL_SERVER_ERROR;
        throw err;
    }

    return {
        'token' : token,
        'expiration' : expiration
    };
}

// Hashes a data string
function hash(dataString) {
    const hashFunc = crypto.createHash('sha256');
    hashFunc.update(dataString);
    return hashFunc.digest('hex');
}

// Authorizes whether a user has access to the current resources
function authorizeUser(username, accessToken) {
    return new Promise((resolve, reject) => {
        if (!username || !accessToken) {
            let err = new Error('Request must contain both username and access token');
            err.code = constants.BAD_REQUEST;
            reject(err);
            return;
        }

        // Querying user
        util.log('Querying user from authorizeUser in security');

        // Try to find a user with the given username
        User.findOne({'username' : username.toLowerCase()}).exec().then((userDoc) => {
            // User was not found
            if (!userDoc) {
                let err = new Error('Invalid user');
                err.code = constants.UNAUTHORIZED;
                reject(err);
                return;
            }

            // Retrieve the access token and check
            // Invalid token has been passed by the user
            if (userDoc.accessToken.token !== accessToken) {
                let err = new Error('Invalid user access token');
                err.code = constants.UNAUTHORIZED;
                reject(err);
                return;
            }

            // If the tokens match, then make sure that the expiration
            // time for the token has not expired
            let expiration = userDoc.accessToken.expiration;
            if (moment().isAfter(expiration)) {
                let err = new Error('Token has expired');
                err.code = constants.NOT_ACCEPTABLE;
                reject(err);
                return;
            }

            // If the tokens match and the expiration time for 
            // the token hasn't expired, return the userDoc and continue
            resolve(userDoc);

        }).catch((err)=> {
            util.log(`Error in authorizeUser method in security.js.\nError Message: ${err.message}`);
            err.message = 'Server Error';
            err.code = constants.INTERNAL_SERVER_ERROR;
            reject(err);
        });
    });
}

// Generates a new access token given a refresh token
function renewToken(username, refreshToken) {
    let newAccessToken = null;
    return new Promise((resolve, reject) => {
        // Request missing username or refresh token
        if(!username || !refreshToken) {
            let err = new Error('Request must contain both username and refresh token');
            err.code = constants.BAD_REQUEST;
            reject(err);
            return;
        }
        username = username.toLowerCase();
        
        User.findOne({'username' : username}).exec().then((userDoc) =>{
            // There is no user with the specified username
            if(!userDoc) {
                let err = new Error('Invalid user');
                err.code = constants.UNAUTHORIZED;
                reject(err);
                return;
            }

            // Check whether the refresh tokens match
            if(userDoc.refreshToken.token !== refreshToken) {
                let err = new Error('Invalid refresh token');
                err.code = constants.UNAUTHORIZED;
                reject(err);
                return;
            }

            // Check whether the refresh token has expired
            if(moment().isAfter(userDoc.refreshToken.expiration)) {
                let err = new Error('Refresh token is expired.');
                err.code = constants.NOT_ACCEPTABLE;
                reject(err);
                return;
            }

            // If the request has passed all of the above checks, generate
            // a new refresh token and update the user's document
            newAccessToken = generateToken(Token.ACCESS);

            return User.where({'username' : username}).updateOne({
                $set : {
                    'accessToken' : newAccessToken
                }
            }).exec();
        }).then((result) => {
            if(!result) {
                throw new Error('Server Error for updating user information in renewToken');
            }

            // Return the new token value
            resolve(newAccessToken);
        }).catch((err) => {
            util.log(`Error in renewToken method in security.js\nError Message: ${err.message}`);
            err.code = constants.INTERNAL_SERVER_ERROR;
            reject(err);
        });
    });
}

module.exports = {
    Token,
    authorizeUser,
    authenticateApp,
    generateToken,
    renewToken,
    hash
}