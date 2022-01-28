const { body, param, query, matchedData, validationResult } = require('express-validator');

const cookieOptions = require('../../scripts/cookieOptions');
const utils = require('../../scripts/utilities');
const winston = require('../../scripts/log');

const mongoose = require('mongoose');
const surveyModels = require('../models.js');
const accountModels = require('../../account/models.js');

const BASEPATH = '/projects/surveys';

exports.all_get = function(req, res, next) {
  res.locals.basepath = BASEPATH;
  let cumulative = BASEPATH;
  let path = req.originalUrl.replace(BASEPATH, '').replace(/\?.*$/, '').split('/');
  path = path.filter(el => el !== '');
  let breadcrumbs = [{ name: 'surveys home', path: cumulative }];
  for (const item of path) {
    if (cumulative.charAt(cumulative.length - 1) === '/') {
      cumulative += item;
    } else {
      cumulative += '/' + item;
    }
    breadcrumbs.push({ name: item, path: cumulative });
  }
  res.locals.breadcrumbs = breadcrumbs;
  if (breadcrumbs.length >= 2) {
    res.locals.upOneLevel = breadcrumbs[breadcrumbs.length - 2].path;
  } else {
    res.locals.upOneLevel = breadcrumbs[0].path;
  }
  next();
};

exports.surveys_home_get = [
  query('p', 'Invalid value')
    .trim()
    .escape()
    .isNumeric({ no_symbols: true })
    .isInt({ min: 1, max: 100 })
    .toInt(10),
  function(req, res, next) {
    let data = matchedData(req, { includeOptionals: true, onlyValidData: true, locations: ['query'] });
    let errors = validationResult(req);
    if (!req.session.loggedInAs || !req.session.loggedInAsId) {
      res.render('../surveys/views/surveyshome', {
        title: 'Survey Generator'
      });
    } else {
      let page = 0, pageSize = 9, viewable = 2, pages, start, end;
      if (errors.isEmpty()) {
        page = data.p - 1;
      }
      surveyModels.survey.find({ active: true, responseType: 'Members' }).countDocuments().exec()
        .then(function(documents) {
          pages = new Array(Math.ceil(documents / pageSize));
          pages = pages.fill(1);
          pages = pages.map((curr, index) => { return index + 1; });
          if (pages[pages.length - 1] - pages[page] < viewable) {
            end = (pages[pages.length - 1] - pages[page]) + pages[page];
          } else {
            end = pages[page] + viewable;
          }
          if (pages[page] - pages[0] < viewable) {
            start = pages[page] - (pages[page] - pages[0]);
          } else {
            start = pages[page] - viewable;
          }
          pages = pages.slice((start - 1), end);
          return surveyModels.survey.find({ active: true, responseType: 'Members' })
            .sort({ created: 'desc' })
            .skip(page * pageSize)
            .limit(pageSize)
            .lean()
            .exec();
        })
        .then(function(surveys) {
          for (survey of surveys) {
            let surveyCreatedTime = utils.getDateTime(req.signedCookies.TD, survey.created);
            let surveyMilliseconds = Date.UTC(
              surveyCreatedTime.year,
              surveyCreatedTime.month - 1,
              surveyCreatedTime.day,
              surveyCreatedTime.hour,
              surveyCreatedTime.minute,
              surveyCreatedTime.second
            );
            let currentTime = utils.getDateTime(req.signedCookies.TD);
            let currentMilliseconds = Date.UTC(
              currentTime.year,
              currentTime.month - 1,
              currentTime.day,
              currentTime.hour,
              currentTime.minute,
              currentTime.second
            );
            survey.created = utils.getTimeAgo(currentMilliseconds, surveyMilliseconds);
          }
          res.render('../surveys/views/surveyshome', {
            title: 'Survey Generator',
            surveys: surveys,
            pages: pages,
            currentPage: page + 1,
            startPage: start,
            endPage: end
          });
        })
        .catch(function(err) {
          if (err) {
            winston.logger.error(err);
          }
          res.render('../surveys/views/surveyshome', {
            title: 'Survey Generator',
            error: 'An error occurred getting the data. Please try again later.'
          });
        });
    }
  }
];

exports.surveys_dashboard_get = function(req, res, next) {
  surveyModels.survey.find({ owner: req.session.loggedInAsId })
    .sort({ created: 'desc' })
    .lean()
    .exec(function(err, surveys) {
      if (err) {
        winston.logger.error(err);
      }
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
    });
};

exports.create_confirm_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'Create Survey',
      success: 'Survey created successfully!',
      error: null,
      back: 2
    });
  }
};

exports.generate_confirm_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'Generate Response Tokens',
      success: 'Response tokens generated!',
      error: null,
      back: 2
    });
  }
};

exports.close_confirm_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'Close Survey',
      success: 'The survey has been closed.',
      error: null,
      back: 2
    });
  }
};

exports.delete_confirm_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'Delete Survey',
      success: 'The survey has been deleted.',
      error: null,
      back: 2
    });
  }
};

exports.token_uuid_confirm_get = function(req, res, next) {
  res.render('../surveys/views/confirm', {
    title: 'View Survey',
    success: 'Survey response submitted successfully!',
    error: null,
    back: 2
  });
};

exports.survey_response_confirm_get = function(req, res, next) {
  if (!req.session.loggedInAs || !req.session.loggedInAsId) {
    res.redirect('/website/account/login');
  } else {
    res.render('../surveys/views/confirm', {
      title: 'View Survey',
      success: 'Survey response submitted successfully!',
      error: null,
      back: 2
    });
  }
};
