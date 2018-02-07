'use strict';
const db = require('@arangodb').db;
const createRouter = require('@arangodb/foxx/router');
const aql = require('@arangodb').aql;
const router = createRouter();
var fs = require("fs");
var directory = module.context.fileName("files");
const joi = require('joi');
const hrSystem = db._collection('HRSystem');
const mails = db._collection('Mails');

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

router.get('/get-mails', function (req, res) {
    var a = "do";
    const keys = db._query(aql`
    FOR mail IN ${mails} 
       FOR per in ${hrSystem}  
            FILTER per._id == mail._to 
            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
                                            
            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_mail_address: from_person[0].official_mail,
                to_mail_address: per.official_mail,
                topic: mail.topic, 
                body: mail.body

            })
  `);
    res.send(keys);
})
    .summary('Get mails')
    .description('Get mails');

router.get('/get-mails/:text', function (req, res) {
    const keys = db._query(aql`
    FOR mail IN ${mails} 
        FOR per in ${hrSystem}  
            FILTER per._id == mail._to 
            FILTER REGEX_TEST(mail.body, ${req.pathParams.text}, true)
            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
                                            
            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_mail_address: from_person[0].official_mail,
                to_mail_address: per.official_mail,
                topic: mail.topic, 
                body: mail.body

            })
  `);
    res.send(keys);
})
    .pathParam('text', joi.string().required(), 'Text included in the content')
    .summary('Get mails - searching in the body')
    .description('Get mails - serching in the body');

router.post('/add-mail', function (req, res) {
    const data = req.body;
    const meta = mails.save(req.body);
    res.send(Object.assign(data, meta));
})
    .body(joi.object().required(), 'Add mail')
    .response(joi.object().required(), 'Added mail')
    .summary('Add mail')
    .description('Add mail');