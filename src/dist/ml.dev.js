"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// MODEL LOADING PARAMETERS
console.log('ml.js');
var shouldLoadDefaultGestures = true;
var shouldLoadModel = true;
var debugMode = true;
var dataDirectory = "data/";
var modelNeedsTraining = false; // this is a flag to determine when the model needs to be retrained.  
// it's used when a user adds new gestures / removes gestures that the model is already trained to recognize

var dataFromJSON = false; // used to flag whether to add new default gestures

var gestureData = []; // for retraining the model after adding new data
// ml5js

var model;
var numEpochs = 80;
var isCollectingData = false;
var isTraining = false;
var isClassifying = false;
var pencilIcon = "<i class='fas fa-pencil-alt'></i>";
var showIcon = '<i class="fas fa-eye"></i>';
var hideIcon = '<i class="fas fa-eye-slash"></i>';
var confidenceThreshold = 0.55; // default confidenceThreshold to trigger new gesture

var gestureLog = []; // for storing the detected gestures
// warning messages

var insufficientDataWarning = "You need at least 3 samples for each gesture to train the model.";
var insufficientGesturesWarning = "You need at least 2 gestures to train the model. Add some more gestures!";
var removeIcon = '<i class="fas fa-times"></i>'; // p5 / ml5 stuff

function setup() {
  // p5js canvas
  var canvas = createCanvas(250, 200, WEBGL);
  canvas.parent("p5js-container"); // load default gestures

  if (shouldLoadDefaultGestures) {
    loadDefaultGestures();
  }
}

function createClassifier() {
  // create KNN classifier
  model = ml5.KNNClassifier();
} // currently drawing box to show microbit orientation


function draw() {
  background(0);
  orbitControl();
  translate(0, 0, 0);
  normalMaterial();
  push();
  rotateX(-asin(sinY));
  rotateY(asin(sinX));
  torus(80, 20);
  pop();
}

function loadDefaultGestures() {
  console.log('load default gestures');
  var request = new XMLHttpRequest();
  request.open("GET", "/data/default-gestures.json");
  request.send(null);
  request.addEventListener('load', function () {
    var jsonData = JSON.parse(this.responseText);
    gestureData = jsonData.data;
    addDefaultGestures();
    startClassification();
  });
} // load data from JSON file


var loadDataInput = document.getElementById("data-upload");
loadDataInput.addEventListener("change", loadData); // TODO: Check if you can load data fro JSON

function loadData() {
  var loadDataInput = document.getElementById("data-upload");

  if (loadDataInput.files.length > 0) {
    var confirmation = confirm("All current gestures will be removed.  Are you sure you want to continue?");

    if (confirmation) {
      var currentGestures = getCurrentGestures();

      for (i = 0; i < currentGestures.length; i++) {
        removeGesture(currentGestures[i]);
      } // remove current default gestures


      document.getElementById('default-gestures').innerHTML = '';
      document.getElementById('gesture-confidence-container').innerHTML = '';
      var reader = new FileReader();
      reader.readAsText(loadDataInput.files[0]);

      reader.onload = function (e) {
        var result = e.target.result;
        var resultJSON = JSON.parse(result);
        console.log('result: ', resultJSON);
        gestureData = resultJSON.data;
        addDefaultGestures();
        updateTriggers();
      };
    }
  }
}

function addDefaultGestures() {
  var container = document.getElementById("custom-gestures");
  var gestures = getCurrentGestures();
  gestures.forEach(function (gestureName) {
    // create gesture ui
    container.append(buildNewGestureUI(gestureName)); // add charts for each data sample in the set

    var gestureContainer = document.querySelector("#gestures-container #".concat(gestureName));
    var gestureTrainingData = gestureData.filter(function (gesture) {
      return gesture.label == gestureName;
    });
    console.log('generating for gesture ', gestureName, ' with ', gestureTrainingData.length, ' samples');

    for (i = 0; i < gestureTrainingData.length; i++) {
      var id = gestureTrainingData[i].id;
      var x = gestureTrainingData[i].x;
      var y = gestureTrainingData[i].y;
      var z = gestureTrainingData[i].z;
      var parentContainer = gestureContainer.querySelector('.sample-container');
      var plotContainer = document.createElement('div');
      generatePlotly(id, parentContainer, x, y, z);
    } // update sample count


    updateSampleCounter(gestureName); // collapse them by default

    gestureContainer.querySelector(".toggle-data-btn").classList.remove("hidden");
    gestureContainer.querySelector(".toggle-data-btn").click();
  });
} // receives an array of objects formatted [ {label: name, dist: noralizedDistance_from_0_10}];


function updateConfidenceGestures(gesturesByDistance) {
  var confidenceContainer = document.getElementById('gesture-confidence-container'); // add gestures if needed

  gesturesByDistance.forEach(function (gestureItem) {
    // only add if the gesture doesn't already exist
    var gestureName = gestureItem.label;

    if (!document.querySelector("#gesture-confidence-container label.".concat(gestureName))) {
      // console.log('add new confidence container for ', gestureName);
      // add to the confidence container
      var gestureConfidenceContainer = document.createElement('div');
      gestureConfidenceContainer.classList.add(gestureName, 'gesture-container');
      var labelContainer = document.createElement('div');
      labelContainer.classList.add('label-container');
      var label = document.createElement('label');
      label.classList.add(gestureName);
      label.innerHTML = gestureName;
      labelContainer.append(label);
      gestureConfidenceContainer.append(labelContainer);
      var confidenceSpan = document.createElement('div');
      confidenceSpan.classList.add('confidence', gestureName);
      gestureConfidenceContainer.append(confidenceSpan);
      confidenceContainer.append(gestureConfidenceContainer);
    }
  }); // update confidences

  showConfidence(gesturesByDistance);
}

function removeGestureOnClick(evt) {
  var gestureLabelEl = evt.target.closest("label");
  var gestureName = gestureLabelEl.querySelector(".name").innerHTML; // check for default gestures if japanese!!

  var alertMsg = "Are you sure you want to remove this gesture?";
  var remove = confirm(alertMsg);

  if (remove) {
    console.log("remove ", gestureName);
    removeGesture(gestureName); // remove the gesture container (from the Gesture secction)

    if (gestureLabelEl.closest('.gesture-container')) {
      gestureLabelEl.closest(".gesture-container").remove();
    } // remove the label (for default gestures)


    gestureLabelEl.remove();
  }
}

function removeGesture(gestureName) {
  // remove all samples of it from the data
  gestureData = gestureData.filter(function (data) {
    return data.label !== gestureName;
  }); // remove from the predictions container in the console

  var confidenceGestureUI = document.querySelector("#gesture-confidence-container .gesture-container.".concat(gestureName));

  if (confidenceGestureUI) {
    confidenceGestureUI.remove();
  } // update analytics


  logRemovedGesture(gestureName);
  updateMLBtns();
  updateTriggers();
}

function getModelGestures() {
  // returns all trained gestures
  return _toConsumableArray(new Set(gestureData.map(function (item) {
    return item.label;
  })));
}

function recordGesture(evt) {
  // disable the recording button
  evt.target.disabled = true;
  var gestureID = evt.target.closest(".gesture-container").id.toLowerCase();
  console.log("recording gestureID: ", gestureID);
  currentGesture = gestureID;
  isCollectingData = true;

  if (!recordCountdownRunning) {
    // first run a 3 / 2 / 1 countdown before recording
    countdownTimer.start(preRecordTime, evt.target, preRecordStart, preRecordTimeLeft, atPreRecordTimeEnd);
  }
}

function gestureLabel(gestureName, isTrained) {
  var label = document.createElement("label");
  var trainLabel = isTrained ? "trained" : "untrained";
  label.classList.add("gesture", trainLabel);
  var labelName = document.createElement("span");
  labelName.classList.add("name");
  labelName.innerHTML = gestureName;
  label.append(labelName);
  var removeBtn = document.createElement("div");
  removeBtn.classList.add("remove");
  removeBtn.innerHTML = removeIcon;
  removeBtn.addEventListener("click", removeGestureOnClick);
  label.append(removeBtn);
  return label;
}

function addNewGesture(evt) {
  if (!microbitPaired) {
    alert("Pair your microbit first to begin adding gestures!");
  } else {
    var gestureName = prompt("Enter your gesture name: ", "");

    if (gestureName) {
      if (getCurrentGestures().includes(gestureName)) {
        alert("The name ".concat(gestureName, " is already been used. Please choose a new name."));
      } else {
        // format with all lower case and hyphens in place of spaces
        gestureName = gestureName.replace(/\s+/g, "-").toLowerCase();
        var gestureUI = buildNewGestureUI(gestureName);
        var parentContainer = document.getElementById("custom-gestures");
        parentContainer.prepend(gestureUI); // update analytics

        logAddedGesture(gestureName);
        updateMLBtns();
      }
    }
  }
}

function buildNewGestureUI(gestureName) {
  // create gesture container UI
  var gestureContainer = document.createElement("div");
  gestureContainer.classList.add("gesture-container", "custom-gesture", "incomplete");
  gestureContainer.setAttribute("id", gestureName); // label.addEventListener("click", renameGesture);

  gestureContainer.append(gestureLabel(gestureName, false)); // show / hide data button

  var toggleDataBtn = document.createElement("button");
  toggleDataBtn.classList.add("toggle-data-btn", "hidden");
  toggleDataBtn.innerHTML = hideIcon + "Hide Data";
  toggleDataBtn.addEventListener("click", function () {
    toggleDataVisibility(gestureName);
  }); // add new gesture container

  gestureContainer.append(toggleDataBtn);
  var dataContainer = document.createElement("div");
  dataContainer.classList.add("data-container");
  var recordContainer = document.createElement("div");
  recordContainer.classList.add("record-btn-container");
  var recordGestureBtn = document.createElement("button");
  recordGestureBtn.innerHTML = "Record Gesture";
  recordGestureBtn.classList.add("record-btn");
  recordGestureBtn.addEventListener("click", recordGesture);
  recordContainer.append(recordGestureBtn);
  var countdownContainer = document.createElement("div");
  countdownContainer.innerHTML = "2.00"; // two second timer

  countdownContainer.classList.add("countdown-timer");
  recordContainer.append(countdownContainer);
  dataContainer.append(recordContainer);
  var sampleCounter = document.createElement("div");
  sampleCounter.classList.add("sample-counter");
  dataContainer.append(sampleCounter);
  var sampleContainer = document.createElement("div");
  sampleContainer.classList.add("sample-container");
  sampleContainer.setAttribute("id", name);
  dataContainer.append(sampleContainer);
  gestureContainer.append(dataContainer);
  return gestureContainer;
}

function toggleDataVisibility(gestureName) {
  var triggerBtn = event.target;
  var dataContainer = document.querySelector("#".concat(gestureName, " .data-container"));

  if (triggerBtn.innerHTML.indexOf(hideIcon) >= 0) {
    triggerBtn.innerHTML = showIcon + "Show Data";
  } else {
    triggerBtn.innerHTML = hideIcon + "Hide Data";
  }

  dataContainer.classList.toggle("hidden");
}

function renameGesture(evt) {
  var newName = prompt("Enter a new name: ", "");

  if (newName.length > 0) {
    evt.target.closest("label").innerHTML = newName + pencilIcon;
  }
}

function updateMLBtns() {
  var newGestureBtn = document.getElementById("new-gesture-btn");
  var recordGestureBtns = document.getElementsByClassName("record-btn");

  if (isTraining) {
    // don't allow user to restart training if it's already in progress
    disableTrainBtn;
    newGestureBtn.disabled = true;
    Array.from(recordGestureBtns).forEach(function (btn) {
      btn.disabled = true;
    });
  } else {
    // allow users to add new gestures + add new samples
    newGestureBtn.disabled = false;
    Array.from(recordGestureBtns).forEach(function (btn) {
      btn.disabled = false;
    });
  }
}

function addNewData(id) {
  var accelX = accelXSample.slice(0);
  var accelY = accelYSample.slice(0);
  var accelZ = accelZSample.slice(0);
  var targetGesture = document.querySelector("#".concat(currentGesture)).id; // sample length seems to vary between 90 - 97

  var sampleLength = 90;
  var xData = accelX.slice(0, sampleLength);
  var yData = accelY.slice(0, sampleLength);
  var zData = accelZ.slice(0, sampleLength); // console.log('exampleData: ', exampleData);
  // add to gestureData JSON

  gestureData.push({
    x: xData,
    y: yData,
    z: zData,
    label: targetGesture,
    id: id
  }); // increment sample size

  var newSampleSize = updateSampleCounter(targetGesture); // update traning btns

  updateMLBtns();
  console.log(" ");
} // shown in console UI


function updateStatusContainer(status) {
  var statusLabel = document.getElementById("status-label");
  var trainedGestures = getCurrentGestures();


  if (trainedGestures.length > 0) {
    statusLabel.innerHTML = "Detected Gesture:";
  } else {
    statusLabel.innerHTML = 'Add some gestures!';
  }


  if (trainedGestures.length > 0) {
    document.getElementById("status").innerHTML = status;
  } else {
    document.getElementById("status").innerHTML = "";
  }
}

function hideStatusContainer() {
  document.getElementById("status-container").classList.add("hidden");
}

function showStatusContainer() {
  document.getElementById("status-container").classList.remove("hidden");

  if (trainedGestures.length > 0) {
    document.getElementById('confidence-slider-container').classList.remove('hidden');
  }
}

function dataLoaded() {
  console.log("loaded data ", model.data);
  addDefaultGestures();
  startClassification();
}

function dataLoadedFromFile() {
  console.log("loaded data from file ", model.data); // gestureData = model.data.data.raw.slice();

  trainedGestures = [];
  modelNeedsTraining = true; // train the model

  trainModel();
}

function modelLoaded() {
  console.log("default gestures loaded"); // populate default gestures container based on model data

  addDefaultGestures(); // gestureData = model.data.data.raw.slice();

  modelNeedsTraining = true;
  runPrediction();
}

function exportData() {
  var fileName = "data_" + new Date().getTime() + ".json";
  var fileContent = JSON.stringify({
    data: gestureData
  });
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent));
  element.setAttribute('download', fileName);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function startClassification() {
  if (!isClassifying) {
    isClassifying = true;
    var prediction = setInterval(function () {
      if (gestureData.length > 0) {
        runPrediction();
      }
    }, 300);
  }
}

function runPrediction() {
  var num_samples = 90; // about 2 seconds worth of data

  if (microbitPaired && !isTraining && accelXArr.length > num_samples) {
    (function () {
      // let num_samples = 1;
      var axData = accelXArr.slice(Math.max(accelXArr.length - num_samples, 1));
      var ayData = accelYArr.slice(Math.max(accelYArr.length - num_samples, 1));
      var azData = accelZArr.slice(Math.max(accelZArr.length - num_samples, 1)); // run DTW

      var dist = [];
      var minDist = 0;
      var prediction;

      for (i = 0; i < gestureData.length; i++) {
        var trainingData = gestureData[i];
        var xDist = new DynamicTimeWarping(trainingData.x, axData, distFunc).getDistance();
        var yDist = new DynamicTimeWarping(trainingData.y, ayData, distFunc).getDistance();
        var zDist = new DynamicTimeWarping(trainingData.z, azData, distFunc).getDistance();
        var totalDist = xDist + yDist + zDist; // console.log('distance for label', trainingData.label, ': ', totalDist);

        if (i == 0 || totalDist < minDist) {
          minDist = totalDist;
          prediction = trainingData.label;
        }

        dist.push({
          dist: totalDist,
          label: trainingData.label
        });
      }

      var distByGesture = []; // now detremine the total distance per label

      var currentGestures = getCurrentGestures();

      for (i = 0; i < currentGestures.length; i++) {
        var avgDist = getAverageDist(dist.filter(function (item) {
          return item.label == currentGestures[i];
        }).map(function (item) {
          return item.dist;
        }));
        distByGesture.push({
          label: currentGestures[i],
          dist: avgDist
        }); // TODO - maybe we can use this to find samples that are particularly off?
      } // console.log('distByGesture before normalization: ', distByGesture);
      // normalize by gesture


      var normalizedDistByGesture = [];
      var maxDist = Math.max.apply(Math, _toConsumableArray(distByGesture.map(function (gesture) {
        return gesture.dist;
      })));

      for (i = 0; i < distByGesture.length; i++) {
        var gestureObj = {};
        var normalizedDist = 100 - normalize(distByGesture[i].dist, minDist, maxDist, 1, 100);
        gestureObj.label = distByGesture[i].label;
        gestureObj.dist = normalizedDist;
        normalizedDistByGesture.push(gestureObj);
      }

      updateConfidenceGestures(normalizedDistByGesture); // display prediction

      showPrediction(prediction);
    })();
  }
}

function showPrediction(result) {
  // console.log('results: ', results);
  currentState = result.toLowerCase();
  gestureLog.push(currentState);
  var threshold = 3; // number of times gesture has to be predicted in a row for it to trigger a state change

  var stateChanged = false;

  if (gestureLog.length < threshold) {
    if (currentState != prevState) {
      stateChanged = true;
    }
  } else if (allEqual(lastSlice(gestureLog, threshold)) && currentState != prevState) {
    stateChanged = true;
  } // console.log('currentState: ', currentState, ' prevState: ', prevState, ' gestureLog: ' , lastSlice(gestureLog, 3));


  if (stateChanged) {
    updateStatusContainer(currentState); // set prediction label to active

    document.querySelector("#gesture-confidence-container .gesture-container.".concat(currentState)).classList.add('active');
    var otherGestureContainers = document.querySelectorAll("#gesture-confidence-container .gesture-container:not(.".concat(currentState, ")"));
    otherGestureContainers.forEach(function (el) {
      el.classList.remove('active');
    });
    console.log("");
    console.log("new state: ", currentState);

    if (document.getElementById("loud-select")) {
      playAudio(currentState);
    } // check if should start countdown


    var countdownCheckbox = document.getElementById("timer-countdown-trigger-checkbox");

    if (countdownCheckbox) {
      var countdownChecked = countdownCheckbox.checked;

      if (countdownChecked) {
        var countdownTriggerSelect = document.getElementById("timer-countdown-trigger-select");
        var countdownTrigger = countdownTriggerSelect.options[countdownTriggerSelect.selectedIndex].value.toLowerCase(); // console.log('countdownTrigger: ', countdownTrigger);

        if (countdownTrigger == currentState && !timerCountdownRunning) {
          countdownTimer.start(timerCountdownTime, document.getElementById("timer-countdown"), atCountdownTimerStart, countdownTimerDisplay, atCountdownTimerEnd);
        }
      }
    }

    prevState = currentState;
  } // check if volume confidenceThreshold is met


  if (document.getElementById("loud-select") && isLoud()) {
    startPlayback();
    playAudio("loud");
  }
}

function updateTriggers() {
  var currentTriggers = Array.from(document.getElementById('triggers-container').querySelectorAll('.action ')).map(function (item) {
    return item.classList.value.replace('action ', '');
  });
  var currentGestures = getCurrentGestures(); // an array of new gestures that have been added

  var addedGestures = currentGestures.filter(function (gesture) {
    return currentTriggers.includes(gesture) == false;
  });
  var removedGestures = currentTriggers.filter(function (gesture) {
    return currentGestures.includes(gesture) == false;
  });
  var timerTrigger = document.getElementById("timer-countdown-trigger-select");
  addedGestures.forEach(function (gesture) {
    console.log("adding trigger element for ", gesture); // add a new trigger element

    var triggersContainer = document.querySelector("#triggers-container .content");
    var newTriggerContainer = document.createElement("div");
    newTriggerContainer.classList.add("action", gesture);
    var descriptionContainer = document.createElement("div");
    descriptionContainer.classList.add("description");
    var gestureSelectContainer = document.createElement("select");
    gestureSelectContainer.setAttribute("id", "".concat(gesture, "-select")); // add defualt audio elements

    gestureSelectContainer.innerHTML = "<option value=\"none\"> None</option>\n        <option value=\"random\">\uD83D\uDD00 Random</option>\n        <option value=\"silence\">\uD83D\uDD07 Silence</option>\n        ";
    gestureSelectContainer.classList.add("audio-select");
    descriptionContainer.innerHTML = "On <label>".concat(gesture, "</label>, play sound<br/>");
    descriptionContainer.append(gestureSelectContainer);
    newTriggerContainer.append(descriptionContainer);
    triggersContainer.prepend(newTriggerContainer); // update timer trigger

    timerTrigger.options.add(new Option(gesture, gesture));
  });
  removedGestures.forEach(function (gesture) {
    // remove the trigger element
    document.querySelector(".action.".concat(gesture)).remove();
    var timerOption = timerTrigger.querySelector("option[value=\"".concat(gesture, "\"]"));

    if (timerOption) {
      timerOption.remove();
    }
  });
  populateSelects();
}

function getCurrentGestures() {
  // this is a list of all gestures on the page, both trained and untrained
  // used to determine if there's a naming conflict
  return _toConsumableArray(new Set(gestureData.map(function (item) {
    return item.label;
  })));
} // record timer functions


function atRecordTimerStart(display) {
  recordCountdownRunning = true;
  display.classList.add("active");
  accelXSample = [];
  accelYSample = [];
  accelZSample = [];
}

function recordTimerDisplay(timeLeft) {
  return timeLeft.toFixed(2);
} // atRecordTimeEnd - finished recording gesture


function atRecordTimeEnd(timeLimit, display) {
  isCollectingData = false;
  recordCountdownRunning = false;
  display.innerHTML = timeLimit.toFixed(2); // initial countdown time with two decimal places

  display.classList.remove("active");
  var recordBtn = document.querySelector("#".concat(currentGesture, " .record-btn"));
  recordBtn.disabled = false;
  recordBtn.innerHTML = "Record Gesture";
  var dataId = new Date().getTime();
  var parentContainer = document.querySelector("#".concat(currentGesture, " .sample-container"));
  generatePlotly(dataId, parentContainer, accelXSample, accelYSample, accelZSample); // add data

  addNewData(dataId); // update analytics

  logAddedSample(currentGesture);
} // countdown timer functions


function atCountdownTimerStart() {
  timerCountdownRunning = true; // check whether to loop audio

  var countdownStartSelect = document.getElementById("timer-countdown-start-select");
  var audioFileName = countdownStartSelect.options[countdownStartSelect.selectedIndex].value.toLowerCase();
  var audioEl = document.getElementById(audioFileName + "-audio");

  if (document.getElementById("timer-countdown-start-loop-checkbox").checked && audioEl) {
    audioEl.loop = true;
  } else if (audioEl) {
    audioEl.loop = false;
  } // play audio


  playAudio("timer-countdown-start");
} // returns content to display in the timer display element


function countdownTimerDisplay(timeLeft) {
  minutes = parseInt(timeLeft / 60, 10);
  seconds = parseInt(timeLeft % 60, 10);
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;
  return minutes + ":" + seconds;
}

function atCountdownTimerEnd(defaultTime, display, isFromReset) {
  stopAllAudio();
  timerCountdownRunning = false;
  display.innerHTML = defaultTime.toString().toMMSS();

  if (!isFromReset) {
    playAudio("timer-countdown-end");
  }
} // CONFIDENCE ADJUSTMENTS - THRESHOLD TO TRIGGER NEW GESTURE


function showConfidence(confidences) {
  var labels = confidences.map(function (item) {
    return item.label;
  });
  labels.forEach(function (labelName, index) {
    var gestureContainer = document.querySelector("#gesture-confidence-container .gesture-container.".concat(labelName));
    var confidenceEl = document.querySelector("#gesture-confidence-container .confidence.".concat(labelName));
    var confidence = confidences[index].dist;
    confidenceEl.style.width = confidence + "%";
  });
}

function toggleOptions() {
  var optionsContainer = document.querySelector('#options-container');
  var isMinimized = optionsContainer.classList.contains('minimized');
  optionsContainer.classList.toggle('minimized'); // update caret content

  var caret = document.getElementById('options-expand-btn');

  if (isMinimized) {
    caret.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    caret.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

function showOptions() {
  var optionsContainer = document.querySelector('#options-container');
  optionsContainer.classList.remove('minimized');
  var caret = document.getElementById('options-expand-btn');
  caret.innerHTML = '<i class="fas fa-chevron-up"></i>';
}

function toggleDescription(el) {
  el.parentElement.querySelector('.description').classList.toggle('hidden');
} // FOR DEBUG MODE


function debug() {
  debugMode = !debugMode;
  document.getElementById('debug-container').classList.toggle('hidden');
} // UTILS


var distFunc = function distFunc(a, b) {
  return Math.abs(a - b);
};

function lastSlice(arr, sliceLength) {
  return arr.slice(Math.max(arr.length - sliceLength, 1));
}

var allEqual = function allEqual(arr) {
  return arr.every(function (val) {
    return val === arr[0];
  });
};

var totalReducer = function totalReducer(accumulator, currentValue) {
  return accumulator + currentValue;
};

var getAverageDist = function getAverageDist(array) {
  return array.reduce(totalReducer) / array.length;
};

var normalize = function normalize(num, in_min, in_max, out_min, out_max) {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};