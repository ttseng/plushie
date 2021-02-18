// everything related to smoothie-js for live stream of incoming data, plot.ly for plotting sensor data

// for smoothiechart.js
let smoothie;
let accelXSeries = new TimeSeries();
let accelYSeries = new TimeSeries();
let accelZSeries = new TimeSeries();

let accelXArr = [];
let accelYArr = [];
let accelZArr = [];

let accelXSample = [];
let accelYSample = [];
let accelZSample = [];

// for plot.ly
let peaksArr = [];

let shouldDebug = true; // FOR TESTING DEBUG INTERFACE

function setupDataCollection() {
  accelXArr = [];
  accelYArr = [];
  accelZArr = [];

  smoothie = new SmoothieChart({ tooltip: false, grid: { fillStyle: '#ffffff', strokeStyle: '#c4c4c4' }, labels: { fillStyle: '#000000' } });
  smoothie.addTimeSeries(accelXSeries, { strokeStyle: "red" });
  smoothie.addTimeSeries(accelYSeries, { strokeStyle: "green" });
  smoothie.addTimeSeries(accelZSeries, { strokeStyle: "blue" });
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
}

// peak detection from https://stackoverflow.com/questions/22583391/peak-signal-detection-in-realtime-timeseries-data/57889588#57889588
function sum(a) {
  return a.reduce((acc, val) => acc + val);
}

function mean(a) {
  return sum(a) / a.length;
}

function stddev(arr) {
  const arr_mean = mean(arr);
  const r = function (acc, val) {
    return acc + (val - arr_mean) * (val - arr_mean);
  };
  return Math.sqrt(arr.reduce(r, 0.0) / arr.length);
}

function peaks(y, params) {
  var p = params || {};
  // init cooefficients
  const lag = p.lag || 5;
  const threshold = p.threshold || 3.5;
  const influence = p.influece || 0.5;

  let peaksCounter = 0;

  if (y === undefined || y.length < lag + 2) {
    throw ` ## y data array to short(${y.length}) for given lag of ${lag}`;
  }
  //console.log(`lag, threshold, influence: ${lag}, ${threshold}, ${influence}`)

  // init variables
  var signals = Array(y.length).fill(0);
  var filteredY = y.slice(0);
  const lead_in = y.slice(0, lag);
  //console.log("1: " + lead_in.toString())

  var avgFilter = [];
  avgFilter[lag - 1] = mean(lead_in);
  var stdFilter = [];
  stdFilter[lag - 1] = stddev(lead_in);
  //console.log("2: " + stdFilter.toString())

  for (var i = lag; i < y.length; i++) {
    //console.log(`${y[i]}, ${avgFilter[i-1]}, ${threshold}, ${stdFilter[i-1]}`)
    // added in Math.abs(y[i] - avgFilter[i - 1]) > 0.1 to account for peak detection when differences are very small
    if (
      Math.abs(y[i] - avgFilter[i - 1]) > 0.1 &&
      Math.abs(y[i] - avgFilter[i - 1]) > threshold * stdFilter[i - 1]
    ) {
      if (y[i] > avgFilter[i - 1]) {
        signals[i] = +1; // positive signal
        if (i - 1 > 0 && signals[i - 1] == 0) {
          peaksCounter++;
        }
      } else {
        signals[i] = -1; // negative signal
      }
      // make influence lower
      filteredY[i] = influence * y[i] + (1 - influence) * filteredY[i - 1];
    } else {
      signals[i] = 0; // no signal
      filteredY[i] = y[i];
    }

    // adjust the filters
    const y_lag = filteredY.slice(i - lag, i);
    avgFilter[i] = mean(y_lag);
    stdFilter[i] = stddev(y_lag);
  }
  return { numPeaks: peaksCounter, results: signals };
}

function generatePlotly(id, container, dataX, dataY, dataZ) {

  let plot = document.createElement("div"); // this contains the plotly plot and remove btn
  let name = id; // default
  let forDebug = false;
  if (typeof id == 'string') {
    forDebug = id.includes('debug');
  }

  let plotTitle;
  plot.classList.add("plot");

  if (!forDebug) {
    container.prepend(plot);
  } else {
    container.append(plot);
  }

  // create a container for the actual plotly plot
  let plotlyContainer = document.createElement('div');
  plotlyContainer.id = id;
  plot.append(plotlyContainer);

  //   console.log("generating plot for gesture", currentGesture, " ", name);
  let defaultWidth = 300;

  if (forDebug) {
    if (id.includes('timeline')) {
      // 6 second window debug
      defaultWidth = 600;
      plotTitle = 'Last 10 seconds'
    } else if (id.includes('subplot')) {
      // 2 second window debug
      let window = parseInt(id.replace('debug-subplot_', ''));
      let start = window * 2;
      plotTitle = `${start}-${start + 2} seconds`;
    }
  }

  Plotly.newPlot(
    name.toString(),
    [
      {
        y: dataX,
        mode: "lines",
        line: { color: "red" },
        name: "ax",
      },
      {
        y: dataY,
        mode: "lines",
        line: { color: "green" },
        name: "ay",
      },
      {
        y: dataZ,
        mode: "lines",
        line: { color: "blue" },
        name: "az",
      },
    ],
    plotlyLayout(defaultWidth, plotTitle),
    {
      staticPlot: false,
      displayModeBar: false
    }
  );

  // add remove btn
  if (!forDebug) {
    let removeBtn = document.createElement("div");
    removeBtn.classList.add("remove");
    removeBtn.innerHTML = removeIcon;
    removeBtn.addEventListener("click", function () {
      removeData(id);
    });
    plot.append(removeBtn);
  }

  // generate peaks data
  let peaksData = peaks(dataX);
  peaksArr[0] = peaksData.numPeaks;
  peaksData = peaks(dataY);
  peaksArr[1] = peaksData.numPeaks;
  peaksData = peaks(dataZ);
  peaksArr[2] = peaksData.numPeaks;

  if (forDebug && id.includes('debug-subplot')) {
    // add debugging plots for peak detection
    let peakContainer = document.createElement('div');
    peakContainer.classList.add('peak-container');
    container.append(peakContainer);

    createPeakChart(dataX, name + 'x', 'X', peakContainer);
    createPeakChart(dataY, name + 'Y', 'Y', peakContainer);
    createPeakChart(dataZ, name + 'Z', 'Z', peakContainer);
  }
}

function createPeakChart(data, id, axis, parent) {
  // data is the raw accelerometer data
  let plotContainer = document.createElement('div');
  plotContainer.setAttribute('id', id);
  parent.append(plotContainer);
  let peaksData = peaks(data);
  let peakColor;
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
    line: { color: 'black' },
    name: 'peaks'
  }, {
    y: data,
    mode: 'lines',
    line: { color: peakColor },
    name: 'data'
  }],
    plotlyLayout(200, `Peaks ${axis}`),
    { staticPlot: true });

  // add peak info
  let dataContainer = document.createElement('div');
  dataContainer.classList.add('peaks-label')
  dataContainer.innerHTML = `Peaks: ${peaksData.numPeaks}`;
  plotContainer.append(dataContainer);
}

function removeData(id) {
  let remove = confirm("Are you sure you want to remove this example?");
  if (remove) {
    gestureData = gestureData.filter((data) => data.id !== id);
    let parentGesture = event.target.closest('.gesture-container').id;

    // remove the plot
    event.target.closest(".plot").remove();

    // update sample
    updateSampleCounter(parentGesture);

    // update analytics
    logRemovedSample(parentGesture);

    // update debug if needed
    if (shouldDebug) {
      let row = document.querySelector(`#debug-container .debug-row.id-${id}`);
      row.remove();
    }
  }
}

function updateSampleCounter(gestureName) {

  let counterContainer = document.querySelector(
    `#${gestureName} .sample-counter`
  );
  let sampleContainer = document.querySelector(
    `#${gestureName} .sample-container`
  );

  let gestureContainer = document.querySelector(`#${gestureName}`);

  let sampleCount = sampleContainer.children.length;

  if (sampleCount > 0) {
    gestureContainer.classList.remove('incomplete');
    gestureContainer.querySelector('button.toggle-data-btn').classList.remove('hidden');
    populateSelects();
  } else {
    gestureContainer.classList.add('incomplete');
    // remove from gesture container
    document.querySelector(`#gesture-confidence-container .gesture-container.${gestureName}`).remove();
  }
  let msg;

  msg = `Samples: ${sampleCount}`;

  counterContainer.innerHTML = msg;

  // console.log(`update ${gestureName} with ${sampleCount}`);

  updateMLBtns();

  updateTriggers();

  return sampleCount;
}

// DEBUGGING UI

function toggleDebugger() {
  // show debug UI
  let detailsContainer = document.getElementById('debug-container');
  detailsContainer.classList.remove('hidden');
  dragElement(detailsContainer);
  shouldDebug = true;
  generateDebugTable();
}

function generateDebugTable(){
    let debugTable = document.getElementById('debug-table');
    debugTable.innerHTML = ''; // clear contents

    // fill in debug table by gesture
    let currentGestures = getCurrentGestures();
    for (i = 0; i < currentGestures.length; i++) {
      let currentGesture = currentGestures[i];
      let currentGestureData = gestureData.filter((sample) => sample.label == currentGesture);
      currentGestureData = currentGestureData.sort((a, b) => a.id - b.id); // sort by id

      // add gesture name to table
      createDebugSection(currentGesture); 
      for (k = 0; k < currentGestureData.length; k++) {
        let currentSample = currentGestureData[k];
        createDebugRow(currentSample.label, currentSample.id);
      }
    }
}

function createDebugSection(gestureName) {
  let debugTable = document.getElementById('debug-table');
  let gestureNameRow = document.createElement('div');
  gestureNameRow.classList.add('gesture-name', gestureName);
  let label = document.createElement('label');
  label.innerHTML = `${gestureName} examples`;
  gestureNameRow.append(label);

  let gestureDataContainer = document.createElement('div');
  gestureDataContainer.classList.add('data');
  gestureNameRow.append(gestureDataContainer);

  debugTable.append(gestureNameRow);
}

function createDebugRow(gestureName, gestureId) {
  let row = document.createElement('div');
  row.classList.add('debug-row', gestureName, `id-${gestureId}`);

  // let label = document.createElement('div');
  // label.innerHTML = gestureId;
  // label.classList.add('label');
  // row.append(label);

  let confidence = document.createElement('div');
  confidence.classList.add('confidence', `id-${gestureId}`);
  row.append(confidence);
  
  let distance = document.createElement('div');
  distance.classList.add('distance', `id-${gestureId}`);

  row.append(distance);
  row.onclick = highlightSample;
  document.querySelector(`#debug-table .${gestureName} .data`).prepend(row);
}

function highlightSample(evt){
  console.log(evt.target);
  let chartId = evt.target.classList[1].replace('id-', ''); //TODO this is brittle...
  
  // show the data for the gesture if it's not visible
  let gestureName = gestureData.filter(gesture => gesture.id == chartId)[0].label;
  if(gestureName){
  
    let dataToggleBtn = document.getElementById(gestureName).querySelector('.toggle-data-btn');
    if(dataToggleBtn && dataToggleBtn.innerHTML.includes('Show')){

      dataToggleBtn.click();
    }

    // remove all other highlights
    let plots = document.querySelectorAll('.plot');
    for(i=0; i<plots.length; i++){
      plots[i].classList.remove('highlight', 'warning');
    }

    let classToAdd = 'highlight';
    if(evt.target.classList.value.includes('warning')){
      classToAdd = 'warning'; // highlight in pink if it's a warning example
    }else{
      let debugRowParent = evt.target.closest('.debug-row');
      if(debugRowParent && debugRowParent.classList.value.includes('warning')){
        classToAdd = 'warning'
      }
    }
    // highlight the corresponding char
    document.getElementById(chartId).closest('.plot').classList.add(classToAdd);
  }
}

function closeDebugger(){
  let debugContainer = document.getElementById('debug-container');
  debugContainer.classList.toggle('hidden');
}

function plotlyLayout(width, title) {
  let topMargin = 15;
  if (title) {
    topMargin = 30;
  }
  let layout = {
    autosize: false,
    width: width,
    height: 200,
    margin: {
      l: 20,
      r: 15,
      pad: 0,
      t: topMargin,
      b: 20,
    },
    legend: {
      orientation: "h",
    },
    yaxis: { fixedrange: true },
    xaxis: { fixedrange: true },
    title: {
      text: title
    }
  };
  return layout;
}