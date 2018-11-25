'use strict'

// Middlewares
const userMiddleware = require('./user_middleware');
const appMiddleware = require('./app_middleware');

function routing(router) {
    // Simple verification to see if the application is working
    router.route('/').get((req, res) => {
        res.json({message : 'Test connection.'});
    })

    // Creates a user
    router.route('/user').post((req, res) => {
        userMiddleware.createUser(req, res);
    });

    // Logs in a user
    router.route('/user').get((req, res) => {
        userMiddleware.loginUser(req, res);
    });

    // Retrieves a new access token for the user given a refresh token
    router.route('/user/token').put((req, res) =>{
        userMiddleware.renewToken(req, res);
    });

    // Retrieves all of a user's annotations only if they are the user
    // with the exception of an admin account
    router.route('/user/annotations').get((req, res) =>{
        userMiddleware.retrieveUserAnnotations(req, res);
    });

    // Authenticates and authorizes whether a user is allowed monitoring access
    router.route('/user/monitor').get((req, res) => {
        userMiddleware.getMonitoringAccess(req, res);
    });

    // Retrieve a sentence
    router.route('/phrase').get((req, res) => {
        appMiddleware.getPhrase(req, res);
    });

    // Add a sentence
    router.route('/phrase').post((req, res) => {
        appMiddleware.addPhrase(req, res);
    })

    // Annotate a phrase
    router.route('/phrase').put((req, res) => {
        appMiddleware.annotatePhrase(req, res);
    });

    // Retrieve all annotations for a source
    router.route('/phrase/annotations').get((req, res)=>{
        appMiddleware.retrieveSourceAnnotations(req, res);
    });

    // Retrieve all hash values (limit 50) for source
    router.route('/phrase/hashes').get((req, res) => {
        appMiddleware.retrieveSourceHashes(req, res);
    });

    return router;
}

module.exports = routing;