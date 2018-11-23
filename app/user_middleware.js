'use strict'

// Modules
const constants = require('./helper/constants');
const util = require('./helper/utilities');
const sec = require('./helper/security');
const User = require('./schemas/user');
const serverConfig = require('../config/server');

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
        if (req.body.applicationSecret === serverConfig.adminSecret) {
            var isAdminAccount = true;
        } else {
            var isAdminAccount = false;
        }

        return User.createUser(username, password, isAdminAccount);
    }).then((userDoc) => {
        util.log('User account created successfully!');
        return res.status(constants.CREATED).json({
            message : 'User account created successfully',
            accessToken : userDoc.accessToken,
            refreshToken : userDoc.refreshToken
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
            'message' : 'Successfull authentication',
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
    sec.authenticateApp(req.get('clientId')).then((result)=>{
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then((userDoc)=> {
        // If the user specifies a target user in their request, check if they 
        // are an admin
        if(req.get('targetUser')) {
            if(userDoc.isAdmin) {
                User.findOne({'username' : req.get('targetUser').toLowerCase()}).exec(function(userDoc) {
                    // The user specified by the admin account doesn't exist
                    if(!userDoc) {
                        util.log('User specified by admin account for annotation retrieval does not exist');
                        return res.status(constants.NOT_FOUND).json({message : 'User not found'});
                    } else {
                        return res.status(constants.OK).json({'annotations' : userDoc.annotations});
                    }
                });
            } else {
                let err = new Error('User must have admin credentials to retrieve data of other users');
                err.code = constants.UNAUTHORIZED;
                throw err;
            }
        } else {
            // Retrieve all of the annotations by the user
            return res.status(constants.OK).json({'annotations' : userDoc.annotations});
        }
    }).catch((err) => {
        util.log(`Error in retrieveUserAnnotations in user middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({message : err.message});
    });
}

module.exports = {
    createUser,
    loginUser,
    renewToken,
    retrieveUserAnnotations
}