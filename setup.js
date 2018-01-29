'use strict';

var db = require('@arangodb').db,
    fs = require("fs"),
    directory = module.context.fileName("files"),
    collectionName = module.context.collectionName('filelist');

if (db._collection(collectionName) === null) {
    db._create(collectionName);
}

if (!fs.isDirectory(directory)) {
    fs.makeDirectory(directory);
}