'use strict';
const createRouter = require('@arangodb/foxx/router');
const router = createRouter();
var fs = require("fs");
var directory = module.context.fileName("files");
const joi = require('joi');

module.context.use(router);

router.get('/download-file/:name', function (req, res) {
    var filename = module.context.fileName(`files/${req.pathParams.name}`);
    if (!fs.isFile(filename)) {
        res.throw(503, "The filename doesn't exist!");
    }
    res.sendFile(filename);
})
    .pathParam('name', joi.string().required(), 'Name of file')
    .summary('Download file')
    .description('Download a binary file');

router.post('/save-file/:name', function (req, res) {
    var body = req.rawBody;
    
    var filename = module.context.fileName(`files/${req.pathParams.name}`);

    if (fs.isFile(filename)) {
        res.throw(503, "The filename has to be unique!");
    }

    fs.write(filename, body);
})
    .pathParam('name', joi.string().required(), 'Name of file')
    .summary('Save file')
    .description('Save a binary file');