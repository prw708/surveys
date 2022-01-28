window.addEventListener("load", surveySetup, false);

function surveySetup() {
  // Setup create survey form
  var createSurveyForm = document.getElementById("3-19-form");
  if (createSurveyForm) {
    var addSurveyItem = document.getElementById("sAddSurveyItemBtn");
    var removeSurveyItem = document.getElementById("sRemoveSurveyItemBtn");
    addSurveyItem.addEventListener("click", addSurveyItemHandler, false);
    removeSurveyItem.addEventListener("click", removeSurveyItemHandler, false);
  }
}
