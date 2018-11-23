'use strict'

// Retrieve modules
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const constants = require('../helper/constants');
const util = require('../helper/utilities');

// The user schema
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        unique : true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    accessToken :{
        token: String,
        expiration: Date
    },
    refreshToken : {
        token: String,
        expiration : Date
    },
    isAdmin : {
        type : Boolean,
        required : true
    },
    annotations : {
        type : Map,
        of: Map
    }
});

UserSchema.statics.authenticate = function(username, password) {
    return new Promise((resolve, reject) => {
        // Attempt to find a user with the given username
        User.findOne({'username' : username}).exec(async function(err, user) {
            // Error Cases
            if (err) {
                util.log('Database error for authenticate');
                // Database error
                let err = new Error('Server error');
                err.status = constants.INTERNAL_SERVER_ERROR;
                reject(err);
                return;
            } else if (!user) {
                util.log('User not found for authenticate');
                // Invalid User error
                let err = new Error('User not found');
                err.status = constants.NOT_FOUND;
                reject(err);
                return;
            }

            // User exists, check if the password given by the user is valid
            let result = await bcrypt.compare(password, user.password)

            // Passwords match, send the user their access and refresh tokens
            if (result === true) {
                util.log('Passwords match for user login attempt');
                const sec = require('../helper/security');

                let accessToken = sec.generateToken(sec.Token.ACCESS);
                // Valid password, return a new access token and refresh token object
                user.accessToken.token = accessToken.token;
                // Expiration for Access Token = Current Time + 30 minutes
                user.accessToken.expiration = accessToken.expiration;

                let refreshToken = sec.generateToken(sec.Token.REFRESH);
                // The refresh token
                user.refreshToken.token = refreshToken.token;
                // Expiration for Refresh Token = Current Time + 12 Hours
                user.refreshToken.expiration = refreshToken.expiration;

                // Save the user object
                user.save().then((savedUser) => {
                    util.log('Successfully saved user tokens');
                    resolve(savedUser);
                }).catch((err) => {
                    util.log('Error in saving user information for in UserSchema.authenticate');
                    reject(err);
                });
            } else {
                let err = new Error('Username and Password combination not found');
                err.code = constants.UNAUTHORIZED;
                reject(err);
                return;
            }
        });
    });
}

// Creates a new user
UserSchema.statics.createUser = async function(username, password, isAdmin) {
    // Hash the password
    let passwordHash = await bcrypt.hash(password, 10);
    const sec = require('../helper/security');

    // Create token objects
    let accessToken = sec.generateToken(sec.Token.ACCESS);
    let refreshToken = sec.generateToken(sec.Token.REFRESH);

    // Create a user object
    let newUser = {
        'username' : username,
        'password' : passwordHash,
        'accessToken' : {
            'token' : accessToken.token,
            'expiration' : accessToken.expiration
        },
        'refreshToken' : {
            'token' : refreshToken.token,
            'expiration' : refreshToken.expiration
        },
        'isAdmin' : isAdmin,
        annotations : []
    };

    // Attempts to create the new user
    return User.create(newUser);
}

const User = mongoose.model('User', UserSchema);
module.exports = User;