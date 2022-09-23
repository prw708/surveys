const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let SurveyQuestionSchema = new Schema({
  surveyId: { type: String, required: true },
  promptType: { type: String, required: true, enum: ['Textbox', 'Rating', 'YesNo'] },
  promptText: { type: String, required: true, minlength: 1, maxlength: 150 }
});

let SurveySchema = new Schema({
  uuid: { type: String, required: true, index: true, unique: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  created: { type: Date, default: Date.now() },
  title: { type: String, required: true, minlength: 1, maxlength: 50 },
  description: { type: String, required: false, minlength: 0, maxlength: 150 },
  questions: [{ type: Schema.Types.ObjectId, ref: 'SurveyQuestion' }],
  active: { type: Boolean, required: true },
  responseType: { type: String, required: true, enum: ['Tokens', 'Members'] },
  responsesCompleted: { type: Number },
  maxTokens: { type: Number, required: true }
});

let ResponseSchema = new Schema({
  uuid: { type: String, required: true, index: true, unique: true },
  surveyId: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  created: { type: Date, default: Date.now() },
  responded: { type: Date },
  active: { type: Boolean, required: true },
  responses: [ Schema.Types.Mixed ]
});

module.exports = {
  survey: SurveySchema,
  surveyQuestion: SurveyQuestionSchema,
  response: ResponseSchema
};
