'use strict'

// Retrieve modules
const mongoose = require('mongoose');
const constants = require('../helper/constants');
const sec = require('../helper/security');
const util = require('../helper/utilities');

// The source schema
const SourceSchema = new mongoose.Schema({
    phrase: {
        type: String,
        required : true
    },
    hash : {
        type : String,
        unique : true
    },
    annotationCount : {
        type: Number,
        required : true,
        index : true
    },
    annotations : Map
});

// Simplified helper function for phrase hashing
function hashPhrase(phrase){
    return sec.hash(util.strip(phrase));
}

// Hash the source item with lowercase and punctuations removed
// so that we can create the least amount of redundancy
SourceSchema.pre('save', function(next){
    util.log('Source Schema Pre Hook - save');
    this.hash = hashPhrase(this.phrase);
    next();
});

const Source = mongoose.model('Source', SourceSchema);
module.exports = {
    hashPhrase,
    Source
}