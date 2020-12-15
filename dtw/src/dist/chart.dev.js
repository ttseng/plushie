"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// everything related to smoothie-js for live stream of incoming data, plot.ly for plotting sensor data
// for smoothiechart.js
var smoothie;
var accelXSeries = new TimeSeries();
var accelYSeries = new TimeSeries();
var accelZSeries = new TimeSeries();
var accelXArr = [];
var accelYArr = [];
var accelZArr = [];
var accelXSample = [];
var accelYSample = [];
var accelZSample = []; // for plot.ly

var peaksArr = [];

function setupDataCollection() {
  accelXArr = [];
  accelYArr = [];
  accelZArr = [];
  smoothie = new SmoothieChart({
    tooltip: false
  });
  smoothie.addTimeSeries(accelXSeries, {
    strokeStyle: "red"
  });
  smoothie.addTimeSeries(accelYSeries, {
    strokeStyle: "green"
  });
  smoothie.addTimeSeries(accelZSeries, {
    strokeStyle: "blue"
  });
  smoothie.streamTo(document.getElementById("smoothie-chart"), 1000); // delay in MS

  smoothie.start();
}

function average(data) {
  var sum = data.reduce(function (sum, value) {
    return sum + value;
  }, 0);
  var avg = sum / data.length;
  return avg;
}

function max(data) {
  return Math.max(data);
}

function standardDeviation(values) {
  var avg = average(values);
  var squareDiffs = values.map(function (value) {
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  var avgSquareDiff = average(squareDiffs);
  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
} // peak detection from https://stackoverflow.com/questions/22583391/peak-signal-detection-in-realtime-timeseries-data/57889588#57889588


function sum(a) {
  return a.reduce(function (acc, val) {
    return acc + val;
  });
}

function mean(a) {
  return sum(a) / a.length;
}

function stddev(arr) {
  var arr_mean = mean(arr);

  var r = function r(acc, val) {
    return acc + (val - arr_mean) * (val - arr_mean);
  };

  return Math.sqrt(arr.reduce(r, 0.0) / arr.length);
}

function peaks(y, params) {
  var p = params || {}; // init cooefficients

  var lag = p.lag || 5;
  var threshold = p.threshold || 3.5;
  var influence = p.influece || 0.5;
  var peaksCounter = 0;

  if (y === undefined || y.length < lag + 2) {
    throw " ## y data array to short(".concat(y.length, ") for given lag of ").concat(lag);
  } //console.log(`lag, threshold, influence: ${lag}, ${threshold}, ${influence}`)
  // init variables


  var signals = Array(y.length).fill(0);
  var filteredY = y.slice(0);
  var lead_in = y.slice(0, lag); //console.log("1: " + lead_in.toString())

  var avgFilter = [];
  avgFilter[lag - 1] = mean(lead_in);
  var stdFilter = [];
  stdFilter[lag - 1] = stddev(lead_in); //console.log("2: " + stdFilter.toString())

  for (var i = lag; i < y.length; i++) {
    //console.log(`${y[i]}, ${avgFilter[i-1]}, ${threshold}, ${stdFilter[i-1]}`)
    // added in Math.abs(y[i] - avgFilter[i - 1]) > 0.1 to account for peak detection when differences are very small
    if (Math.abs(y[i] - avgFilter[i - 1]) > 0.1 && Math.abs(y[i] - avgFilter[i - 1]) > threshold * stdFilter[i - 1]) {
      if (y[i] > avgFilter[i - 1]) {
        signals[i] = +1; // positive signal

        if (i - 1 > 0 && signals[i - 1] == 0) {
          peaksCounter++;
        }
      } else {
        signals[i] = -1; // negative signal
      } // make influence lower


      filteredY[i] = influence * y[i] + (1 - influence) * filteredY[i - 1];
    } else {
      signals[i] = 0; // no signal

      filteredY[i] = y[i];
    } // adjust the filters


    var y_lag = filteredY.slice(i - lag, i);
    avgFilter[i] = mean(y_lag);
    stdFilter[i] = stddev(y_lag);
  }

  return {
    numPeaks: peaksCounter,
    results: signals
  };
}

function generatePlotly(id, container, dataX, dataY, dataZ) {
  var plot = document.createElement("div"); // this contains the plotly plot and remove btn

  var name = id; // default

  var forDebug = false;

  if (typeof id == 'string') {
    forDebug = id.includes('debug');
  }

  var plotTitle;
  plot.classList.add("plot");

  if (!forDebug) {
    container.prepend(plot);
  } else {
    container.append(plot);
  } // create a container for the actual plotly plot


  var plotlyContainer = document.createElement('div');
  plotlyContainer.id = id;
  plot.append(plotlyContainer); //   console.log("generating plot for gesture", currentGesture, " ", name);

  var defaultWidth = 300;

  if (forDebug) {
    if (id.includes('timeline')) {
      // 6 second window debug
      defaultWidth = 600;
      plotTitle = 'Last 10 seconds';
    } else if (id.includes('subplot')) {
      // 2 second window debug
      var window = parseInt(id.replace('debug-subplot_', ''));
      var start = window * 2;
      plotTitle = "".concat(start, "-").concat(start + 2, " seconds");
    }
  }

  Plotly.newPlot(name.toString(), [{
    y: dataX,
    mode: "lines",
    line: {
      color: "red"
    },
    name: "ax"
  }, {
    y: dataY,
    mode: "lines",
    line: {
      color: "green"
    },
    name: "ay"
  }, {
    y: dataZ,
    mode: "lines",
    line: {
      color: "blue"
    },
    name: "az"
  }], plotlyLayout(defaultWidth, plotTitle), {
    staticPlot: false,
    displayModeBar: false
  }); // add remove btn

  if (!forDebug) {
    var removeBtn = document.createElement("div");
    removeBtn.classList.add("remove");
    removeBtn.innerHTML = removeIcon;
    removeBtn.addEventListener("click", function () {
      removeData(id);
    });
    plot.append(removeBtn);
  } // generate peaks data


  var peaksData = peaks(dataX);
  peaksArr[0] = peaksData.numPeaks;
  peaksData = peaks(dataY);
  peaksArr[1] = peaksData.numPeaks;
  peaksData = peaks(dataZ);
  peaksArr[2] = peaksData.numPeaks;

  if (forDebug && id.includes('debug-subplot')) {
    // add debugging plots for peak detection
    var peakContainer = document.createElement('div');
    peakContainer.classList.add('peak-container');
    container.append(peakContainer);
    createPeakChart(dataX, name + 'x', 'X', peakContainer);
    createPeakChart(dataY, name + 'Y', 'Y', peakContainer);
    createPeakChart(dataZ, name + 'Z', 'Z', peakContainer);
  }
}

function createPeakChart(data, id, axis, parent) {
  // data is the raw accelerometer data
  var plotContainer = document.createElement('div');
  plotContainer.setAttribute('id', id);
  parent.append(plotContainer);
  var peaksData = peaks(data);
  var peakColor;

  switch (axis) {
    case 'X':
      peakColor = 'red';
      break;

    case 'Y':
      peakColor = 'green';
      break;

    case 'Z':
      peakColor = 'blue';
      break;
  }

  Plotly.newPlot(id, [{
    y: peaksData.results,
    mode: 'lines',
    line: {
      color: 'black'
    },
    name: 'peaks'
  }, {
    y: data,
    mode: 'lines',
    line: {
      color: peakColor
    },
    name: 'data'
  }], plotlyLayout(200, "Peaks ".concat(axis)), {
    staticPlot: true
  }); // add peak info

  var dataContainer = document.createElement('div');
  dataContainer.classList.add('peaks-label');
  dataContainer.innerHTML = "Peaks: ".concat(peaksData.numPeaks);
  plotContainer.append(dataContainer);
}

function removeData(id) {
  var remove = confirm("Are you sure you want to remove this data?");

  if (remove) {
    gestureData = gestureData.filter(function (data) {
      return data.id !== id;
    });
    var parentGesture = event.target.closest('.gesture-container').id; // remove the plot

    event.target.closest(".plot").remove(); // update sample

    updateSampleCounter(parentGesture); // update analytics

    logRemovedSample(parentGesture);
  }
}

function updateSampleCounter(gestureName) {
  var counterContainer = document.querySelector("#".concat(gestureName, " .sample-counter"));
  var sampleContainer = document.querySelector("#".concat(gestureName, " .sample-container"));
  var gestureContainer = document.querySelector("#".concat(gestureName));
  var sampleCount = sampleContainer.children.length;

  if (sampleCount > 0) {
    gestureContainer.classList.remove('incomplete');
    gestureContainer.querySelector('button.toggle-data-btn').classList.remove('hidden');
  } else {
    gestureContainer.classList.add('incomplete'); // remove from gesture container

    document.querySelector("#gesture-confidence-container .gesture-container.".concat(gestureName)).remove();
  }

  var msg;
  msg = "Samples: ".concat(sampleCount);
  counterContainer.innerHTML = msg; // console.log(`update ${gestureName} with ${sampleCount}`);

  updateMLBtns();
  updateTriggers();
  return sampleCount;
} // DEBUG 


var debugIndex = 0; // i index for debugging

function showDebug(btn) {
  // reset indexing values
  debugIndex = 0; // display a chart with the last 10 seconds of data

  var sampleSize = 96; // ~ 2 second sample

  var sampleLength = sampleSize * 5; // 97 samples in ~10 seconds

  var ax = accelXArr.slice(accelXArr.length - sampleLength);
  var ay = accelYArr.slice(accelYArr.length - sampleLength);
  var az = accelZArr.slice(accelZArr.length - sampleLength);
  var container = document.getElementById('debug-timeline');
  container.innerHTML = ''; // clear contents

  generatePlotly('debug-timeline', container, ax, ay, az); // display charts from 2 second samples

  var displayContainer = document.getElementById('debug-charts');
  displayContainer.innerHTML = ''; // console.log('ax:', ax, 'ay:', ay, 'az:', az);

  for (i = 0; i < sampleLength / sampleSize; i++) {
    // console.log('generate plot for debug ', i);
    var start = sampleSize * i;
    console.log('start: ', start);
    var ax_slice = ax.slice(start, sampleSize + start - 1);
    var ay_slice = ay.slice(start, sampleSize + start - 1);
    var az_slice = az.slice(start, sampleSize + start - 1); // console.log('ax_slice:', ax_slice, 'ay_slice:', ay_slice, 'az_slice:', az_slice);

    generatePlotly("debug-subplot_".concat(i), displayContainer, ax_slice, ay_slice, az_slice);
    runDebugPrediction(ax_slice, ay_slice, az_slice);
  }
}

function runDebugPrediction(ax, ay, az) {
  // console.log('run debug prediction for index ', debugIndex);
  var inputs = {
    ax_max: Math.max.apply(Math, _toConsumableArray(ax)),
    ax_min: Math.min.apply(Math, _toConsumableArray(ax)),
    ax_std: standardDeviation(ax),
    ax_peaks: peaks(ax).numPeaks,
    ay_max: Math.max.apply(Math, _toConsumableArray(ay)),
    ay_min: Math.min.apply(Math, _toConsumableArray(ay)),
    ay_std: standardDeviation(ay),
    ay_peaks: peaks(ay).numPeaks,
    az_max: Math.max.apply(Math, _toConsumableArray(az)),
    az_min: Math.min.apply(Math, _toConsumableArray(az)),
    az_std: standardDeviation(az),
    az_peaks: peaks(az).numPeaks
  };
  model.classify(inputs, debugPredictionResults);
}

function debugPredictionResults(error, results) {
  if (error) {
    console.error(error);
  } // console.log('debugPredictionResults for index ', debugIndex);


  var confidenceContainer = document.createElement('div');
  var body = '';
  results.forEach(function (gesture) {
    body += "<label>".concat(gesture.label, "</label> ").concat((gesture.confidence * 100).toFixed(0), "% ");
  });
  confidenceContainer.innerHTML = body;
  var container = document.getElementById("debug-subplot_".concat(debugIndex));
  container.append(confidenceContainer);
  debugIndex++;
}

function plotlyLayout(width, title) {
  var topMargin = 15;

  if (title) {
    topMargin = 30;
  }

  var layout = {
    autosize: false,
    width: width,
    height: 200,
    margin: {
      l: 20,
      r: 15,
      pad: 0,
      t: topMargin,
      b: 20
    },
    legend: {
      orientation: "h"
    },
    yaxis: {
      fixedrange: true
    },
    xaxis: {
      fixedrange: true
    },
    title: {
      text: title
    }
  };
  return layout;
}