const mongoose = require('mongoose');
const {hashPhrase, Source} = require('./source');
const dbConfig = require('../../config/mongo');

// Connect to mongo
mongoose.connect(dbConfig.url, {useNewUrlParser : true }, (err) => {
    if (err) {
        console.log(`Error in Mongoose Connect.\nError Message: ${err.message}`);
    } else {
        console.log('Successfully connected to Mongo');

        (new Promise(async (resolve, reject) => {
            let value = await Source.estimatedDocumentCount().exec();
            console.log(value);
            return 5;
        })).then((result) => {
            console.log(result);
        }).catch((err) => {
            console.log(err);
        });
    }
});