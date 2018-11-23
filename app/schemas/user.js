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
        User.findOne({'username' : username.toLowerCase()}).exec(async function(err, userDoc) {
            // Error Cases
            if (err) {
                util.log('Database error for authenticate');
                // Database error
                let err = new Error('Server error');
                err.code = constants.INTERNAL_SERVER_ERROR;
                reject(err);
                return;
            } else if (!userDoc) {
                util.log('User not found for authenticate');
                // Invalid User error
                let err = new Error('User not found');
                err.code = constants.NOT_FOUND;
                reject(err);
                return;
            }

            // User exists, check if the password given by the user is valid
            let result = await bcrypt.compare(password, userDoc.password)

            // Passwords match, send the user their access and refresh tokens
            if (result === true) {
                util.log('Passwords match for user login attempt');
                const sec = require('../helper/security');

                // Generate the refresh and acces tokens for the user
                let accessToken = sec.generateToken(sec.Token.ACCESS);
                let refreshToken = sec.generateToken(sec.Token.REFRESH);

                // Update the user object
                User.updateOne({'username' : userDoc.username} , {
                    $set: {
                        'accessToken' : accessToken,
                        'refreshToken' : refreshToken
                    }
                }).exec().then((result) => {
                    util.log('Successfully saved user tokens');
                    // Return the access and refresh tokens
                    resolve({
                        'accessToken' : accessToken,
                        'refreshToken' : refreshToken
                    });
                }).catch((err) => {
                    util.log('Error in saving user information in UserSchema.authenticate');
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
        'username' : username.toLowerCase(),
        'password' : passwordHash,
        'accessToken' : accessToken,
        'refreshToken' : refreshToken,
        'isAdmin' : isAdmin,
        annotations : []
    };

    // Attempts to create the new user
    return User.create(newUser);
}

const User = mongoose.model('User', UserSchema);
module.exports = User;