'use strict'

// Modules
const constants = require('./helper/constants');
const util = require('./helper/utilities');
const sec = require('./helper/security');
const unirest = require('unirest');
const apiConfig = require('../config/api.json');
const { Translate } = require('@google-cloud/translate');
const uuid = require('uuid/v4');
const request = require('request-promise');
const {hashPhrase , Source} = require('./schemas/source');
const User = require('./schemas/user');
const ipc = require('node-ipc');

// Wrapper for the unirest get method for the example sentence
// If the random number is greater than 75, we retrieve a definition
// Else, we retrieve an example
function getRandomPhrase(randomNumber) {
    return new Promise((resolve, reject) => {
        // Retrieve a random definition
        if (randomNumber > 75) {
            unirest.get('https://wordsapiv1.p.rapidapi.com/words/?limit=1&page=1&hasDetails=definitions&random=true')
            .header("X-Mashape-Key", apiConfig.wordsKey)
            .header('X-Mashape-Host', 'wordsapiv1.p.rapidapi.com')
            .end(function (result) {
                // Check the size of the return body and select a random definition of the word
                let randomIndex = util.getRandomNumber(0, result.body.results.length);
                util.log('Returning the random definition from getRandomPhrase');
                resolve(result.body.results[randomIndex].definition);
            });
        } else {
            unirest.get('https://wordsapiv1.p.rapidapi.com/words/?limit=1&page=1&hasDetails=examples&random=true')
            .header("X-Mashape-Key", apiConfig.wordsKey)
            .header('X-Mashape-Host', 'wordsapiv1.p.rapidapi.com')
            .end(function (result) {
                // Create list of new examples
                let examplesList = new Array();
                // Retrieve the examples and choose from one of them
                result.body.results.forEach(function(item) {
                  if (item.examples) {
                    examplesList.push(...item.examples)
                  }
                });

                // The random index
                let randomIndex = util.getRandomNumber(0, examplesList.length);
                util.log('Returning the random example from getRandomPhrase');
                resolve(examplesList[randomIndex]);
            });
        }
    })
}

// Retrieves a phrase for the user
function getPhrase(req, res){
    // Access
    let phrase = null;
    let googleTranslation = null;
    let azureTranslation = null;
    let yandexTranslation = null;
    let number = null;
    let languageAbr = null;
    let hashedPhrase = null;

    sec.authenticateApp(req.get('clientId')).then((resolve) => {
        // Authorize the user
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then(async (userDoc) =>{
        // The language is not available
        languageAbr = req.get('language');
        if(!languageAbr) {
            let err = new Error('Request must contain language header value');
            err.code = constants.BAD_REQUEST;
            throw err;
        }
        // Generate a phrase to send the user with the following rules
        // 0 - 50: Retrieve a word with low annotations from Source
        // 51 - 75: Retrieve a random definition from the Words API
        // 76 - 100: Retrieve a random example phrase from the Words API
        number = util.getRandomNumber(0, 100);
        if (number > 50) {
            util.log('Sending Random Phrase from WordsAPI');
            return getRandomPhrase(number);
        } else {
            util.log('Sending phrase from database');
            let documentCount = await Source.estimatedDocumentCount().exec();
            // Check whether the source database is empty and return a source
            // accordingly
            if (documentCount > 0) {
                return Source.find().sort({annotationCount : 'asc'}).limit(5).exec();
            } else {
                util.log('Database is empty, returning random source instead');
                number += 50;
                return getRandomPhrase(number);
            }
        }
    }).then((result) => {
        // Make phrase visible to the subsequent promises
        if (number > 50) {
            phrase = result;
        } else {
            let randomIndex = util.getRandomNumber(0, 5)
            phrase = result[randomIndex].phrase;
        }

        // Get the phrase's hash
        hashedPhrase = hashPhrase(phrase);

        util.log(`Translating with Google the phrase -- ${phrase}`);

        // Translate the phrase using both Google and ...
        const translate = new Translate({ projectId: apiConfig.googleProjectId });
        // Translate the text using Google's translation engine
        return translate.translate(phrase, languageAbr);
    }).then((results) => {
        util.log('Successfully retrieved Google Translation');
        // Retrieve the google translation
        googleTranslation = results[0];

        util.log('Translating with Azure');
        // Translate using Azure
        let options = {
            method: 'POST',
            baseUrl : 'https://api.cognitive.microsofttranslator.com/',
            url: 'translate',
            qs: {
              'api-version' : '3.0',
              'from' : 'en',
              'to' : languageAbr
            },
            headers : {
              'Ocp-Apim-Subscription-Key': apiConfig.azureKey,
              'Content-Type': 'application/json',
              'X-ClientTraceId' : uuid().toString()
            },
            body: [{
              'text' : phrase
            }],
            json: true
          }

          // Translate using Azure
          return request(options);
    }).then((result)=>{
        // Retrieve the azure translation
        azureTranslation = result[0].translations[0].text;
        util.log('Successfully retrieved azure translation');

        // Retrieve the Yandex translation
        let options = {
            method: 'POST',
            baseUrl : 'https://translate.yandex.net/',
            url: 'api/v1.5/tr.json/translate',
            qs: {
              'key' : apiConfig.yandexKey,
              'text' : phrase,
              'lang' : `en-${languageAbr}`
            },
            json : true
        }

        util.log('Retrieving the Yandex translation');
        return request(options);
    }).then((result)=>{
        // Retrieve the yandex translation
        yandexTranslation = result.text[0];

        util.log('Sending the user all of the translations');
        // Send the original phrase, google translation, and azure translation to the user
        return res.status(constants.OK).json({
            'phrase' : phrase,
            'hash' : hashedPhrase,
            'targetLanguage' : languageAbr,
            'azureTranslation' : azureTranslation,
            'googleTranslation' : googleTranslation,
            'yandexTranslation' : yandexTranslation
        });
    }).then((result)=> {
        // Find the Source Document containing the above translations
        return Source.findOne({'hash' : hashedPhrase});
    }).then((sourceDoc) => {
        // Retrieve the full language name instead of the abbreviation
        let language = constants[languageAbr];
        let newDoc = false;
        
        // If the source document is null, then this phrase has never been
        // seen before, create a new one
        if(!sourceDoc) {
            newDoc = true;
            sourceDoc = new Source();
            sourceDoc.phrase = phrase;
            sourceDoc.annotationCount = 0;
            sourceDoc.annotations = new Map();
        } 

        // Add the current language information to the source document
        if(!sourceDoc[language]) {
            sourceDoc.annotations.set(language, {
                'azure' : {
                    'translation' : azureTranslation,
                    'correct' : 0,
                    'incorrect' : 0
                },
                'google' : {
                    'translation' : googleTranslation,
                    'correct' : 0,
                    'incorrect' : 0
                },
                'yandex' :{
                    'translation' : yandexTranslation,
                    'correct' : 0,
                    'incorrect' : 0
                }
            })

            // If this is a completely new document, save, otherwise, update
            if(newDoc) {
                sourceDoc.save();
            } else {
                Source.updateOne({'hash' : sourceDoc.hash}, {
                    $set : {
                        'annotations' : sourceDoc.annotations
                    }
                }).exec();
            }
        }
    }).catch((err) => {
        if (err.code == constants.DUPLICATE_KEY) {
            util.log('Duplicate key, not creating duplicate source text to databse');
        } else {
            util.log(`Error in getPhrase in application middleware.\nError Message ${err.message}`);
            return res.status(err.code).json({message : err.message});
        }
    });
}

// Request to add source text to the database
function addPhrase(req, res) {
    // Authenticate the application making the request
    sec.authenticateApp(req.get('clientId')).then((result) => {
        util.log('Authorizing user in addPhrase method in application middleware');
        // Authorize the current user
        return sec.authorizeUser(req.body.username, req.body.accessToken);
    }).then((userDoc)=> {
        let phrase = req.body.phrase;
        // Malformed request
        if (!phrase) {
            let err = new Error('Request to add source text must include phrase in body');
            err.code = constants.BAD_REQUEST;
            throw err;
        }

        // The new source object
        let newSource = {
            'phrase' : phrase,
            'annotationCount' : 0,
            'annotations' : new Map()
        };
        // Attempt to save the potentially new source item
        return Source.create(newSource);
    }).then((result)=>{
        util.log('Phrase has been saved successfully');
        // The phrase has been saved successfully
        return res.status(constants.OK).json({message : 'Phrase has been saved successfully'});
    }).catch((err) =>{
        util.log(`Error in addPhrase in application middleware.\nError Message ${err.message}`);
        if (err.code === constants.DUPLICATE_KEY) {
            err.code = constants.NOT_ACCEPTABLE;
            err.message = 'Cannot add source text already in database';
        }
        return res.status(err.code).json({message : err.message});
    });
}

// The user's annotation of a phrase
function annotatePhrase(req, res) {
    // The full language title
    let language = null;
    // If the user is updating one of their previous annotations
    let userHasUpdatedAzure = false;
    let userHasUpdatedGoogle = false;
    let userHasUpdatedYandex = false;
    let userHasUpdated = false;
    let username = null;

    sec.authenticateApp(req.get('clientId')).then((result) => {
        // Authorize the user
        return sec.authorizeUser(req.body.username, req.body.accessToken);
    }).then((userDoc)=> {
        // Request does not contain all fields
        if (!req.body.hash || !req.body.languageAbr || !req.body.isAzureCorrect || 
            !req.body.isGoogleCorrect || !req.body.isYandexCorrect) {
            util.log('Malformed request');
            let err = new Error('Request body is incomplete');
            err.code = constants.BAD_REQUEST;
            throw err;
        }

        // Evaluate the boolean strings into their Boolean counterpart
        req.body.isAzureCorrect = util.evalBoolean(req.body.isAzureCorrect);
        req.body.isGoogleCorrect = util.evalBoolean(req.body.isGoogleCorrect);
        req.body.isYandexCorrect = util.evalBoolean(req.body.isYandexCorrect);

        // Set the full lanugage title
        language = constants[req.body.languageAbr];
        // Set the username for monitoring
        username = userDoc.username;

        // Three user case scenarios:
        // Annotating the phrase for the first time ever => Just add
        // Annotating the same phrase, but with a different language => Just add
        // Updating their previous annotations of the same phrase => Check then add

        // If the user has never annotated in this language before
        if(!userDoc.annotations.get(req.body.hash)) {
            userDoc.annotations.set(req.body.hash, new Map());
        }

        // Check whether the user is updating their annotation from before
        let userAnnotation = userDoc.annotations.get(req.body.hash).get(language);
        if (userAnnotation) {
            if(userAnnotation.isAzureCorrect !== req.body.isAzureCorrect){
                userHasUpdatedAzure = true;
            }
            if (userAnnotation.isGoogleCorrect !== req.body.isGoogleCorrect){
                userHasUpdatedGoogle = true;
            }
            if(userAnnotation.isYandexCorrect !== req.body.isYandexCorrect){
                userHasUpdatedYandex = true;
            }
            // The user has seen this annotation before, but has chosen to keep
            // their annotations the same
            if (!userHasUpdatedAzure && !userHasUpdatedGoogle && !userHasUpdatedYandex) {
                util.log('User has chosen the same annotations for a phrase they saw before');
                return null;
            } else {
                userHasUpdated = true;
            }
        }

        // Update the user document
        userDoc.annotations.get(req.body.hash).set(language, {
            'isAzureCorrect' : req.body.isAzureCorrect,
            'isGoogleCorrect' : req.body.isGoogleCorrect,
            'isYandexCorrect' : req.body.isYandexCorrect
        });
        User.updateOne({'username' : userDoc.username}, {
            $set:{
                'annotations' : userDoc.annotations
            }
        }).exec();

        // Update the source document
        return Source.findOne({'hash' : req.body.hash});
    }).then((sourceDoc) => {
        // 3 Cases:
        // User has seen the phrase for the first time => Update the source document
        // User has seen the phrase before, but did not change anything => Dont do anything
        // User has seen the phrase before and decided to update their choices
        if (sourceDoc){
            if (!userHasUpdated){
                util.log("Adding user's new annotation");
                // The full language title
                let language = constants[req.body.languageAbr];

                // Update each translation
                (req.body.isAzureCorrect) ? (sourceDoc.annotations.get(language).azure.correct += 1) : 
                                                (sourceDoc.annotations.get(language).azure.incorrect += 1);
                (req.body.isGoogleCorrect) ? (sourceDoc.annotations.get(language).google.correct += 1) : 
                                                (sourceDoc.annotations.get(language).google.incorrect += 1);
                (req.body.isYandexCorrect) ? (sourceDoc.annotations.get(language).yandex.correct += 1) : 
                                                (sourceDoc.annotations.get(language).yandex.incorrect += 1);
            } else {
                util.log("Updating user's previous annotation");
                // If the newly changed value is FALSE, updateVal will be -1 to subtract from correct counter
                // and then be multiplied by 1 to increment incorrect counter and vice versa
                let updateVal = 0;
                if (userHasUpdatedAzure) {
                    updateVal = (2 * req.body.isAzureCorrect) - 1;
                    sourceDoc.annotations.get(language).azure.correct += updateVal;
                    sourceDoc.annotations.get(language).azure.incorrect += (updateVal * -1);
                }
                if(userHasUpdatedGoogle) {
                    updateVal = (2 * req.body.isGoogleCorrect) - 1;
                    sourceDoc.annotations.get(language).google.correct += updateVal;
                    sourceDoc.annotations.get(language).google.incorrect += (updateVal * -1);
                }
                if(userHasUpdatedYandex) {
                    updateVal = (2 * req.body.isYandexCorrect) - 1;
                    sourceDoc.annotations.get(language).yandex.correct += updateVal;
                    sourceDoc.annotations.get(language).yandex.incorrect += (updateVal * -1);
                }
            }

            // Update with the new changes, increment the annotation count only if 
            // the user is not updating a previous one
            Source.updateOne({'hash' : sourceDoc.hash}, {
                $inc : {
                    'annotationCount' : -userHasUpdated + 1
                },
                $set : {
                    'annotations' : sourceDoc.annotations
                }
            }).exec();

            // Send to the Monitoring service
            ipc.connectTo('MonitorServer', ()=> {
                // On connected, send the message
                ipc.of.MonitorServer.on('connect', ()=> {
                    ipc.of.MonitorServer.emit('message',
                        `User: ${username}\n` +
                        `Phrase: ${sourceDoc.phrase}\n` +
                        `Language: ${language}\n` +
                        `Azure Translations: ${sourceDoc.annotations.get(language).azure.translation}\n` + 
                        `Azure is Correct: ${req.body.isAzureCorrect}\n` +
                        `Google Translations: ${sourceDoc.annotations.get(language).google.translation}\n` + 
                        `Google is Correct: ${req.body.isGoogleCorrect}\n` +
                        `Yandex Translations: ${sourceDoc.annotations.get(language).yandex.translation}\n` + 
                        `Yandex is Correct: ${req.body.isYandexCorrect}\n`
                    );
                    ipc.disconnect('MonitorServer');
                });
            });
        }
        return res.status(constants.ACCEPTED).json({'message' : 'Successfully added user annotation'});
    }).catch((err) => {
        util.log(`Error in annotatePhrase in application middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({'message' : err.message});
    });
}


// Retrieve all of the annotations for a source object
// Must contain admin privilegdes
function retrieveSourceAnnotations(req, res) {
    // Authenticate whether the request is coming from the proper client
    sec.authenticateApp(req.get('clientId')).then((result) => {
        // Authenticate whether the user is authorized to make a request
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then((userDoc)=> {
        // Check whether the user has admin privilegdes
        if(!userDoc.isAdmin){
            let err = new Error('User must contain admin privileges for this operation');
            err.code = constants.UNAUTHORIZED;
            throw err;
        }

        // Retrieve the request hash or phrase, hash takes priority
        if(req.get('hash')) {
            return Source.findOne({'hash' : req.get('hash')});
        } else if(req.get('phrase')) {
            // Properly hash the phrase and get the hash
            let hashedPhrase = hashPhrase(req.get('phrase'));
            return Source.findOne({'hash' : hashedPhrase});
        } else {
            // The request is the hash or phrase values
            let err = new Error('Request must include either hash or phrase values');
            err.code = constants.BAD_REQUEST;
            throw err;
        }
    }).then((sourceDoc) =>{
        // The source document with the specified hash does not exist
        if(!sourceDoc) {
            let err = new Error('Source for the phrase or hash does not exist');
            err.code = constants.NOT_FOUND;
            throw err;
        } 

        return res.status(constants.OK).json({
            'phrase' : sourceDoc.phrase,
            'annotations' : sourceDoc.annotations,
            'languages' : Array.from(sourceDoc.annotations.keys())
        });
    }).catch((err) =>{
        util.log(`Error in retrieveSourceAnnotations in application middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({'message' : err.message});
    });
}

// Allows an admin to retrieve all of the hashes for sources stored in the database
function retrieveSourceHashes(req, res) {
    sec.authenticateApp(req.get('clientId')).then((result)=>{
        // Authorize the user account
        return sec.authorizeUser(req.get('username'), req.get('accessToken'));
    }).then((userDoc) =>{
        if(!userDoc.isAdmin) {
            let err = new Error('User must be admin');
            err.code = constants.UNAUTHORIZED;
            throw err;
        }
        // Do a query for all of the hash values
        return Source.find().select('hash').limit(50).exec();
    }).then((hashList)=>{
        util.log('Returning hash list');
        return res.status(constants.OK).json({'list' : hashList});
    }).catch((err) => {
        util.log(`Error in retrieveHashList in application middleware.\nError Message: ${err.message}`);
        return res.status(err.code).json({'message' : err.message});
    });
}

module.exports = {
    getPhrase,
    addPhrase,
    annotatePhrase,
    retrieveSourceHashes,
    retrieveSourceAnnotations
}