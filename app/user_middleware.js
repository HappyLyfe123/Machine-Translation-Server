'use strict'

// Modules
const constants = require('./helper/constants');
const util = require('./helper/utilities');
const sec = require('./helper/security');
const User = require('./schemas/user');
const {hashPhrase , Source} = require('./schemas/source');
const serverConfig = require('../config/server');
const ipc = require('node-ipc');

// Creates a user
function createUser(req, res) {
    // Check the client id
    sec.authenticateApp(req.get('clientId')).then((resolve) => {
        // Successfully authenticated the user, attempt to create the
        // user in the database
        let username = req.body.username;
        let password = req.body.password;
        if(!username || !password) {
            let err = new Error('Create user request must contain username and password.');
            err.code = constants.BAD_REQUEST;
            throw err;
        }

        // Check whether the new user is creating an admin account
        if (req.body.applicationSecret) {
            if (req.body.applicationSecret !== serverConfig.adminSecret) {
                let err = new Error('Incorrect admin secret, cannot create admin account');
                err.code = constants.UNAUTHORIZED;
                throw err;
            } else {
                var isAdminAccount = true;
            }
        } else {
            var isAdminAccount = false;
        }

        return User.createUser(username, password, isAdminAccount);
    }).then((userDoc) => {
        if (userDoc.isAdmin) {
            util.log('Admin account created successfully');
        } else {
            util.log('User account created successfully!');
        }

        return res.status(constants.CREATED).json({
            'message' : 'User account created successfully',
            'username' : userDoc.username,
            'accessToken' : userDoc.accessToken,
            'refreshToken' : userDoc.refreshToken,
            'isAdmin' : userDoc.isAdmin
        });
    }).catch((err) => {
        // Error while attempting to create a user
        util.log(`Error in createUser in User Middleware.\nError Message ${err.message}`);
        // Duplicate key error
        if (err.code === constants.DUPLICATE_KEY) {
            err.code = constants.NOT_ACCEPTABLE;
            err.message = "Duplicate key, username must be unique";
        }
        return res.status(err.code).json({message : err.message});
    });
}

// Logs in a user
function loginUser(req, res) {
    // Authenticate whether the request came from a valid client
    sec.authenticateApp(req.get('clientId')).then((resolve) => {
        // Authenticate the user's information
        let username = req.get('username');
        let password = req.get('password');

        // Malformed client request
        if (!username || !password) {
            let err = new Error('Login request must contain username and password');
            err.code = constants.BAD_REQUEST;
            throw err;
        }
        // Authenticate the user information
        return User.authenticate(username, password);
    }).then((userDoc) => {
        util.log('User has been authenticated successfully');

        // Return the user their tokens
        return res.status(constants.ACCEPTED).json({
            'message' : 'Successful authentication',
            'username' : userDoc.username,
            'accessToken' : userDoc.accessToken,
            'refreshToken' : userDoc.refreshToken,
            'isAdmin' : userDoc.isAdmin
        });
    }).catch((err) => {
        // Error while attempting to create a user
        util.log(`Error in loginUser in User Middleware.\nError Message ${err.message}`);
        return res.status(err.code).json({message : err.message});
    })
}

// Renews an Access Token for the user given a refresh token
function renewToken(req, res) {
    sec.authenticateApp(req.get('clientId')).then((result) => {
        return sec.renewToken(req.body.username, req.body.refreshToken);
    }).then((newAccessToken)=>{
        util.log('Successfully returning new access token to user');
        return res.status(constants.ACCEPTED).json({ 'accessToken' : newAccessToken });
    }).catch((err) => {
        util.log(`Error in renewToken method in user middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({message : err.message });
    });
}

// Retrieves the User's annotations
function retrieveUserAnnotations(req, res) {
    let targetUserDoc = null;
    sec.authenticateApp(req.get('clientId')).then((result)=>{
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then(async (userDoc)=> {
        // If the user specifies a target user in their request, check if they 
        // are an admin, if they aren't an admin, then throw an error
        if(req.get('targetUser') && !userDoc.isAdmin) {
            let err = new Error('User must have admin credentials to retrieve data of other users');
            err.code = constants.UNAUTHORIZED;
            throw err;            
        } else if(req.get('targetUser')){
            // An admin account is attempting to retrieve another user's annotations
            userDoc = await User.findOne({'username' : req.get('targetUser').toLowerCase()}).exec();
            if (!userDoc) {
                let err = new Error('User specified by admin account does not exist');
                err.code = constants.NOT_FOUND;
                throw err;
            }
        }

        // Return the document in which to retrieve the annotations for
        return userDoc;
    }).then((userDoc) => {
        targetUserDoc = userDoc;
        // Get all of the hash values for all of the user annotations
        let hashValList = new Array();
        hashValList.push(...Array.from(targetUserDoc.annotations.keys()));

        // Do a query with the list of hash values
        return Source.find({
            'hash' : {
                $in : hashValList
            }
        }).select('hash phrase annotations').exec();
    }).then((sourceDocList) =>{
        let userAnnotationList = new Array();

        // Retrieve the language => hash values for the user
        sourceDocList.forEach((sourceItem) => {
            // The current hash value
            let currHashVal = sourceItem.hash;
            // The original english phrase of the hash value
            let originalPhrase = sourceItem.phrase;
            
            // A mapping of the user's annotations
            let annotationMap = {
                'phrase' : originalPhrase,
                'hash' : currHashVal,
                'list' : []
            };
            // Create a list of the languages the user annotated for the current hash
            targetUserDoc.annotations.get(currHashVal).forEach((value, language, anMap) => {
                // Retrieve the translation for the current hash in the current language
                let map = {};
                map.language = language;
                map.azureTranslation = sourceItem.annotations.get(language).azure.translation;
                map.isAzureCorrect = value.isAzureCorrect;
                map.googleTranslation = sourceItem.annotations.get(language).google.translation;
                map.isGoogleCorrect = value.isGoogleCorrect;
                map.yandexTranslation = sourceItem.annotations.get(language).yandex.translation;
                map.isYandexCorrect = value.isYandexCorrect;
                annotationMap.list.push(map);
            });
            // Append the newly created map to the user annotation list
            userAnnotationList.push(annotationMap);
        });
        return res.status(constants.OK).json({'annotations' : userAnnotationList});
    }).catch((err) => {
        util.log(`Error in retrieveUserAnnotations in user middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({message : err.message});
    });
}

// Authenticate the user and add them to a list of allowed monitors
function getMonitoringAccess(req, res) {
    sec.authenticateApp(req.get('clientId')).then((result)=>{
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then((userDoc)=>{
        // User is not authorized to be a monitor
        if(!userDoc.isAdmin) {
            let err = new Error('User must be admin');
            err.code = constants.UNAUTHORIZED;
            throw err;
        }

        // Send the IPC Message of the authorized user's ip address
        ipc.connectTo('MonitorServer', ()=> {
            // On connected, send the message
            ipc.of.MonitorServer.on('connect', ()=> {
                util.log('Sending access address to Monitoring IPC Server');
                ipc.of.MonitorServer.emit('accessAddress', req.ip);
                ipc.disconnect('MonitorServer');
            });
        });
        return res.status(constants.ACCEPTED).json({message : 'Authorized user for monitoring'});
    }).catch((err) => {
        util.log(`Error in getMonitoringAccess in user middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({message : err.message});
    });
}

module.exports = {
    createUser,
    loginUser,
    renewToken,
    getMonitoringAccess,
    retrieveUserAnnotations
}