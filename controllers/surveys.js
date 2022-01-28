const { v4: uuidv4 } = require('uuid');
const { body, param, query, matchedData, validationResult } = require('express-validator');

const cookieOptions = require('../../scripts/cookieOptions');
const utils = require('../../scripts/utilities');
const winston = require('../../scripts/log');

const mongoose = require('mongoose');
const surveyModels = require('../models.js');
const accountModels = require('../../account/models.js');

const BASEPATH = '/projects/surveys';

exports.create_get = function(req, res, next) {
  if (req.session.loggedInAs && req.session.loggedInAsId) {
    accountModels.userLevel.findOne({ user: req.session.loggedInAsId }).exec()
      .then(function(user) {
        res.render('../surveys/views/create', {
          title: 'Create Survey',
          maxItems: user.maxQuestions
        });
      })
      .catch(function(err) {
        if (err) {
          winston.logger.error(err);
        }
        res.render('../surveys/views/confirm', {
          title: 'Create Survey',
          error: 'An error occurred while getting the data. Please try again later.'
        });
      });
  } else {
    res.redirect('/website/account/login');
  }
};

exports.create_post = [
  // Title
  body('sWebsite', 'Must be between 1 to 50 characters. Can contain A-Z, a-z, 0-9, -, and spaces.')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Za-z0-9 \-]+$/)
    .whitelist('A-Za-z0-9 \-')
    .escape(),
  // Description
  body('sAddress', 'Must be less than 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!, and spaces.')
    .trim()
    .optional()
    .isLength({ max: 150 })
    .matches(/^[A-Za-z0-9\-\.\?!,\s]*$/)
    .whitelist('A-Za-z0-9\-\.\?!,\\s')
    .escape(),
  // Responses
  body('sLastName', 'Must be a valid response type.')
    .trim()
    .isIn(['Tokens', 'Members'])
    .escape(),
  body('sRadioItem.*', 'Must be a valid item type.')
    .trim()
    .isIn(['Textbox', 'Rating', 'YesNo'])
    .escape(),
  body('sItem.*', 'Must be between 1 to 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!, and spaces.')
    .trim()
    .isLength({ min: 1, max: 150 })
    .matches(/^[A-Za-z0-9\-\.\?!,\s]+$/)
    .whitelist('A-Za-z0-9\-\.\?!,\\s')
    .escape(),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('sFirstName', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['body'] })
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 2);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (errors.isEmpty() && pastTime) {
      const url = 'https://www.google.com/recaptcha/api/siteverify';
      const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                          'response=' + encodeURIComponent(data['g-recaptcha-response']);
      utils.postJSON(url, {}, requestData, (parsedJSON) => {
        if (parsedJSON.success === true &&
            parsedJSON.score >= 0.7 &&
            parsedJSON.action === 'submit' &&
            parsedJSON.hostname === req.hostname) {
          return true;
        }
        return Promise.reject('Failed reCAPTCHA test.');
      })
      .then((success) => {
        surveyModels.survey.countDocuments({ owner: req.session.loggedInAsId }, function(err, count) {
          if (err) {
            handleInsertionError(err, 'An error occurred while creating the survey. Please try again later.');
          } else {
            accountModels.userLevel.findOne({ user: req.session.loggedInAsId })
              .exec(function(err, user) {
                if (err) {
                  handleInsertionError(err, 'An error occurred while creating the survey. Please try again later.');
                } else {
                  if ((count + 1) > user.maxSurveys) {
                    handleInsertionError(null, 'The maximum amount of surveys you can create has been reached.');
                  } else {
                    if (data.sItem && data.sItem.length > user.maxQuestions) {
                      handleInsertionError(null, 'The maximum amount of questions has been reached.');
                    } else {
                      let survey = new surveyModels.survey({
                        uuid: uuidv4(),
                        owner: req.session.loggedInAsId,
                        created: Date.now(),
                        title: data.sWebsite,
                        description: data.sAddress,
                        questions: [],
                        active: true,
                        responseType: data.sLastName,
                        responsesCompleted: 0,
                        maxTokens: user.maxTokens
                      });
                      let questions = [];
                      if (data.sItem) {
                        for (let i = 0; i < data.sItem.length; i++) {
                          let surveyQuestion = new surveyModels.surveyQuestion({
                            surveyId: survey.uuid,
                            promptType: data.sRadioItem[i],
                            promptText: data.sItem[i]
                          });
                          survey.questions.push(surveyQuestion._id);
                          questions.push(surveyQuestion.save()
                            .then(function(doc) {
                              return Promise.resolve(doc);
                            })
                            .catch(function(err) {
                              return Promise.reject();
                            })
                          );
                        }
                      }
                      Promise.all(questions)
                        .then(function() {
                          return survey.save();
                        })
                        .then(function(doc) {
                          res.redirect(BASEPATH + '/dashboard/create/confirm');
                        })
                        .catch(function(err) {
                          handleInsertionError(err, 'An error occurred while creating the survey. Please try again later.');
                        });
                    }
                  }
                }
              });
          }
        });
      })
      .catch(err => handleInsertionError(err, 'Failed reCAPTCHA test.'));
    } else {
      if (selected.sFirstName || !pastTime) {
        handleInsertionError(JSON.stringify(selected), 'An error occurred while creating the survey. Please try again later.');
      } else {
        accountModels.userLevel.findOne({ user: req.session.loggedInAsId }).exec()
          .then(function(user) {
            res.render('../surveys/views/create', {
              title: 'Create Survey',
              maxItems: user.maxQuestions,
              selected: selected,
              errors: errors.array()
            });
          })
          .catch(function(err) {
            res.render('../surveys/views/create', {
              title: 'Create Survey',
              maxItems: 0,
              selected: selected,
              errors: errors.array()
            });
          });
      }
    }
    function handleInsertionError(err, msg) {
      errors = errors.array();
      errors.push({
        param: 'insertion',
        msg: msg
      });
      if (err) {
        winston.logger.error(err);
      }
      accountModels.userLevel.findOne({ user: req.session.loggedInAsId }).exec()
        .then(function(user) {
          res.render('../surveys/views/create', {
            title: 'Create Survey',
            maxItems: user.maxQuestions,
            selected: selected,
            errors: errors
          });
        })
        .catch(function(err) {
          res.render('../surveys/views/create', {
            title: 'Create Survey',
            maxItems: 0,
            selected: selected,
            errors: errors
          });
        });
    }
  }
];

exports.token_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'View Survey',
      error: 'The token does not exist.'
    });
  }
};

exports.response_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'View Survey',
      error: 'The survey is not available for response.'
    });
  }
};

exports.uuid_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
    surveyModels.survey.find({ owner: req.session.loggedInAsId })
      .sort({ created: 'desc' })
      .exec(function(err, surveys) {
        if (err) {
          winston.logger.error(err);
        }
        if (!errors.isEmpty()) {
          displayOverviewDashboard();
        } else {
          surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId })
            .populate('questions')
            .lean()
            .exec(function(err, match) {
              if (err) {
                winston.logger.error(err);
              }
              if (!match) {
                displayOverviewDashboard();
              } else {
                if (match && match.created) {
                  let formattedTimeDate = utils.getDateTime(req.signedCookies.TD, match.created);
                  if (formattedTimeDate.timeZoneName) {
                    match.created = formattedTimeDate.dateString + ' ' + 
                                    formattedTimeDate.timeString + ' (' + 
                                    formattedTimeDate.timeZoneName + ')';
                  } else {
                    match.created = formattedTimeDate.dateString + ' ' + formattedTimeDate.timeString;
                  }
                }
                res.render('../surveys/views/dashboard', {
                  title: 'Surveys Dashboard',
                  surveys: surveys,
                  selected: match
                });
              }
            });
        }
        function displayOverviewDashboard() {
          let counts = [];
          for (let survey of surveys) {
            counts.push(surveyModels.response.countDocuments({ surveyId: survey.uuid }).exec()
              .then(function(count) {
                survey.allResponses = count;
                return Promise.resolve(count);
              })
              .catch(function(err) {
                winston.logger.error(err);
                survey.allResponses = 0;
                return Promise.reject(0);
              }));
          }
          Promise.allSettled(counts)
            .finally(function() {
              res.render('../surveys/views/dashboard', {
                title: 'Surveys Dashboard',
                surveys: surveys
              });
            });
        }
      });
  }
];

exports.view_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'View Survey',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId })
        .populate('questions')
        .exec(function(err, match) {
          if (err) {
            winston.logger.error(err);
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'An error occurred while getting the survey. Please try again later.'
            });
          } else if (!match) {
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'The survey does not exist.'
            });
          } else {
            res.render('../surveys/views/viewsurvey', {
              title: match.title,
              survey: match,
              surveyActive: match.active
            });
          }
        });
    }
  }
];

exports.generate_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'Generate Response Tokens',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId }, function(err, match) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/confirm', {
            title: 'Generate Response Tokens',
            error: 'An error occurred. Please try again later.'
          });
        } else if (!match) {
          res.render('../surveys/views/confirm', {
            title: 'Generate Response Tokens',
            error: 'The survey does not exist.'
          });
        } else if (match.responseType === 'Members') {
          res.render('../surveys/views/confirm', {
            title: 'Generate Response Tokens',
            error: 'This survey is set to be active for all website members.'
          });
        } else if (!match.active) {
          res.render('../surveys/views/confirm', {
            title: 'Generate Response Tokens',
            error: 'This survey is closed.'
          });
        } else {
          res.render('../surveys/views/generate', {
            title: 'Generate Response Tokens',
          });
        }
      });
    }
  }
];

exports.generate_post = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  // Tokens
  body('gZIPCode', 'Must be a positive integer.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 1, allow_leading_zeroes: false })
    .toInt(10)
    .custom(function(value, { req }) {
      return surveyModels.survey.findOne({ uuid: req.params.uuid, owner: req.session.loggedInAsId }).exec()
        .then(function(survey) {
          if (survey === null || survey === undefined) {
            return Promise.reject('An error occurred. Please try again later.');
          } else {
            return surveyModels.response.countDocuments({ surveyId: survey.uuid, owner: null }).exec()
              .then(function(tokens) {
                if (tokens === null || tokens === undefined) {
                  return Promise.reject('An error occurred. Please try again later.');
                } else if ((tokens + value) <= survey.maxTokens) {
                  return Promise.resolve();
                } else {
                  return Promise.reject('A maximum of ' + (survey.maxTokens - tokens) + ' tokens can be created.');
                }
              })
              .catch(function(err) {
                if (err && err instanceof mongoose.Error) {
                  winston.logger.error(err);
                  return Promise.reject('An error occurred. Please try again later.');
                } else {
                  return Promise.reject(err);
                }
              });
          }
        })
        .catch(function(err) {
          if (err && err instanceof mongoose.Error) {
            winston.logger.error(err);
            return Promise.reject('An error occurred. Please try again later.');
          } else {
            return Promise.reject(err);
          }
        });
    }),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('gPassword', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body', 'params'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['body', 'params'] });
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 1);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (errors.isEmpty() && pastTime) {
      const url = 'https://www.google.com/recaptcha/api/siteverify';
      const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                          'response=' + encodeURIComponent(data['g-recaptcha-response']);
      utils.postJSON(url, {}, requestData, (parsedJSON) => {
        if (parsedJSON.success === true &&
            parsedJSON.score >= 0.7 &&
            parsedJSON.action === 'submit' &&
            parsedJSON.hostname === req.hostname) {
          return true;
        }
        return Promise.reject('Failed reCAPTCHA test.');
      })
      .then((success) => {
        surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId }, function(err, match) {
          if (err) {
            handleGenerationError(err, 'An error occurred while generating the tokens. Please try again later.');
          } else if (!match) {
            handleGenerationError(null, 'An error occurred while generating the tokens. Please try again later.');
          } else if (match.responseType === 'Members') {
            handleGenerationError(null, 'This survey is set to be active for all website members.');
          } else if (!match.active) {
            handleGenerationError(null, 'This survey is closed.');
          } else {
            let responsePromises = []
            for (let i = 0; i < data.gZIPCode; i++) {
              let response = new surveyModels.response({
                uuid: uuidv4(),
                surveyId: match.uuid,
                owner: null,
                created: Date.now(),
                responded: null,
                active: true
              });
              responsePromises.push(response.save()
                .then(function(doc) {
                  return Promise.resolve(doc);
                })
                .catch(function(err) {
                  return Promise.reject();
                })
              );
            }
            Promise.all(responsePromises)
              .then(function() {
                res.redirect(BASEPATH + '/dashboard/' + data.uuid + '/generate/confirm');
              })
              .catch(function(err) {
                handleGenerationError(err, 'An error occurred while generating the tokens. Please try again later.');
              });
          }
        });
      })
      .catch(err => handleGenerationError(err, 'Failed reCAPTCHA test.'));
    } else {
      if (selected.gPassword || !pastTime) {
        handleGenerationError(JSON.stringify(selected), 'An error occurred while generating the tokens. Please try again later.');
      } else {
        res.render('../surveys/views/generate', {
          title: 'Generate Response Tokens',
          errors: errors.array(),
          selected: selected
        });
      }
    }
    function handleGenerationError(err, msg) {
      errors = errors.array();
      errors.push({
        param: 'generation',
        msg: msg
      });
      if (err) {
        winston.logger.error(err);
      }
      res.render('../surveys/views/generate', {
        title: 'Generate Response Tokens',
        selected: selected,
        errors: errors
      });
    }
  }
];

exports.close_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'Close Survey',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId }, function(err, match) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/confirm', {
            title: 'Close Survey',
            error: 'An error occurred. Please try again later.'
          });
        } else if (!match) {
          res.render('../surveys/views/confirm', {
            title: 'Close Survey',
            error: 'The survey does not exist.'
          });
        } else if (!match.active) {
          res.render('../surveys/views/confirm', {
            title: 'Close Survey',
            error: 'The survey is closed.'
          });
        } else {
          res.render('../surveys/views/closesurvey', {
            title: 'Close Survey',
          });
        }
      });
    }
  }
];

exports.close_post = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  // Delete
  body('cWebsite', 'Must be a boolean.')
    .trim()
    .escape()
    .isIn(['true', 'false'])
    .isBoolean()
    .toBoolean({ strict: true }),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('cZIPCode', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['params', 'body'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params', 'body'] });
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 0.5);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (errors.isEmpty() && pastTime) {
      const url = 'https://www.google.com/recaptcha/api/siteverify';
      const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                          'response=' + encodeURIComponent(data['g-recaptcha-response']);
      utils.postJSON(url, {}, requestData, (parsedJSON) => {
        if (parsedJSON.success === true &&
            parsedJSON.score >= 0.7 &&
            parsedJSON.action === 'submit' &&
            parsedJSON.hostname === req.hostname) {
          return true;
        }
        return Promise.reject('Failed reCAPTCHA test.');
      })
      .then((success) => {
        if (data.cWebsite) {
          surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId, active: true }, function(err, match) {
            if (err) {
              handleClosingError(err, 'An error occurred while closing. Please try again later.');
            } else if (!match) {
              handleClosingError(null, 'An error occurred while closing. Please try again later.');
            } else {
              surveyModels.response.find({ surveyId: data.uuid }).exec()
                .then(function(responses) {
                  let responsePromises = [];
                  for (response of responses) {
                    response.active = false;
                    responsePromises.push(response.save()
                      .then(function(doc) {
                        return Promise.resolve(doc);
                      })
                      .catch(function(err) {
                        return Promise.reject();
                      })
                    );
                  }
                  Promise.all(responsePromises)
                    .then(function() {
                      return Promise.resolve();
                    })
                    .catch(function(err) {
                      Promise.reject(err);
                    });
                })
                .then(function() {
                  match.active = false;
                  match.save(function(err, doc) {
                    if (err || !doc) {
                      handleClosingError(err, 'An error occurred while closing. Please try again later.');
                    } else {
                      res.redirect(BASEPATH + '/dashboard/' + data.uuid + '/close/confirm');
                    }
                  });
                })
                .catch(function(err) {
                  handleClosingError(err, 'An error occurred while closing. Please try again later.');
                });
            }
          });
        } else {
          res.redirect(BASEPATH + '/dashboard');
        }
      })
      .catch(function(err) {
        handleClosingError(err, err);
      });
    } else {
      if (selected.cZIPCode || !pastTime) {
        handleClosingError(JSON.stringify(selected), 'An error occurred while closing. Please try again later.');
      } else {
        res.render('../surveys/views/closesurvey', {
          title: 'Close Survey',
          errors: errors.array(),
          selected: selected
        });
      }
    }
    function handleClosingError(err, msg) {
      errors = errors.array();
      errors.push({
        param: 'closing',
        msg: msg
      });
      if (err) {
        winston.logger.error(err);
      }
      res.render('../surveys/views/closesurvey', {
        title: 'Close Survey',
        selected: selected,
        errors: errors
      });
    }
  }
];

exports.delete_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'Delete Survey',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId }, function(err, match) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/confirm', {
            title: 'Delete Survey',
            error: 'An error occurred. Please try again later.'
          });
        } else if (!match) {
          res.render('../surveys/views/confirm', {
            title: 'Delete Survey',
            error: 'The survey does not exist.'
          });
        } else {
          res.render('../surveys/views/deletesurvey', {
            title: 'Delete Survey',
          });
        }
      });
    }
  }
];

exports.delete_post = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  // Delete
  body('dPhone', 'Must be a boolean.')
    .trim()
    .escape()
    .isIn(['true', 'false'])
    .isBoolean()
    .toBoolean({ strict: true }),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('dEmail', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['params', 'body'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params', 'body'] });
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 0.5);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (errors.isEmpty() && pastTime) {
      const url = 'https://www.google.com/recaptcha/api/siteverify';
      const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                          'response=' + encodeURIComponent(data['g-recaptcha-response']);
      utils.postJSON(url, {}, requestData, (parsedJSON) => {
        if (parsedJSON.success === true &&
            parsedJSON.score >= 0.7 &&
            parsedJSON.action === 'submit' &&
            parsedJSON.hostname === req.hostname) {
          return true;
        }
        return Promise.reject('Failed reCAPTCHA test.');
      })
      .then((success) => {
        if (data.dPhone) {
          surveyModels.survey.findOneAndDelete({ uuid: data.uuid, owner: req.session.loggedInAsId }).exec()
            .then(function(match) {
              if (!match) {
                return Promise.reject(null);
              } else {
                return surveyModels.surveyQuestion.deleteMany({ surveyId: data.uuid }).exec();
              }
            })
            .then(function() {
              return surveyModels.response.deleteMany({ surveyId: data.uuid }).exec();
            })
            .then(function() {
              res.redirect(BASEPATH + '/dashboard/' + data.uuid + '/delete/confirm');
            })
            .catch(function(err) {
              handleDeletionError(err, 'An error occurred while deleting. Please try again later.');
            });
        } else {
          res.redirect(BASEPATH + '/dashboard');
        }
      })
      .catch(function(err) {
        handleDeletionError(err, err);
      });
    } else {
      if (selected.dEmail || !pastTime) {
        handleDeletionError(JSON.stringify(selected), 'An error occurred while deleting. Please try again later.');
      } else {
        res.render('../surveys/views/deletesurvey', {
          title: 'Delete Survey',
          errors: errors.array(),
          selected: selected
        });
      }
    }
    function handleDeletionError(err, msg) {
      errors = errors.array();
      errors.push({
        param: 'deletion',
        msg: msg
      });
      if (err) {
        winston.logger.error(err);
      }
      res.render('../surveys/views/deletesurvey', {
        title: 'Delete Survey',
        selected: selected,
        errors: errors
      });
    }
  }
];

exports.tokens_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/tokens', {
        title: 'Tokens',
        surveyId: req.params.uuid,
        error: 'No tokens found for this survey.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId }, function(err, match) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/tokens', {
            title: 'Tokens',
            surveyId: data.uuid,
            error: 'An error occurred while getting the tokens. Please try again later.'
          });
        } else if (!match) {
          res.render('../surveys/views/tokens', {
            title: 'Tokens',
            surveyId: data.uuid,
            error: 'No tokens found for this survey.'
          });
        } else {
          surveyModels.response.find({ surveyId: data.uuid })
            .sort({ created: 'desc' })
            .lean()
            .exec(function(err, responses) {
              if (err) {
                winston.logger.error(err);
                res.render('../surveys/views/tokens', {
                  title: 'Tokens',
                  surveyId: data.uuid,
                  error: 'An error occurred while getting the tokens. Please try again later.'
                });
              } else if (!responses || responses.length === 0) {
                res.render('../surveys/views/tokens', {
                  title: 'Tokens',
                  surveyId: data.uuid,
                  error: 'No tokens found for this survey.'
                });
              } else {
                for (let response of responses) {
                  if (response.created) {
                    let formattedCreated = utils.getDateTime(req.signedCookies.TD, response.created);
                    if (formattedCreated.timeZoneName) {
                      response.created = formattedCreated.dateString + ' ' + 
                                         formattedCreated.timeString + ' (' + 
                                         formattedCreated.timeZoneName + ')';
                    } else {
                      response.created = formattedCreated.dateString + ' ' + formattedCreated.timeString;
                    }
                  }
                  if (response.responded) {
                    let formattedResponded = utils.getDateTime(req.signedCookies.TD, response.responded);
                    if (formattedResponded.timeZoneName) {
                      response.responded = formattedResponded.dateString + ' ' + 
                                           formattedResponded.timeString + ' (' + 
                                           formattedResponded.timeZoneName + ')';
                    } else {
                      response.responded = formattedResponded.dateString + ' ' + formattedResponded.timeString;
                    }
                  }
                }
                res.render('../surveys/views/tokens', {
                  title: 'Tokens',
                  surveyId: data.uuid,
                  survey: match,
                  responses: responses
                });
              }
            });
        }
      });
    }
  }
];

exports.results_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'Survey Results',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, owner: req.session.loggedInAsId })
        .populate('questions')
        .exec(function(err, survey) {
          if (err) {
            winston.logger.error(err);
            res.render('../surveys/views/confirm', {
              title: 'Survey Results',
              error: 'An error occurred while getting the results. Please try again later.'
            });
          } else if (!survey) {
            res.render('../surveys/views/confirm', {
              title: 'Survey Results',
              error: 'The survey does not exist.'
            });
          } else {
            surveyModels.response.find({ surveyId: data.uuid }, function(err, responses) {
              if (err) {
                winston.logger.error(err);
                res.render('../surveys/views/confirm', {
                  title: 'Survey Results',
                  error: 'An error occurred while getting the results. Please try again later.'
                });
              } else if (!responses) {
                res.render('../surveys/views/confirm', {
                  title: 'Survey Results',
                  error: 'The survey does not exist.'
                });
              } else {
                let results = [], percentages = [], averages = [];
                for (let i = 0; i < survey.questions.length; i++) {
                  if (survey.questions[i].promptType === 'Textbox') {
                    results[i] = new Array(0);
                    responses.forEach(el => results[i].push(el.responses[i]));
                  } else if (survey.questions[i].promptType === 'Rating') {
                    results[i] = new Array(5).fill(0);
                    if (responses.length > 0) {
                      responses.forEach(el => results[i][el.responses[i] - 1]++);
                    }
                  } else if (survey.questions[i].promptType === 'YesNo') {
                    results[i] = new Array(2).fill(0);
                    if (responses.length > 0) {
                      responses.forEach(el => (el.responses[i] === 1) ? results[i][1]++ : 
                        ((el.responses[i] === 0) ? results[i][0]++ : 0));
                    }
                  }
                }
                for (let i = 0; i < survey.questions.length; i++) {
                  if (survey.questions[i].promptType === 'Textbox') {
                    percentages[i] = null;
                    averages[i] = null;
                  } else if (survey.questions[i].promptType === 'Rating' ||
                             survey.questions[i].promptType === 'YesNo') {
                    percentages[i] = [];
                    let total = (results[i].every(el => el === 0)) ? 1 : results[i].reduce((a, b) => a + b, 0);
                    results[i].forEach(el => percentages[i].push((el / total * 100).toFixed(2)));
                    if (survey.questions[i].promptType === 'Rating') {
                      averages[i] = (results[i].reduce((acc, val, ind) => acc + ((ind + 1) * val), 0) / total).toFixed(2);
                    } else {
                      averages[i] = (results[i].reduce((acc, val, ind) => acc + (ind * val), 0) / total).toFixed(2);
                    }
                  }
                }
                res.render('../surveys/views/results', {
                  title: 'Survey Results',
                  survey: survey,
                  responses: results,
                  percentages: percentages,
                  averages: averages
                });
              }
            });
          }
        });
    }
  }
];

exports.token_uuid_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'View Survey',
        error: 'The token does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.response.findOne({ uuid: data.uuid }, function(err, response) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/confirm', {
            title: 'View Survey',
            error: 'An error occurred while getting the survey. Please try again later.'
          });
        } else if (!response) {
          res.render('../surveys/views/confirm', {
            title: 'View Survey',
            error: 'The token does not exist.'
          });
        } else {
          surveyModels.survey.findOne({ uuid: response.surveyId })
            .populate('questions')
            .exec(function(err, survey) {
              if (err) {
                winston.logger.error(err);
                res.render('../surveys/views/confirm', {
                  title: 'View Survey',
                  error: 'An error occurred while getting the survey. Please try again later.'
                });
              } else if (!survey) {
                res.render('../surveys/views/confirm', {
                  title: 'View Survey',
                  error: 'The token does not exist.'
                });
              } else if (!survey.active) {
                res.render('../surveys/views/viewsurvey', {
                  title: survey.title,
                  active: response.active,
                  surveyActive: survey.active
                });
              } else {
                res.render('../surveys/views/viewsurvey', {
                  title: survey.title,
                  active: response.active,
                  surveyActive: survey.active,
                  survey: survey,
                  selected: response.responses
                });
              }
            });
        }
      });
    }
  }
];

exports.token_uuid_post = [
  function(req, res, next) {
    const ratings = (req.body.sRating) ? req.body.sRating.map(el => (Array.isArray(el)) ? el[1] : '0') : null;
    const yesNos = (req.body.sYesNo) ? req.body.sYesNo.map(el => (Array.isArray(el)) ? el[1] : '-1') : null;
    req.body.sRating = ratings;
    req.body.sYesNo = yesNos;
    next();
  },
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  body('sTextbox.*', 'Must be less than 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!, and spaces.')
    .trim()
    .isLength({ max: 150 })
    .matches(/^[A-Za-z0-9\-\.\?!,\s]*$/)
    .whitelist('A-Za-z0-9\-\.\?!,\\s')
    .escape(),
  body('sRating.*', 'Must be an integer from 1 to 5.')
    .trim()
    .escape()
    .notEmpty()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 1, max: 5 })
    .toInt(10),
  body('sYesNo.*', 'Must be yes or no.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 0, max: 1 })
    .toInt(10),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('sUsername', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body', 'params'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['body', 'params'] });
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 1);
    const surveyIdError = errors.array().find(el => el.param === 'uuid');
    if (surveyIdError) {
      res.render('../surveys/views/confirm', {
        title: 'View Survey',
        error: 'The token does not exist.'
      });
    } else {
      surveyModels.response.findOne({ uuid: data.uuid }, function(err, response) {
        if (err) {
          winston.logger.error(err);
          res.render('../surveys/views/confirm', {
            title: 'View Survey',
            error: 'An error occurred while saving the response. Please try again later.'
          });
        } else if (!response) {
          res.render('../surveys/views/confirm', {
            title: 'View Survey',
            error: 'The token does not exist.'
          });
        } else {
          surveyModels.survey.findOne({ uuid: response.surveyId })
            .populate(['owner', 'questions'])
            .exec(function(err, survey) {
              if (err) {
                winston.logger.error(err);
                res.render('../surveys/views/confirm', {
                  title: 'View Survey',
                  error: 'An error occurred while saving the response. Please try again later.'
                });
              } else if (!survey) {
                res.render('../surveys/views/confirm', {
                  title: 'View Survey',
                  error: 'The token does not exist.'
                });
              } else if (!response.active || !survey.active) {
                res.render('../surveys/views/viewsurvey', {
                  title: survey.title,
                  active: response.active,
                  surveyActive: survey.active
                });
              } else {
                const url = 'https://www.google.com/recaptcha/api/siteverify';
                const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                                    'response=' + encodeURIComponent(data['g-recaptcha-response']);
                utils.postJSON(url, {}, requestData, (parsedJSON) => {
                  if (parsedJSON.success === true &&
                      parsedJSON.score >= 0.7 &&
                      parsedJSON.action === 'submit' &&
                      parsedJSON.hostname === req.hostname) {
                    return true;
                  }
                  return Promise.reject('Failed reCAPTCHA test.');
                })
                .then((success) => {
                  if (!errors.isEmpty() || !pastTime) {
                    errors = errors.array();
                    const allData = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body'] });
                    selected = [];
                    let indexedErrors = [];
                    let tIndex = 0, rIndex = 0, yIndex = 0;
                    for (const el of survey.questions) {
                      if (el.promptType === 'Textbox') {
                        selected.push(allData.sTextbox[tIndex]);
                        indexedErrors.push(errors.find(el => el.param === ('sTextbox[' + tIndex + ']')));
                        tIndex++;
                      } else if (el.promptType === 'Rating') {
                        selected.push(allData.sRating[rIndex]);
                        indexedErrors.push(errors.find(el => el.param === ('sRating[' + rIndex + ']')));
                        rIndex++;
                      } else if (el.promptType === 'YesNo') {
                        selected.push(allData.sYesNo[yIndex]);
                        indexedErrors.push(errors.find(el => el.param === ('sYesNo[' + yIndex + ']')));
                        yIndex++;
                      } else {
                        indexedErrors.push(null);
                      }
                    }
                    if (allData.sUsername || !pastTime) {
                      winston.logger.error(JSON.stringify(allData));
                      res.render('../surveys/views/viewsurvey', {
                        title: survey.title,
                        active: response.active,
                        surveyActive: survey.active,
                        survey: survey,
                        selected: selected,
                        errors: indexedErrors,
                        error: 'An error occurred while saving the response. Please try again later.'
                      });
                    } else {
                      res.render('../surveys/views/viewsurvey', {
                        title: survey.title,
                        active: response.active,
                        surveyActive: survey.active,
                        survey: survey,
                        selected: selected,
                        errors: indexedErrors
                      });
                    }
                  } else {
                    let orderedData = [];
                    let tIndex = 0, rIndex = 0, yIndex = 0;
                    for (const el of survey.questions) {
                      if (el.promptType === 'Textbox') {
                        orderedData.push(data.sTextbox[tIndex]);
                        tIndex++;
                      } else if (el.promptType === 'Rating') {
                        orderedData.push(data.sRating[rIndex]);
                        rIndex++;
                      } else if (el.promptType === 'YesNo') {
                        orderedData.push(data.sYesNo[yIndex]);
                        yIndex++;
                      } 
                    }
                    response.responded = Date.now();
                    response.active = false;
                    response.responses = orderedData;
                    survey.responsesCompleted++;
                    accountModels.user.findById(survey.owner).exec()
                      .then(function(user) {
                        return accountModels.userLevel.findOne({ user: survey.owner }).exec();
                      })
                      .then(function(userLevel) {
                        userLevel.experience++;
                        return userLevel.save();
                      })
                      .then(function() {
                        return survey.save();
                      })
                      .then(function() {
                        return response.save();
                      })
                      .then(function() {
                        res.redirect(BASEPATH + '/token/view/confirm');
                      })
                      .catch(function(err) {
                        winston.logger.error(err);
                        res.render('../surveys/views/viewsurvey', {
                          title: survey.title,
                          active: true,
                          surveyActive: survey.active,
                          survey: survey,
                          selected: orderedData,
                          errors: null,
                          error: 'An error occurred while saving the response. Please try again later.'
                        });
                      });
                  }
                })
                .catch(function(err) {
                  winston.logger.error(err);
                  res.render('../surveys/views/viewsurvey', {
                    title: survey.title,
                    active: true,
                    surveyActive: survey.active,
                    survey: survey,
                    selected: selected,
                    errors: null,
                    error: err
                  });
                });
              }
            });
        }
      })
    }
  }
];

exports.survey_response_get = [
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  function(req, res, next) {
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (!errors.isEmpty()) {
      res.render('../surveys/views/confirm', {
        title: 'View Survey',
        error: 'The survey does not exist.'
      });
    } else {
      let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['params'] });
      surveyModels.survey.findOne({ uuid: data.uuid, responseType: 'Members' })
        .populate('questions')
        .exec(function(err, survey) {
          if (err) {
            winston.logger.error(err);
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'An error occurred while getting the survey. Please try again later.'
            });
          } else if (!survey) {
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'The survey does not exist.'
            });
          } else if (!survey.active) {
            res.render('../surveys/views/viewsurvey', {
              title: survey.title,
              active: true,
              surveyActive: survey.active,
            });
          } else {
            accountModels.user.findById(req.session.loggedInAsId).exec()
              .then(function(user) {
                return surveyModels.response.findOne({ surveyId: survey.uuid, owner: user._id }).exec();
              })
              .then(function(existingResponse) {
                if (existingResponse) {
                  res.render('../surveys/views/confirm', {
                    title: survey.title,
                    error: 'You already responded to this survey.'
                  });
                } else {
                  res.render('../surveys/views/viewsurvey', {
                    title: survey.title,
                    active: true,
                    surveyActive: survey.active,
                    survey: survey
                  });
                }
              })
              .catch(function(err) {
                winston.logger.error(err);
                res.render('../surveys/views/confirm', {
                  title: survey.title,
                  error: 'An error occurred while getting the survey. Please try again later.'
                });
              });
          }
        });
    }
  }
];

exports.survey_response_post = [
  function(req, res, next) {
    const ratings = (req.body.sRating) ? req.body.sRating.map(el => (Array.isArray(el)) ? el[1] : '0') : null;
    const yesNos = (req.body.sYesNo) ? req.body.sYesNo.map(el => (Array.isArray(el)) ? el[1] : '-1') : null;
    req.body.sRating = ratings;
    req.body.sYesNo = yesNos;
    next();
  },
  param('uuid', 'Invalid UUID.')
    .trim()
    .isLength({ min: 36, max: 36 })
    .matches(/^[A-Fa-f0-9\-]{36}$/)
    .whitelist('A-Fa-f0-9\-')
    .escape(),
  body('sTextbox.*', 'Must be less than 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!, and spaces.')
    .trim()
    .isLength({ max: 150 })
    .matches(/^[A-Za-z0-9\-\.\?!,\s]*$/)
    .whitelist('A-Za-z0-9\-\.\?!,\\s')
    .escape(),
  body('sRating.*', 'Must be an integer from 1 to 5.')
    .trim()
    .escape()
    .notEmpty()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 1, max: 5 })
    .toInt(10),
  body('sYesNo.*', 'Must be yes or no.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 0, max: 1 })
    .toInt(10),
  body('time', 'Invalid value.')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt()
    .toInt(10),
  body('sUsername', 'Invalid value.')
    .trim()
    .escape()
    .isEmpty(),
  body('g-recaptcha-response', 'Failed reCAPTCHA test.')
    .trim()
    .escape()
    .matches(/^[A-Za-z0-9_\-]+$/),
  function(req, res, next) {
    let selected = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body', 'params'] });
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['body', 'params'] });
    let errors = validationResult(req);
    let pastTime = utils.pastTimeFrame(data.time, 1);
    const surveyIdError = errors.array().find(el => el.param === 'uuid');
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.redirect('/website/account/login');
    } else if (surveyIdError) {
      res.render('../surveys/views/confirm', {
        title: 'View Survey',
        error: 'The survey does not exist.'
      });
    } else {
      surveyModels.survey.findOne({ uuid: data.uuid, responseType: 'Members' })
        .populate(['owner', 'questions'])
        .exec(function(err, survey) {
          if (err) {
            winston.logger.error(err);
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'An error occurred while saving the response. Please try again later.'
            });
          } else if (!survey) {
            res.render('../surveys/views/confirm', {
              title: 'View Survey',
              error: 'The survey does not exist.'
            });
          } else if (!survey.active) {
            res.render('../surveys/views/viewsurvey', {
              title: survey.title,
              active: true,
              surveyActive: survey.active,
            });
          } else {
            accountModels.user.findById(req.session.loggedInAsId, function(err, user) {
              if (err) {
                winston.logger.error(err);
                res.render('../surveys/views/confirm', {
                  title: survey.title,
                  error: 'An error occurred while saving the response. Please try again later.'
                });
              } else {
                surveyModels.response.findOne({ surveyId: survey.uuid, owner: user._id }, function(err, existingResponse) {
                  if (err) {
                    winston.logger.error(err);
                    res.render('../surveys/views/confirm', {
                      title: survey.title,
                      error: 'An error occurred while saving the response. Please try again later.'
                    });
                  } else if (existingResponse) {
                    res.render('../surveys/views/confirm', {
                      title: survey.title,
                      error: 'You already responded to this survey.'
                    });
                  } else {
                    const url = 'https://www.google.com/recaptcha/api/siteverify';
                    const requestData = 'secret=' + encodeURIComponent(process.env.RECAPTCHA_SECRET_KEY) + '&' +
                                        'response=' + encodeURIComponent(data['g-recaptcha-response']);
                    utils.postJSON(url, {}, requestData, (parsedJSON) => {
                      if (parsedJSON.success === true &&
                          parsedJSON.score >= 0.7 &&
                          parsedJSON.action === 'submit' &&
                          parsedJSON.hostname === req.hostname) {
                        return true;
                      }
                      return Promise.reject('Failed reCAPTCHA test.');
                    })
                    .then((success) => {
                      let response = new surveyModels.response({
                        uuid: uuidv4(),
                        surveyId: survey.uuid,
                        owner: user._id,
                        created: Date.now(),
                        responded: true,
                        active: false
                      });
                      if (!errors.isEmpty() || !pastTime) {
                        errors = errors.array();
                        const allData = matchedData(req, { includeOptionals: true, onlyValidData: false, locations: ['body'] });
                        selected = [];
                        let indexedErrors = [];
                        let tIndex = 0, rIndex = 0, yIndex = 0;
                        for (const el of survey.questions) {
                          if (el.promptType === 'Textbox') {
                            selected.push(allData.sTextbox[tIndex]);
                            indexedErrors.push(errors.find(el => el.param === ('sTextbox[' + tIndex + ']')));
                            tIndex++;
                          } else if (el.promptType === 'Rating') {
                            selected.push(allData.sRating[rIndex]);
                            indexedErrors.push(errors.find(el => el.param === ('sRating[' + rIndex + ']')));
                            rIndex++;
                          } else if (el.promptType === 'YesNo') {
                            selected.push(allData.sYesNo[yIndex]);
                            indexedErrors.push(errors.find(el => el.param === ('sYesNo[' + yIndex + ']')));
                            yIndex++;
                          } else {
                            indexedErrors.push(null);
                          }
                        }
                        if (allData.sUsername || !pastTime) {
                          winston.logger.error(JSON.stringify(allData));
                          res.render('../surveys/views/viewsurvey', {
                            title: survey.title,
                            active: true,
                            surveyActive: survey.active,
                            survey: survey,
                            selected: selected,
                            errors: indexedErrors,
                            error: 'An error occurred while saving the response. Please try again later.'
                          });
                        } else {
                          res.render('../surveys/views/viewsurvey', {
                            title: survey.title,
                            active: true,
                            surveyActive: survey.active,
                            survey: survey,
                            selected: selected,
                            errors: indexedErrors
                          });
                        }
                      } else {
                        let orderedData = [];
                        let tIndex = 0, rIndex = 0, yIndex = 0;
                        for (const el of survey.questions) {
                          if (el.promptType === 'Textbox') {
                            orderedData.push(data.sTextbox[tIndex]);
                            tIndex++;
                          } else if (el.promptType === 'Rating') {
                            orderedData.push(data.sRating[rIndex]);
                            rIndex++;
                          } else if (el.promptType === 'YesNo') {
                            orderedData.push(data.sYesNo[yIndex]);
                            yIndex++;
                          } 
                        }
                        response.responded = Date.now();
                        response.active = false;
                        response.responses = orderedData;
                        survey.responsesCompleted++;
                        accountModels.user.findById(survey.owner).exec()
                          .then(function(user) {
                            return accountModels.userLevel.findOne({ user: survey.owner }).exec();
                          })
                          .then(function(userLevel) {
                            userLevel.experience++;
                            return userLevel.save();
                          })
                          .then(function() {
                            return survey.save();
                          })
                          .then(function() {
                            return response.save();
                          })
                          .then(function() {
                            res.redirect(BASEPATH + '/survey/view/confirm');
                          })
                          .catch(function(err) {
                            winston.logger.error(err);
                            res.render('../surveys/views/viewsurvey', {
                              title: survey.title,
                              active: true,
                              surveyActive: survey.active,
                              survey: survey,
                              selected: orderedData,
                              errors: null,
                              error: 'An error occurred while saving the response. Please try again later.'
                            });
                          });
                      }
                    })
                    .catch(function(err) {
                      winston.logger.error(err);
                      res.render('../surveys/views/viewsurvey', {
                        title: survey.title,
                        active: true,
                        surveyActive: survey.active,
                        survey: survey,
                        selected: selected,
                        errors: null,
                        error: err
                      });
                    });
                  }
                });
              }
            });
          }
        });
    }
  }
];
