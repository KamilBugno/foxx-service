'use strict';
const createRouter = require('@arangodb/foxx/router');
const router = createRouter();

module.context.use(router);

router.get('/hello-world', function (req, res) {
    res.send('Hello World!');
})
    .response(['text/plain'], 'A generic greeting.')
    .summary('Generic greeting')
    .description('Prints a generic greeting.');

const joi = require('joi');

router.get('/hello/:name', function (req, res) {
    res.send(`Hello ${req.pathParams.name}`);
})
    .pathParam('name', joi.string().required(), 'Name to greet.')
    .response(['text/plain'], 'A personalized greeting.')
    .summary('Personalized greeting')
    .description('Prints a personalized greeting.');