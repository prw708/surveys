google.charts.safeLoad({ "packages": ["corechart"] });
google.charts.setOnLoadCallback(drawSurveyChart);

function drawSurveyChart() {
  var dashboard = document.getElementById("dashboard");
  var chartElement = document.getElementById("sChart");
  if (!dashboard || !chartElement) {
    return false;
  }
  // Get Data
  var surveyData = getTableData("sData", ["s", "i", "i"]);
  var data = new google.visualization.DataTable();
  data.addColumn("string", surveyData[0][0]);
  data.addColumn("number", surveyData[0][1]);
  data.addColumn("number", surveyData[0][2]);
  data.addRows(surveyData.slice(1));
  // Chart Options
  var chart = new google.visualization.BarChart(chartElement);
  var options = {
    height: 75 * surveyData.length,
    chartArea: { height: "90%", width: "80%", top: "0%", left: "20%" },
    legend: { position: "bottom", alignment: "center", textStyle: { fontSize: 14 } },
    colors: ["rgb(160,200,235)", "rgb(40,70,100)"],
    dataOpacity: 1,
    bar: { groupWidth: "90%" },
    animation: { duration: 1000, startup: true },
    vAxis: { textStyle: { fontSize: 16 }, gridlines: { count: 0 } },
    hAxis: { baselineColor: "#aaa", textPosition: "none", gridlines: { count: 0 } }
  };
  // Draw chart
  chart.draw(data, options);
  // Resize chart on window resize
  var windowWidth = window.innerWidth;
  window.addEventListener("resize", function() {
    if (window.innerWidth !== windowWidth) {
      windowWidth = window.innerWidth;
      debounce(function() {
        chart.draw(data, options);
      }, 1000)();
    }
  }, false);
  window.addEventListener("orientationchange", function() {
    debounce(function() {
      chart.draw(data, options);
    }, 1000)();
  }, false);
}

function getTableData(tableId, columnTypes) {
  var table = document.getElementById(tableId);
  if (!table) {
    return false;
  }
  var rows = table.getElementsByTagName("tr");
  var data = [];
  for (var i = 0; i < rows.length; i++) {
    var headers = rows[i].getElementsByTagName("th");
    var cells = rows[i].getElementsByTagName("td");
    if (!headers || headers.length === 0) {
      data[i] = new Array(cells.length);
      for (var j = 0; j < cells.length; j++) {
        if (columnTypes[j] === "i") {
          data[i][j] = parseInt(DOMPurify.sanitize(cells[j].textContent.trim()), 10);
        } else if (columnTypes[j] === "f") {
          data[i][j] = parseFloat(DOMPurify.sanitize(cells[j].textContent.trim()));
        } else {
          data[i][j] = DOMPurify.sanitize(cells[j].textContent.trim());
        }
      }
    } else {
      data[i] = new Array(headers.length);
      for (var j = 0; j < headers.length; j++) {
        data[i][j] = DOMPurify.sanitize(headers[j].textContent.trim());
      }
    }
  }
  return data;
}
