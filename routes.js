const express = require('express');
const router = express.Router();

const All_Controller = require('./controllers/all.js');
const Surveys_Controller = require('./controllers/surveys.js');

router.use(All_Controller.all_get);

router.get('/', All_Controller.surveys_home_get);
router.get('/dashboard', All_Controller.surveys_dashboard_get);

router.get('/dashboard/create', Surveys_Controller.create_get);
router.post('/dashboard/create', Surveys_Controller.create_post);
router.get('/dashboard/create/confirm', All_Controller.create_confirm_get);

router.get('/token', Surveys_Controller.token_get);
router.get('/survey', Surveys_Controller.response_get);

router.get('/dashboard/:uuid', Surveys_Controller.uuid_get);

router.get('/dashboard/:uuid/view', Surveys_Controller.view_get);

router.get('/dashboard/:uuid/generate', Surveys_Controller.generate_get);
router.post('/dashboard/:uuid/generate', Surveys_Controller.generate_post);
router.get('/dashboard/:uuid/generate/confirm', All_Controller.generate_confirm_get);

router.get('/dashboard/:uuid/close', Surveys_Controller.close_get);
router.post('/dashboard/:uuid/close', Surveys_Controller.close_post);
router.get('/dashboard/:uuid/close/confirm', All_Controller.close_confirm_get);

router.get('/dashboard/:uuid/delete', Surveys_Controller.delete_get);
router.post('/dashboard/:uuid/delete', Surveys_Controller.delete_post);
router.get('/dashboard/:uuid/delete/confirm', All_Controller.delete_confirm_get);

router.get('/dashboard/:uuid/tokens', Surveys_Controller.tokens_get);

router.get('/dashboard/:uuid/results', Surveys_Controller.results_get);

router.get('/token/:uuid', Surveys_Controller.token_uuid_get);
router.post('/token/:uuid', Surveys_Controller.token_uuid_post);
router.get('/token/view/confirm', All_Controller.token_uuid_confirm_get);
router.get('/survey/:uuid', Surveys_Controller.survey_response_get);
router.post('/survey/:uuid', Surveys_Controller.survey_response_post);
router.get('/survey/view/confirm', All_Controller.survey_response_confirm_get);

module.exports = router;
