const {hashPhrase , Source} = require('./source');
const mongoose = require('mongoose');
const dbConfig = require('../../config/mongo');
const util = require('../helper/utilities');

console.log(hashPhrase('penis'));