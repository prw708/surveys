import { addClass, removeClass, hasClass } from '../../static/js/utils';
import { everyArrayElement } from './utils';

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

function addSurveyItemHandler() {
  var form = document.getElementById("3-19-form");
  var itemType = null;
  for (var i = 0; i < form.elements["sAddItem"].length; i++) {
    if (form.elements["sAddItem"][i].checked) {
      itemType = form.elements["sAddItem"][i].value;
    }
  }
  var maxItems = parseInt(event.target.getAttribute("data-maxItems"), 10);
  var itemIndex = (form.elements.length - 14) / 2;
  var itemDiv, itemPromptDiv, itemPromptRadio, itemPromptRadioLabel, itemPromptTextarea;
  if (!itemType || (itemIndex + 1) > maxItems) {
    return false;
  } else if (itemType.toLowerCase() === 'textbox' ||
             itemType.toLowerCase() === 'rating' ||
             itemType.toLowerCase() === 'yesno') {
    itemDiv = document.createElement("div");
    itemDiv.className = "mb-4";
    itemPromptDiv = document.createElement("div");
    addClass(itemPromptDiv, "form-check");
    addClass(itemPromptDiv, "mb-2");
    itemPromptRadio = document.createElement("input");
    addClass(itemPromptRadio, "form-check-input");
    itemPromptRadio.setAttribute("type", "radio");
    itemPromptRadio.id = "sRadioItem" + itemIndex;
    itemPromptRadio.setAttribute("name", "sRadioItem[" + itemIndex + "]");
    itemPromptRadio.checked = true;
    itemPromptRadioLabel = document.createElement("label");
    addClass(itemPromptRadioLabel, "form-check-label");
    itemPromptRadioLabel.setAttribute("for", "sRadioItem" + itemIndex);
    itemPromptTextarea = document.createElement("textarea");
    addClass(itemPromptTextarea, "form-control");
    itemPromptTextarea.id = "sItem" + itemIndex;
    itemPromptTextarea.setAttribute("name", "sItem[" + itemIndex + "]");
    itemPromptTextarea.setAttribute("rows", "2");
    itemPromptTextarea.setAttribute("maxlength", "150");
  }
  if (itemType.toLowerCase() === 'textbox') {
    itemPromptRadio.value = "Textbox";
    itemPromptRadioLabel.textContent = "Textbox Prompt #" + (itemIndex + 1).toString();
  } else if (itemType.toLowerCase() === 'rating') {
    itemPromptRadio.value = "Rating";
    itemPromptRadioLabel.textContent = "Rating Prompt #" + (itemIndex + 1).toString();
  } else if (itemType.toLowerCase() === 'yesno') {
    itemPromptRadio.value = "YesNo";
    itemPromptRadioLabel.textContent = "Yes/No Prompt #" + (itemIndex + 1).toString();
  }
  itemPromptDiv.appendChild(itemPromptRadio);
  itemPromptDiv.appendChild(itemPromptRadioLabel);
  itemDiv.appendChild(itemPromptDiv);
  itemDiv.appendChild(itemPromptTextarea);
  var editItemHeader = document.getElementById("EditSurveyItem");
  editItemHeader.textContent = "Survey Items (" + (maxItems - (itemIndex + 1)).toString() + ")";
  form.insertBefore(itemDiv, editItemHeader.parentNode);
}

function removeSurveyItemHandler() {
  var form = document.getElementById("3-19-form");
  var maxItems = parseInt(event.target.getAttribute("data-maxItems"), 10);
  var itemIndex = (form.elements.length - 14) / 2;
  if ((itemIndex - 1) < 0) {
    return false;
  }
  var lastItem = document.getElementById("sItem" + (itemIndex - 1).toString()).parentNode;
  form.removeChild(lastItem);
  var editItemHeader = document.getElementById("EditSurveyItem");
  editItemHeader.textContent = "Survey Items (" + (maxItems - (itemIndex - 1)).toString() + ")";
}

function createSurveyFormHandler() {
  var form = document.getElementById("3-19-form");
  var itemIndex = (form.elements.length - 14) / 2;
  var titleName = "sWebsite";
  var descriptionName = "sAddress";
  var responsesName = "sLastName";
  var titleValue = form.elements[titleName].value;
  var descriptionValue = form.elements[descriptionName].value;
  var responsesValue = null;
  for (var i = 0; i < form.elements[responsesName].length; i++) {
    if (form.elements[responsesName][i].checked) {
      responsesValue = form.elements[responsesName][i].value;
      break;
    }
  }
  var itemValues = [], radioValues = [];
  for (var i = 0; i < itemIndex; i++) {
    itemValues[i] = form.elements["sItem" + i].value;
    radioValues[i] = form.elements["sRadioItem" + i].value;
  }
  var testTitle = titleValue.length > 0 && titleValue.length < 50;
  testTitle = testTitle && /^[A-Za-z0-9 \-\.\?,!'"]+$/.test(titleValue);
  var testDescription = descriptionValue.length < 150;
  testDescription = testDescription && /^[A-Za-z0-9\-\.\?!,'"\s]*$/.test(descriptionValue);
  var testResponses = responsesValue && responsesValue.length > 0 && responsesValue.length < 50;
  testResponses = testResponses && /^[A-Za-z0-9 \-]+$/.test(responsesValue);
  var testValues = [], testRadios = [];
  for (var i = 0; i < itemValues.length; i++) {
    testValues[i] = itemValues[i].length > 0 && itemValues[i].length < 150;
    testValues[i] = testValues[i] && /^[A-Za-z0-9\-\.\?!,'"\s]+$/.test(itemValues[i]);
    testRadios[i] = radioValues[i] === "Textbox" || radioValues[i] === "Rating" || radioValues[i] === "YesNo";
  }
  if (document.getElementById("sErrorDiv")) {
    document.querySelector("header.row.p-4.g-0").parentNode.removeChild(document.getElementById("sErrorDiv"));
  }
  if (!testTitle ||
      !testDescription ||
      !testResponses ||
      !everyArrayElement(testValues, true) ||
      !everyArrayElement(testRadios, true)) {
    window.scrollTo(0,0);
    if (!document.getElementById("sErrorDiv")) {
      var errorDiv = document.createElement("div");
      errorDiv.id = "sErrorDiv";
      errorDiv.className = "alert alert-danger px-4 mb-0";
      errorDiv.textContent = "There are errors marked below:";
      document.querySelector("header.row.p-4.g-0").parentNode.appendChild(errorDiv);
    }
  }
  if (!testTitle) {
    if (!hasClass(form.elements[titleName], "is-invalid")) {
      addClass(form.elements[titleName], "is-invalid");
      var error = document.createElement("div");
      error.id = titleName + "InputFeedback";
      addClass(error, "invalid-feedback");
      error.textContent = "Must be between 1 to 50 characters. Can contain A-Z, a-z, 0-9, ,-.?!\"', and spaces.";
      form.elements[titleName].setAttribute("aria-describedby", titleName + "InputFeedback");
      form.elements[titleName].parentNode.appendChild(error);
    }
  } else {
    form.elements[titleName].removeAttribute("aria-describedby");
    removeClass(form.elements[titleName], "is-invalid");
    if (document.getElementById(titleName + "InputFeedback")) {
      document.getElementById(titleName + "InputFeedback").parentNode.removeChild(
        document.getElementById(titleName + "InputFeedback")
      );
    }
  }
  if (!testDescription) {
    if (!hasClass(form.elements[descriptionName], "is-invalid")) {
      addClass(form.elements[descriptionName], "is-invalid");
      var error = document.createElement("div");
      error.id = descriptionName + "InputFeedback";
      addClass(error, "invalid-feedback");
      error.textContent = "Must be less than 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!\"', and spaces.";
      form.elements[descriptionName].setAttribute("aria-describedby", descriptionName + "InputFeedback");
      form.elements[descriptionName].parentNode.appendChild(error);
    }
  } else {
    form.elements[descriptionName].removeAttribute("aria-describedby");
    removeClass(form.elements[descriptionName], "is-invalid");
    if (document.getElementById(descriptionName + "InputFeedback")) {
      document.getElementById(descriptionName + "InputFeedback").parentNode.removeChild(
        document.getElementById(descriptionName + "InputFeedback")
      );
    }
  }
  var responseRadios = form.elements[responsesName];
  if (!testResponses) {
    for (var i = 0; i < responseRadios.length; i++) {
      var itemId = "sLastName[" + i + "]";
      if (!hasClass(responseRadios[i], "is-invalid")) {
        addClass(responseRadios[i], "is-invalid");
        if (i === responseRadios.length - 1) {
          var divContainer = document.createElement("div");
          var span = document.createElement("span");
          addClass(span, "is-invalid");
          var error = document.createElement("div");
          error.id = itemId + "InputFeedback";
          addClass(error, "invalid-feedback");
          error.textContent = "Must be a valid response type.";
          responseRadios[i].setAttribute("aria-describedby", itemId + "InputFeedback");
          divContainer.appendChild(span);
          divContainer.appendChild(error)
          responseRadios[i].parentNode.parentNode.appendChild(divContainer);
        }
      }
    }
  } else {
    for (var i = 0; i < responseRadios.length; i++) {
      var itemId = "sLastName[" + i + "]";
      removeClass(responseRadios[i], "is-invalid");
      responseRadios[i].removeAttribute("aria-describedby");
    }
    if (document.getElementById(itemId + "InputFeedback")) {
      document.getElementById(itemId + "InputFeedback").parentNode.parentNode.removeChild(
        document.getElementById(itemId + "InputFeedback").parentNode
      );
    } 
  }
  for (var i = 0; i < testValues.length; i++) {
    var itemId = "sItem" + i;
    if (!testValues[i]) {
      if (!hasClass(form.elements[itemId], "is-invalid")) {
        addClass(form.elements[itemId], "is-invalid");
        var error = document.createElement("div");
        error.id = itemId + "InputFeedback";
        addClass(error, "invalid-feedback");
        error.textContent = "Must be between 1 to 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!\"', and spaces.";
        form.elements[itemId].setAttribute("aria-describedby", itemId + "InputFeedback");
        form.elements[itemId].parentNode.appendChild(error);
      }
    } else {
      form.elements[itemId].removeAttribute("aria-describedby");
      removeClass(form.elements[itemId], "is-invalid");
      if (document.getElementById(itemId + "InputFeedback")) {
        document.getElementById(itemId + "InputFeedback").parentNode.removeChild(
          document.getElementById(itemId + "InputFeedback")
        );
      }
    }
  }
  for (var i = 0; i < testRadios.length; i++) {
    var radioId = "sRadioItem" + i;
    if (!testRadios[i]) {
      if (!hasClass(form.elements[radioId], "is-invalid")) {
        addClass(form.elements[radioId], "is-invalid");
        var error = document.createElement("div");
        error.id = radioId + "InputFeedback";
        addClass(error, "invalid-feedback");
        error.textContent = "Must be a valid item type.";
        form.elements[radioId].setAttribute("aria-describedby", radioId + "InputFeedback");
        form.elements[radioId].parentNode.appendChild(error);
      }
    } else {
      form.elements[radioId].removeAttribute("aria-describedby");
      removeClass(form.elements[radioId], "is-invalid");
      if (document.getElementById(radioId + "InputFeedback")) {
        document.getElementById(radioId + "InputFeedback").parentNode.removeChild(
          document.getElementById(radioId + "InputFeedback")
        );
      }
    }
  }
  if (!testTitle ||
      !testDescription ||
      !testResponses ||
      !everyArrayElement(testValues, true) ||
      !everyArrayElement(testRadios, true)) {
    return false;
  }
  return true;
}

function createSurveySubmit(token) {
  if (createSurveyFormHandler()) {
    document.getElementById("3-19-form").submit();
  }
}

function viewSurveyFormHandler() {
  var form = document.getElementById("22-19-form");
  var maxIndex = form.getElementsByTagName("h5").length;
  var textboxValues = [], ratingValues = [], yesNoValues = [];
  var tIndex = 0, rIndex = 0, yIndex = 0;
  for (var i = 0; i < maxIndex; i++) {
    var textbox = form.elements["sTextbox[" + i + "]"];
    var radios = form.elements["sRating[" + i + "]"];
    var yesNo = form.elements["sYesNo[" + i + "]"];
    if (textbox) {
      textboxValues[tIndex] = textbox.value;
      tIndex++;
    }
    if (radios) {
      ratingValues[rIndex] = "0";
      for (var j = 0; j < radios.length; j++) {
        if (radios[j].checked) {
          ratingValues[rIndex] = radios[j].value;
          break;
        }
      }
      rIndex++;
    }
    if (yesNo) {
      yesNoValues[yIndex] = "-1";
      for (var j = 0; j < yesNo.length; j++) {
        if (yesNo[j].checked) {
          yesNoValues[yIndex] = yesNo[j].value;
          break;
        }
      }
      yIndex++;
    }
  }
  var testTextboxes = [], testRatings = [], testYesNos = [];
  for (var i = 0; i < textboxValues.length; i++) {
    testTextboxes[i] = textboxValues[i].length < 150;
    testTextboxes[i] = testTextboxes[i] && /^[A-Za-z0-9\-\.\?!,"'\s]*$/.test(textboxValues[i]);
  }
  for (var i = 0; i < ratingValues.length; i++) {
    testRatings[i] = /^[1-5]{1}$/.test(ratingValues[i]);
  }
  for (var i = 0; i < yesNoValues.length; i++) {
    testYesNos[i] = /^(0|1)$/.test(yesNoValues[i]);
  }
  if (document.getElementById("vErrorDiv")) {
    document.querySelector("header.row.p-4.g-0").parentNode.removeChild(document.getElementById("vErrorDiv"));
  }
  if (!everyArrayElement(testTextboxes, true) ||
      !everyArrayElement(testRatings, true) ||
      !everyArrayElement(testYesNos, true)) {
    window.scrollTo(0,0);
    if (!document.getElementById("vErrorDiv")) {
      var errorDiv = document.createElement("div");
      errorDiv.id = "vErrorDiv";
      errorDiv.className = "alert alert-danger px-4 mb-0";
      errorDiv.textContent = "There are errors marked below:";
      document.querySelector("header.row.p-4.g-0").parentNode.appendChild(errorDiv);
    }
  }
  tIndex = 0;
  rIndex = 0;
  yIndex = 0;
  for (var i = 0; i < maxIndex; i++) {
    var textbox = form.elements["sTextbox[" + i + "]"];
    var radios = form.elements["sRating[" + i + "]"];
    var yesNo = form.elements["sYesNo[" + i + "]"];
    if (textbox) {
      var itemId = "sTextbox[" + i + "]";
      if (!testTextboxes[tIndex]) {
        if (!hasClass(textbox, "is-invalid")) {
          addClass(textbox, "is-invalid");
          var error = document.createElement("div");
          error.id = itemId + "InputFeedback";
          addClass(error, "invalid-feedback");
          error.textContent = "Must be less than 150 characters. Can contain A-Z, a-z, 0-9, ,-.?!\"', and spaces.";
          textbox.setAttribute("aria-describedby", itemId + "InputFeedback");
          textbox.parentNode.appendChild(error);
        }
      } else {
        textbox.removeAttribute("aria-describedby");
        removeClass(textbox, "is-invalid");
        if (document.getElementById(itemId + "InputFeedback")) {
          document.getElementById(itemId + "InputFeedback").parentNode.removeChild(
            document.getElementById(itemId + "InputFeedback")
          );
        }
      }
      tIndex++;
    }
    if (radios) {
      var itemId = "sRating[" + i + "]";
      if (!testRatings[rIndex]) {
        for (var j = 0; j < radios.length; j++) {
          if (!hasClass(radios[j], "is-invalid")) {
            addClass(radios[j], "is-invalid");
            if (j === radios.length - 1) {
              var divContainer = document.createElement("div");
              var span = document.createElement("span");
              addClass(span, "is-invalid");
              var error = document.createElement("div");
              error.id = itemId + "InputFeedback";
              addClass(error, "invalid-feedback");
              error.textContent = "Must be an integer from 1 to 5.";
              radios[j].setAttribute("aria-describedby", itemId + "InputFeedback");
              divContainer.appendChild(span);
              divContainer.appendChild(error)
              radios[j].parentNode.parentNode.appendChild(divContainer);
            }
          }
        }
      } else {
        for (var j = 0; j < radios.length; j++) {
          removeClass(radios[j], "is-invalid");
          radios[j].removeAttribute("aria-describedby");
        }
        if (document.getElementById(itemId + "InputFeedback")) {
          document.getElementById(itemId + "InputFeedback").parentNode.parentNode.removeChild(
            document.getElementById(itemId + "InputFeedback").parentNode
          );
        } 
      }
      rIndex++;
    }
    if (yesNo) {
      var itemId = "sYesNo[" + i + "]";
      var yesNos = form.elements[itemId];
      if (!testYesNos[yIndex]) {
        for (var j = 0; j < yesNos.length; j++) {
          if (!hasClass(yesNos[j], "is-invalid")) {
            addClass(yesNos[j], "is-invalid");
            if (j === yesNos.length - 1) {
              var divContainer = document.createElement("div");
              var span = document.createElement("span");
              addClass(span, "is-invalid");
              var error = document.createElement("div");
              error.id = itemId + "InputFeedback";
              addClass(error, "invalid-feedback");
              error.textContent = "Must be yes or no.";
              yesNos[j].setAttribute("aria-describedby", itemId + "InputFeedback");
              divContainer.appendChild(span);
              divContainer.appendChild(error)
              yesNos[j].parentNode.parentNode.appendChild(divContainer);
            }
          }
        }
      } else {
        for (var j = 0; j < yesNos.length; j++) {
          removeClass(yesNos[j], "is-invalid");
          yesNos[j].removeAttribute("aria-describedby");
        }
        if (document.getElementById(itemId + "InputFeedback")) {
          document.getElementById(itemId + "InputFeedback").parentNode.parentNode.removeChild(
            document.getElementById(itemId + "InputFeedback").parentNode
          );
        }
      }
      yIndex++;
    }
  }
  if (!everyArrayElement(testTextboxes, true) ||
      !everyArrayElement(testRatings, true) ||
      !everyArrayElement(testYesNos, true)) {
    return false;
  }
  return true;
}

function viewSurveySubmit(token) {
  if (viewSurveyFormHandler()) {
    document.getElementById("22-19-form").submit();
  }
}

function generateTokensFormHandler() {
  var form = document.getElementById("7-20-form");
  var tokensName = "gZIPCode";
  var tokensValue = form.elements[tokensName].value;
  var testTokens = tokensValue.length >= 1 && tokensValue.length <= 6;
  testTokens = testTokens && /^[0-9]{1,6}$/.test(tokensValue);
  testTokens = testTokens && (parseInt(tokensValue, 10) >= 1) && (parseInt(tokensValue, 10) <= 999999);
  if (document.getElementById("gErrorDiv")) {
    document.querySelector("header.row.p-4.g-0").parentNode.removeChild(document.getElementById("gErrorDiv"));
  }
  if (!testTokens) {
    window.scrollTo(0,0);
    if (!document.getElementById("vErrorDiv")) {
      var errorDiv = document.createElement("div");
      errorDiv.id = "gErrorDiv";
      errorDiv.className = "alert alert-danger px-4 mb-0";
      errorDiv.textContent = "There are errors marked below:";
      document.querySelector("header.row.p-4.g-0").parentNode.appendChild(errorDiv);
    }
  }
  form.elements[tokensName].removeAttribute("aria-describedby");
  removeClass(form.elements[tokensName], "is-invalid");
  if (document.getElementById(tokensName + "Feedback")) {
    document.getElementById(tokensName + "Feedback").parentNode.removeChild(
      document.getElementById(tokensName + "Feedback")
    );
  }
  if (!testTokens) {
    addClass(form.elements[tokensName], "is-invalid");
    var error = document.createElement("div");
    error.id = tokensName + "Feedback";
    addClass(error, "invalid-feedback");
    error.textContent = "Must be a positive integer.";
    form.elements[tokensName].setAttribute("aria-describedby", tokensName + "Feedback");
    form.elements[tokensName].parentNode.appendChild(error);
  }
  if (!testTokens) {
    return false;
  }
  return true;
}

function generateTokensSubmit(token) {
  if (generateTokensFormHandler()) {
    document.getElementById("7-20-form").submit();
  }
}

function closeSurveySubmit(token) {
  document.getElementById("3-12-19-form").submit();
}

function deleteSurveySubmit(token) {
  document.getElementById("4-19-form").submit();
}

window.createSurveySubmit = createSurveySubmit;
window.viewSurveySubmit = viewSurveySubmit;
window.generateTokensSubmit = generateTokensSubmit;
window.closeSurveySubmit = closeSurveySubmit;
window.deleteSurveySubmit = deleteSurveySubmit;
window.addEventListener("load", surveySetup, false);
