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
const devicesLogs = db._collection('DevicesLogs');
const internalSystemsLogs = db._collection('InternalSystemsLogs')

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

router.get('/get-all-mails/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    FOR mail IN ${mails} 
       FOR per in ${hrSystem}  
            FILTER per._id == mail._to &&
                (DATE_COMPARE(mail.date, ${req.pathParams.startDate}, "years", "days") ||
                   mail.date > ${req.pathParams.startDate}) &&
                (DATE_COMPARE(mail.date, ${req.pathParams.endDate}, "years", "days") ||
                   mail.date < ${req.pathParams.endDate}) 
            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
            LET has_attachment = mail.text_from_attachment == "" || 
                                mail.text_from_attachment == null ? 0 : 1                

            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_key: from_person[0]._key,
                to_key: per._key,
                topic: mail.topic, 
                body: mail.body,
                has_attachment: has_attachment,
                date: mail.date

            })
  `);
    res.send(keys);
})
    .summary('Get mails')
    .description('Get mails');

router.get('/get-mails-by-body/:text/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    FOR mail IN ${mails} 
        FOR per in ${hrSystem}  
            FILTER per._id == mail._to &&
                (DATE_COMPARE(mail.date, ${req.pathParams.startDate}, "years", "days") ||
                   mail.date > ${req.pathParams.startDate}) &&
                (DATE_COMPARE(mail.date, ${req.pathParams.endDate}, "years", "days") ||
                   mail.date < ${req.pathParams.endDate}) 
            FILTER REGEX_TEST(mail.body, ${req.pathParams.text}, true)
            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
            LET has_attachment = mail.text_from_attachment == "" || 
                                mail.text_from_attachment == null ? 0 : 1            

            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_key: from_person[0]._key,
                to_key: per._key,
                topic: mail.topic, 
                body: mail.body,
                has_attachment: has_attachment,
                date: mail.date

            })
  `);
    res.send(keys);
})
    .pathParam('text', joi.string().required(), 'Text included in the content')
    .summary('Get mails - searching in the body')
    .description('Get mails - serching in the body');

router.get('/get-mails-by-attachment/:text/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    FOR mail IN FULLTEXT(${mails}, 'text_from_attachment', ${req.pathParams.text})
        FOR per in ${hrSystem}  
            FILTER per._id == mail._to &&
               (DATE_COMPARE(mail.date, ${req.pathParams.startDate}, "years", "days") ||
                   mail.date > ${req.pathParams.startDate}) &&
                (DATE_COMPARE(mail.date, ${req.pathParams.endDate}, "years", "days") ||
                   mail.date < ${req.pathParams.endDate}) 
            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
            LET has_attachment = mail.text_from_attachment == "" || 
                                mail.text_from_attachment == null ? 0 : 1 
                                            
            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_key: from_person[0]._key,
                to_key: per._key,
                topic: mail.topic, 
                body: mail.body,
                has_attachment: has_attachment,
                date: mail.date
            })
  `);
    res.send(keys);
})
    .pathParam('text', joi.string().required(), 'Text included in the attachment')
    .summary('Get mails - searching in the attachment')
    .description('Get mails - serching in the attachment');

router.post('/add-mail', function (req, res) {
    const data = req.body;
    const meta = mails.save(req.body);
    res.send(Object.assign(data, meta));
})
    .body(joi.object().required(), 'Add mail')
    .response(joi.object().required(), 'Added mail')
    .summary('Add mail')
    .description('Add mail');

router.get('/antivirus-line-chart/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    LET startDate = ${req.pathParams.startDate}
    LET endDate = ${req.pathParams.endDate}

    FOR log IN ${devicesLogs}  
        FILTER log.source == "Avast" 
            AND log.information.status == "successful update"
            AND log.date > startDate 
            AND log.date < endDate
        COLLECT number_of_day = DATE_DAY(log.date) INTO LogDate
        RETURN {
         number_of_day,
         number_of_updates: LENGTH(UNIQUE(LogDate[*].log.device_SN))
        }
  `);
    res.send(keys);
})
    .pathParam('startDate', joi.string().required(), 'Start date')
    .pathParam('endDate', joi.string().required(), 'End date')
    .summary('Get data for antivirus line chart')
    .description('Get data for antivirus line chart');

router.get('/antivirus-pie-chart/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    LET startDate = ${req.pathParams.startDate}
    LET endDate = ${req.pathParams.endDate}
    LET updated_SN = (FOR log IN ${devicesLogs}   
            FILTER log.source == "Avast" 
                AND log.information.status == "successful update"
                AND log.date > startDate 
                AND log.date <= endDate
            RETURN DISTINCT log.device_SN)
        
    LET updated_quantity = LENGTH(updated_SN)    
    LET all_computer_SN = (FOR person IN ${hrSystem} 
        RETURN (
            { device: person.devices.computer[* FILTER 
                                                CURRENT.initial_date <= startDate AND 
                                                (CURRENT.end_date >= endDate || CURRENT.end_date == null)
                                             ].SN
                         
            }
        ).device
        )[**]


    LET all_phone_SN = (FOR person IN ${hrSystem} 
        RETURN (
            { device: person.devices.phone[* FILTER 
                                                CURRENT.initial_date <= startDate AND 
                                                (CURRENT.end_date >= endDate || CURRENT.end_date == null)
                                          ].SN
                         
            }
        ).device
        )[**]
                    
    LET all_SN = APPEND(all_phone_SN, all_computer_SN)
    LET not_updated_quantity = LENGTH(MINUS(all_SN, updated_SN))
        
    RETURN {
        updated_quantity,
        not_updated_quantity
        }
  `);
    res.send(keys);
})
    .pathParam('startDate', joi.string().required(), 'Start date')
    .pathParam('endDate', joi.string().required(), 'End date')
    .summary('Get data for antivirus pie chart')
    .description('Get data for antivirus pie chart');

router.get('/antivirus-people-list/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    LET startDate = ${req.pathParams.startDate}
    LET endDate = ${req.pathParams.endDate}
    LET updated_SN = (FOR log IN ${devicesLogs}
        FILTER log.source == "Avast" 
            AND log.information.status == "successful update"
            AND log.date > startDate 
            AND log.date <= endDate
        RETURN DISTINCT log.device_SN)

    LET all_phone_SN = (FOR person IN ${hrSystem} 
            RETURN (
                { device: person.devices.phone[* FILTER 
                                                    CURRENT.initial_date <= startDate AND 
                                                    (CURRENT.end_date >= endDate || CURRENT.end_date == null)
                                              ].SN
                }
            ).device
            )[**]
                
    LET all_computer_SN = (FOR person IN ${hrSystem} 
            RETURN (
                { device: person.devices.computer[* FILTER 
                                                    CURRENT.initial_date <= startDate AND 
                                                    (CURRENT.end_date >= endDate || CURRENT.end_date == null)
                                                 ].SN
                }
            ).device
            )[**]
        
    LET all_SN = APPEND(all_phone_SN, all_computer_SN)
                
    LET not_updated_SN = MINUS(all_SN, updated_SN)

    LET employees = (FOR person IN ${hrSystem} 
        RETURN{
        key: person._key,
        name : CONCAT_SEPARATOR(" ", person.name, person.surname),
        mail: person.official_mail,
        department: person.department,
        roles: person.roles[*].title,
        sn: APPEND(person.devices.phone[*].SN, person.devices.computer[*].SN)
        })
    
    FOR person in employees
        FILTER LENGTH(INTERSECTION(person.sn, updated_SN)) == 0
        RETURN ({
            key: person.key
        })
  `);
    res.send(keys);
})
    .pathParam('startDate', joi.string().required(), 'Start date')
    .pathParam('endDate', joi.string().required(), 'End date')
    .summary('Get people who do not update antivirus')
    .description('Get people who do not update antivirus');

router.get('/correspondence-table-people/:key', function (req, res) {
    const keys = db._query(aql`
    FOR person IN  ${hrSystem}
        FILTER person._key == ${req.pathParams.key}
        RETURN {
            name: CONCAT_SEPARATOR(" ", person.name, person.surname),
            mail: person.official_mail,
            department: person.department,
            roles: person.roles[*].title
        }
  `);
    res.send(keys);
})
    .pathParam('key', joi.string().required(), 'Key of the document')
    .summary('Get people by a key')
    .description('Get people by a key');

router.get('/internal-system-employees-accounts/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
    LET results = (FOR log IN ${internalSystemsLogs}  
      FILTER log.createdAt > ${req.pathParams.startDate} &&
         log.createdAt < ${req.pathParams.endDate} &&
         log.action_type == 'login failed'
  
      LET person = (FOR p IN HRSystem 
                        FILTER p._key == log.person_key 
                        RETURN CONCAT_SEPARATOR(" ", p.name, p.surname))[0]
  
      COLLECT name = person INTO Person
  
      RETURN { name : name, number_of_failed_login : LENGTH(UNIQUE(Person))})
    FOR result IN results
    SORT result.number_of_failed_login DESC
    RETURN result

  `);
    res.send(keys);
})
    .summary('Get name of failed login account')
    .description('Get name of failed login account');

router.get('/internal-system-login-ip/:startDate/:endDate', function (req, res) {
    const keys = db._query(aql`
     LET results = (FOR log IN ${internalSystemsLogs}
          FILTER log.createdAt > ${req.pathParams.startDate} &&
             log.createdAt < ${req.pathParams.endDate} &&
             log.action_type == 'login failed'
  
          COLLECT ip = log.network_data.ip INTO Ip
  
          RETURN { ip : ip, number_of_failed_login : LENGTH(UNIQUE(Ip))})
      
    FOR result IN results
    SORT result.number_of_failed_login DESC
    RETURN result
  `);
    res.send(keys);
})
    .summary('Get name of failed login account')
    .description('Get name of failed login account');

router.get('/get-mails-elastic-search/:key', function (req, res) {
    const keys = db._query(aql`
    FOR mail IN ${mails} 
       FOR per in ${hrSystem}  
            FILTER per._id == mail._to &&
                mail._key == ${req.pathParams.key}

            LET from_person = (FOR p in HRSystem 
                                FILTER p._id == mail._from
                                RETURN p
                              )
            LET has_attachment = mail.text_from_attachment == "" || 
                                mail.text_from_attachment == null ? 0 : 1                

            RETURN ({
                mail_key: mail._key,
                from: mail._from, 
                to: mail._to,
                full_name_from: 
                    CONCAT_SEPARATOR(" ", from_person[0].name, from_person[0].surname), 
                full_name_to: CONCAT_SEPARATOR(" ", per.name, per.surname),
                from_key: from_person[0]._key,
                to_key: per._key,
                topic: mail.topic, 
                body: mail.body,
                has_attachment: has_attachment,
                date: mail.date

            })
  `);
    res.send(keys);
})
    .pathParam('key', joi.string().required(), 'Text included in the attachment')
    .summary('Get mails - searching in the attachment')
    .description('Get mails - serching in the attachment');

