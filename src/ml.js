// MODEL LOADING PARAMETERS
let shouldLoadDefaultGestures = true;
let shouldLoadModel = true;

let debugMode = true;

let dataDirectory = "data/";
let modelNeedsTraining = false; // this is a flag to determine when the model needs to be retrained.  
// it's used when a user adds new gestures / removes gestures that the model is already trained to recognize
let dataFromJSON = false; // used to flag whether to add new default gestures

let gestureData = []; // for retraining the model after adding new data

// ml5js
let model;
const numEpochs = 80;

let isCollectingData = false;
let isTraining = false;
let isClassifying = false;

let pencilIcon = "<i class='fas fa-pencil-alt'></i>";
let showIcon = '<i class="fas fa-eye"></i>';
let hideIcon = '<i class="fas fa-eye-slash"></i>';
let confidenceThreshold = 0.55; // default confidenceThreshold to trigger new gesture

let gestureLog = []; // for storing the detected gestures

// warning messages
let insufficientDataWarning =
  "You need at least 3 samples for each gesture to train the model.";
let insufficientGesturesWarning =
  "You need at least 2 gestures to train the model. Add some more gestures!";

let removeIcon = '<i class="fas fa-times"></i>';

// p5 / ml5 stuff
function setup() {
  // p5js canvas
  let canvas = createCanvas(250, 200, WEBGL);
  canvas.parent("p5js-container");

  // load default gestures
  if (shouldLoadDefaultGestures) {
    loadDefaultGestures();
  }
}

function createClassifier() {
  // create KNN classifier
  model = ml5.KNNClassifier();
}

// currently drawing box to show microbit orientation
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
  var request = new XMLHttpRequest();
  request.open("GET", "data/default-gestures.json");
  request.send(null);
  request.addEventListener('load', function () {
    var jsonData = JSON.parse(this.responseText);
    gestureData = jsonData.data;

    addDefaultGestures();

    startClassification();
  });
}

// load data from JSON file
const loadDataInput = document.getElementById("data-upload");
loadDataInput.addEventListener("change", loadData);


// TODO: Check if you can load data fro JSON
function loadData() {
  const loadDataInput = document.getElementById("data-upload");
  if (loadDataInput.files.length > 0) {
    let confirmation = confirm(
      "All current gestures will be removed.  Are you sure you want to continue?"
    );
    if (confirmation) {

      let currentGestures = getCurrentGestures();
      for (i = 0; i < currentGestures.length; i++) {
        removeGesture(currentGestures[i]);
      }

      // remove current default gestures
      document.getElementById('gesture-confidence-container').innerHTML = '';

      let reader = new FileReader();
      reader.readAsText(loadDataInput.files[0]);
      reader.onload = (e) => {
        let result = e.target.result;
        let resultJSON = JSON.parse(result);
        console.log('result: ', resultJSON);
        gestureData = resultJSON.data;
        addDefaultGestures();
        updateTriggers();
      }
    }
  }
}

function addDefaultGestures() {
  let container = document.getElementById("custom-gestures");
  let gestures = getCurrentGestures();

  gestures.forEach(function (gestureName) {

    // create gesture ui
    container.append(buildNewGestureUI(gestureName));

    // add charts for each data sample in the set
    let gestureContainer = document.querySelector(`#gestures-container #${gestureName}`);
    let gestureTrainingData = gestureData.filter((gesture) => gesture.label == gestureName);

    // console.log('generating for gesture ', gestureName, ' with ', gestureTrainingData.length, ' samples');

    for (i = 0; i < gestureTrainingData.length; i++) {
      let id = gestureTrainingData[i].id;
      let x = gestureTrainingData[i].x;
      let y = gestureTrainingData[i].y;
      let z = gestureTrainingData[i].z;

      let parentContainer = gestureContainer.querySelector('.sample-container');
      let plotContainer = document.createElement('div');
      generatePlotly(id, parentContainer, x, y, z);
    }
    // update sample count
    updateSampleCounter(gestureName);

    // collapse them by default
    gestureContainer.querySelector(".toggle-data-btn").classList.remove("hidden");
    gestureContainer.querySelector(".toggle-data-btn").click();
  });
}

// receives an array of objects formatted [ {label: name, dist: noralizedDistance_from_0_10}];
function updateConfidenceGestures(gesturesByDistance) {
  let confidenceContainer = document.getElementById('gesture-confidence-container');

  // add gestures if needed
  gesturesByDistance.forEach(function (gestureItem) {

    // only add if the gesture doesn't already exist
    let gestureName = gestureItem.label;

    if (!document.querySelector(`#gesture-confidence-container label.${gestureName}`)) {
      // console.log('add new confidence container for ', gestureName);
      // add to the confidence container
      let gestureConfidenceContainer = document.createElement('div');
      gestureConfidenceContainer.classList.add(gestureName, 'gesture-container');
      let labelContainer = document.createElement('div');
      labelContainer.classList.add('label-container');
      let label = document.createElement('label');
      label.classList.add(gestureName);
      label.innerHTML = gestureName;
      labelContainer.append(label);

      gestureConfidenceContainer.append(labelContainer);

      let confidenceSpan = document.createElement('div');
      confidenceSpan.classList.add('confidence', gestureName);
      gestureConfidenceContainer.append(confidenceSpan);

      confidenceContainer.append(gestureConfidenceContainer);
    }
  });

  // update confidences
  showConfidence(gesturesByDistance);
}

function removeGestureOnClick(evt) {
  let gestureLabelEl = evt.target.closest("label");
  let gestureName = gestureLabelEl.querySelector(".name").innerHTML;

  let alertMsg = "Are you sure you want to remove this gesture?";

  let remove = confirm(alertMsg);
  if (remove) {
    console.log("remove ", gestureName);
    removeGesture(gestureName);
    // remove the gesture container (from the Gesture secction)
    if (gestureLabelEl.closest('.gesture-container')) {
      gestureLabelEl.closest(".gesture-container").remove();
    }
    // remove the label (for default gestures)
    gestureLabelEl.remove();
  }
}

function removeGesture(gestureName) {
  console.log('removeGesture ', gestureName);
  // remove all samples of it from the data
  gestureData = gestureData.filter((data) => data.label !== gestureName);

  // remove it from the gestures container
  let gestureContainer = document.querySelector(`#gestures-container #${gestureName}`);
  if(gestureContainer){
    gestureContainer.remove();
  }

  // remove from the predictions container in the console
  let confidenceGestureUI = document.querySelector(`#gesture-confidence-container .gesture-container.${gestureName}`);
  if (confidenceGestureUI) {
    confidenceGestureUI.remove();
  }

  // update analytics
  logRemovedGesture(gestureName);

  updateMLBtns();
  updateTriggers();
}

function getModelGestures() {
  // returns all trained gestures
  return [...new Set(gestureData.map((item) => item.label))];
}

function recordGesture(evt) {
  // disable the recording button

  evt.target.disabled = true;

  let gestureID = evt.target.closest(".gesture-container").id.toLowerCase();
  console.log("recording gestureID: ", gestureID);
  currentGesture = gestureID;
  isCollectingData = true;

  if (!recordCountdownRunning) {
    // first run a 3 / 2 / 1 countdown before recording
    countdownTimer.start(
      preRecordTime,
      evt.target,
      preRecordStart,
      preRecordTimeLeft,
      atPreRecordTimeEnd
    );
  }
}

function gestureLabel(gestureName, isTrained) {
  let label = document.createElement("label");
  let trainLabel = isTrained ? "trained" : "untrained";
  label.classList.add("gesture", trainLabel);
  let labelName = document.createElement("span");
  labelName.classList.add("name");
  labelName.innerHTML = gestureName;
  label.append(labelName);

  let removeBtn = document.createElement("div");
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
    let gestureName = prompt("Enter your gesture name: ", "");

    if (gestureName) {
      if (getCurrentGestures().includes(gestureName)) {
        alert(
          `The name ${gestureName} is already been used. Please choose a new name.`
        );
      } else {
        // format with all lower case and hyphens in place of spaces
        gestureName = gestureName.replace(/\s+/g, "-").toLowerCase();

        let gestureUI = buildNewGestureUI(gestureName);

        let parentContainer = document.getElementById("custom-gestures");
        parentContainer.prepend(gestureUI);

        // update analytics
        logAddedGesture(gestureName);

        updateMLBtns();
      }
    }
  }
}

function buildNewGestureUI(gestureName) {
  // create gesture container UI
  let gestureContainer = document.createElement("div");
  gestureContainer.classList.add(
    "gesture-container",
    "custom-gesture",
    "incomplete"
  );
  gestureContainer.setAttribute("id", gestureName);

  // label.addEventListener("click", renameGesture);
  let leftContainer = document.createElement('div');
  leftContainer.classList.add('left-container')
  leftContainer.append(gestureLabel(gestureName, false));

  // show / hide data button
  let toggleDataBtn = document.createElement("button");
  toggleDataBtn.classList.add("toggle-data-btn", "hidden");
  toggleDataBtn.innerHTML = hideIcon + "Hide Data";
  toggleDataBtn.addEventListener("click", function () {
    toggleDataVisibility(gestureName);
  });

  leftContainer.append(toggleDataBtn);

  // add new gesture container
  gestureContainer.append(leftContainer);

  let dataContainer = document.createElement("div");
  dataContainer.classList.add("data-container");

  let recordContainer = document.createElement("div");
  recordContainer.classList.add("record-btn-container");

  let recordGestureBtn = document.createElement("button");
  recordGestureBtn.innerHTML = "Record Gesture";
  recordGestureBtn.classList.add("record-btn");
  recordGestureBtn.addEventListener("click", recordGesture);
  recordContainer.append(recordGestureBtn);

  let countdownContainer = document.createElement("div");
  countdownContainer.innerHTML = "2.00"; // two second timer
  countdownContainer.classList.add("countdown-timer");
  recordContainer.append(countdownContainer);
  dataContainer.append(recordContainer);

  let sampleCounter = document.createElement("div");
  sampleCounter.classList.add("sample-counter");
  gestureContainer.append(sampleCounter);

  let sampleContainer = document.createElement("div");
  sampleContainer.classList.add("sample-container");
  sampleContainer.setAttribute("id", name);
  dataContainer.append(sampleContainer);

  gestureContainer.append(dataContainer);
  return gestureContainer;
}

function toggleDataVisibility(gestureName) {
  let triggerBtn = event.target;

  let dataContainer = document.querySelector(`#${gestureName} .data-container`);
  if (triggerBtn.innerHTML.indexOf(hideIcon) >= 0) {
    triggerBtn.innerHTML = showIcon + "Show Data";
  } else {
    triggerBtn.innerHTML = hideIcon + "Hide Data";
  }
  dataContainer.classList.toggle("hidden");
}

function renameGesture(evt) {
  let newName = prompt("Enter a new name: ", "");
  if (newName.length > 0) {
    evt.target.closest("label").innerHTML = newName + pencilIcon;
  }
}

function updateMLBtns() {
  let newGestureBtn = document.getElementById("new-gesture-btn");
  let recordGestureBtns = document.getElementsByClassName("record-btn");

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
  let accelX = accelXSample.slice(0);
  let accelY = accelYSample.slice(0);
  let accelZ = accelZSample.slice(0);

  let targetGesture = document.querySelector(`#${currentGesture}`).id;

  // sample length seems to vary between 90 - 97
  let sampleLength = 90;
  let xData = accelX.slice(0, sampleLength);
  let yData = accelY.slice(0, sampleLength);
  let zData = accelZ.slice(0, sampleLength);
  // console.log('exampleData: ', exampleData);

  // add to gestureData JSON
  gestureData.push({
    x: xData,
    y: yData,
    z: zData,
    label: targetGesture,
    id: id
  });

  // increment sample size
  let newSampleSize = updateSampleCounter(targetGesture);

  // update traning btns
  updateMLBtns();
  console.log(" ");
}



// shown in console UI
function updateStatusContainer(status) {
  let statusLabel = document.getElementById("status-label");
  let trainedGestures = getCurrentGestures();

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
  console.log("loaded data from file ", model.data);

  // gestureData = model.data.data.raw.slice();
  trainedGestures = [];
  modelNeedsTraining = true;

  // train the model
  trainModel();
}

function modelLoaded() {
  console.log("default gestures loaded");

  // populate default gestures container based on model data
  addDefaultGestures();

  // gestureData = model.data.data.raw.slice();
  modelNeedsTraining = true;

  runPrediction();
}

function exportData() {
  let fileName = "data_" + new Date().getTime() + ".json";
  let fileContent = JSON.stringify({ data: gestureData });

  let element = document.createElement('a');
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
    let prediction = setInterval(function () {
      if (gestureData.length > 0) {
        runPrediction();
      }
    }, 300);
  }
}

function runPrediction() {
  let num_samples = 90; // about 2 seconds worth of data

  if (microbitPaired && !isTraining && accelXArr.length > num_samples) {
    // let num_samples = 1;
    let axData = accelXArr.slice(
      Math.max(accelXArr.length - num_samples, 1)
    );
    let ayData = accelYArr.slice(
      Math.max(accelYArr.length - num_samples, 1)
    );
    let azData = accelZArr.slice(
      Math.max(accelZArr.length - num_samples, 1)
    );

    // run DTW
    let dist = [];
    let minDist = 0;
    let prediction;
    for (i = 0; i < gestureData.length; i++) {
      let trainingData = gestureData[i];
      let xDist = new DynamicTimeWarping(trainingData.x, axData, distFunc).getDistance();
      let yDist = new DynamicTimeWarping(trainingData.y, ayData, distFunc).getDistance();
      let zDist = new DynamicTimeWarping(trainingData.z, azData, distFunc).getDistance();
      let totalDist = xDist + yDist + zDist;
      // console.log('distance for label', trainingData.label, ': ', totalDist);

      if (i == 0 || totalDist < minDist) {
        minDist = totalDist;
        prediction = trainingData.label;
      }
      dist.push({ dist: totalDist, label: trainingData.label });
    }

    let distByGesture = [];
    // now detremine the total distance per label
    let currentGestures = getCurrentGestures();
    for (i = 0; i < currentGestures.length; i++) {
      let avgDist = getAverageDist(dist.filter((item) => item.label == currentGestures[i]).map(item => item.dist));
      distByGesture.push({ label: currentGestures[i], dist: avgDist }); // TODO - maybe we can use this to find samples that are particularly off?
    }

    // console.log('distByGesture before normalization: ', distByGesture);

    // normalize by gesture
    let normalizedDistByGesture = [];

    let maxDist = Math.max(...distByGesture.map((gesture => gesture.dist)));

    for (i = 0; i < distByGesture.length; i++) {
      let gestureObj = {};
      let normalizedDist = 100 - normalize(distByGesture[i].dist, minDist, maxDist, 1, 100);
      gestureObj.label = distByGesture[i].label;
      gestureObj.dist = normalizedDist;
      normalizedDistByGesture.push(gestureObj);
    }

    updateConfidenceGestures(normalizedDistByGesture);
    // display prediction
    showPrediction(prediction);
  }
}

function showPrediction(result) {
  // console.log('results: ', results);
  currentState = result.toLowerCase();
  gestureLog.push(currentState);

  let threshold = 3; // number of times gesture has to be predicted in a row for it to trigger a state change
  let stateChanged = false;

  if (gestureLog.length < threshold) {
    if (currentState != prevState) {
      stateChanged = true;
    }
  } else if (allEqual(lastSlice(gestureLog, threshold)) && currentState != prevState) {
    stateChanged = true;
  }

  // console.log('currentState: ', currentState, ' prevState: ', prevState, ' gestureLog: ' , lastSlice(gestureLog, 3));

  if (stateChanged) {
    updateStatusContainer(currentState);
    // set prediction label to active
    document.querySelector(`#gesture-confidence-container .gesture-container.${currentState}`).classList.add('active');
    let otherGestureContainers = document.querySelectorAll(`#gesture-confidence-container .gesture-container:not(.${currentState})`);
    otherGestureContainers.forEach((el) => {
      el.classList.remove('active');
    });

    console.log("");
    console.log("new state: ", currentState);

    if (document.getElementById("loud-select")) {
      playAudio(currentState);
    }

    // check if should start countdown
    let countdownCheckbox = document.getElementById(
      "timer-countdown-trigger-checkbox"
    );
    if (countdownCheckbox) {
      let countdownChecked = countdownCheckbox.checked;
      if (countdownChecked) {
        let countdownTriggerSelect = document.getElementById(
          "timer-countdown-trigger-select"
        );
        let countdownTrigger = countdownTriggerSelect.options[
          countdownTriggerSelect.selectedIndex
        ].value.toLowerCase();
        // console.log('countdownTrigger: ', countdownTrigger);
        if (countdownTrigger == currentState && !timerCountdownRunning) {

          countdownTimer.start(
            timerCountdownTime,
            document.getElementById("timer-countdown"),
            atCountdownTimerStart,
            countdownTimerDisplay,
            atCountdownTimerEnd
          );
        }
      }
    }
    prevState = currentState;
  }

  // check if volume confidenceThreshold is met
  if (document.getElementById("loud-select") && isLoud()) {
    startPlayback();
    playAudio("loud");
  }
}

function updateTriggers() {
  let currentTriggers = Array.from(document.getElementById('triggers-container').querySelectorAll('.action '))
    .map((item) => item.classList.value.replace('action ', ''));
  let currentGestures = getCurrentGestures();

  // an array of new gestures that have been added
  let addedGestures = currentGestures.filter(gesture => currentTriggers.includes(gesture) == false);
  let removedGestures = currentTriggers.filter(gesture => currentGestures.includes(gesture) == false);

  let timerTrigger = document.getElementById(
    "timer-countdown-trigger-select"
  );

  addedGestures.forEach(function (gesture) {
    console.log("adding trigger element for ", gesture);
    // add a new trigger element
    let triggersContainer = document.querySelector("#triggers-container .content");
    let newTriggerContainer = document.createElement("div");
    newTriggerContainer.classList.add("action", gesture);

    let descriptionContainer = document.createElement("div");
    descriptionContainer.classList.add("description");

    let gestureSelectContainer = document.createElement("select");
    gestureSelectContainer.setAttribute("id", `${gesture}-select`);
    // add defualt audio elements
    gestureSelectContainer.innerHTML = `<option value="none"> None</option>
        <option value="random">🔀 Random</option>
        <option value="silence">🔇 Silence</option>
        `;
    gestureSelectContainer.classList.add("audio-select");

    descriptionContainer.innerHTML = `On <label>${gesture}</label>, play sound<br/>`;
    descriptionContainer.append(gestureSelectContainer);
    newTriggerContainer.append(descriptionContainer);
    triggersContainer.prepend(newTriggerContainer);

    // update timer trigger
    timerTrigger.options.add(new Option(gesture, gesture));

    populateSelects();
  });

  removedGestures.forEach(function (gesture) {
    // remove the trigger element
    document.querySelector(`.action.${gesture}`).remove();

    let timerOption = timerTrigger.querySelector(`option[value="${gesture}"]`);
    if (timerOption) {
      timerOption.remove();
    }
  });

  populateSelects();

}

function getCurrentGestures() {
  // this is a list of all gestures on the page, both trained and untrained
  // used to determine if there's a naming conflict
  return [...new Set(gestureData.map((item) => item.label))];
}

// record timer functions
function atRecordTimerStart(display) {
  recordCountdownRunning = true;
  display.classList.add("active");
  accelXSample = [];
  accelYSample = [];
  accelZSample = [];
}

function recordTimerDisplay(timeLeft) {
  return timeLeft.toFixed(2);
}

// atRecordTimeEnd - finished recording gesture
function atRecordTimeEnd(timeLimit, display) {
  isCollectingData = false;
  recordCountdownRunning = false;
  display.innerHTML = timeLimit.toFixed(2); // initial countdown time with two decimal places
  display.classList.remove("active");

  let recordBtn = document.querySelector(`#${currentGesture} .record-btn`);
  recordBtn.disabled = false;
  recordBtn.innerHTML = "Record Gesture";

  let dataId = new Date().getTime();

  let parentContainer = document.querySelector(`#${currentGesture} .sample-container`);
  generatePlotly(dataId, parentContainer, accelXSample, accelYSample, accelZSample);

  // add data
  addNewData(dataId);

  // update analytics
  logAddedSample(currentGesture);
}

// countdown timer functions
function atCountdownTimerStart() {
  timerCountdownRunning = true;
  // check whether to loop audio
  let countdownStartSelect = document.getElementById(
    "timer-countdown-start-select"
  );
  let audioFileName = countdownStartSelect.options[
    countdownStartSelect.selectedIndex
  ].value.toLowerCase();
  let audioEl = document.getElementById(audioFileName + "-audio");
  if (
    document.getElementById("timer-countdown-start-loop-checkbox").checked &&
    audioEl
  ) {
    audioEl.loop = true;
  } else if (audioEl) {
    audioEl.loop = false;
  }

  // play audio
  playAudio("timer-countdown-start");
}

// returns content to display in the timer display element
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
}

// CONFIDENCE ADJUSTMENTS - THRESHOLD TO TRIGGER NEW GESTURE

function showConfidence(confidences) {
  let labels = confidences.map((item) => item.label);

  labels.forEach(function (labelName, index) {
    let gestureContainer = document.querySelector(`#gesture-confidence-container .gesture-container.${labelName}`);
    let confidenceEl = document.querySelector(`#gesture-confidence-container .confidence.${labelName}`);
    let confidence = confidences[index].dist;
    confidenceEl.style.width = confidence + "%";
  });
}

function toggleOptions() {
  let optionsContainer = document.querySelector('#options-container');
  let isMinimized = optionsContainer.classList.contains('minimized');
  optionsContainer.classList.toggle('minimized');

  // update caret content
  let caret = document.getElementById('options-expand-btn')
  if (isMinimized) {
    caret.innerHTML = '<i class="fas fa-chevron-up"></i>';
  } else {
    caret.innerHTML = '<i class="fas fa-chevron-down"></i>';
  }
}

function showOptions() {
  let optionsContainer = document.querySelector('#options-container');
  optionsContainer.classList.remove('minimized');
  let caret = document.getElementById('options-expand-btn')
  caret.innerHTML = '<i class="fas fa-chevron-up"></i>';
}

function toggleDescription(el) {
  el.parentElement.querySelector('.description').classList.toggle('hidden');
}


// FOR DEBUG MODE
function debug() {
  debugMode = !debugMode;
  document.getElementById('debug-container').classList.toggle('hidden');
}

// COPYING DATA SAMPLE FOR LOGGING PURPOSES
function logAddedSample(gestureName){
  let user = getUser();
  let samples = getNumSamples(gestureName);
  mixpanel.track('Add Sample', {'Gesture Name': gestureName, 'Samples': samples});
}

function logRemovedSample(gestureName){
  let user = getUser();
  let samples = getNumSamples(gestureName);
  mixpanel.track('Remove Sample', {'Gesture Name': gestureName, 'Samples': samples});
}

// this actually isn't a mixpanel function - use to copy gesture JSON data to clipboard
let copyBtn = new ClipboardJS('#copy-btn', {
  text: function(){
      return JSON.stringify({data: gestureData});
  }
});

tippy('#copy-btn', {
  content: 'Copy Gesture Data'
});

let tooltip = tippy(document.querySelector('#copy-btn'));

copyBtn.on('success', function(e){
  tooltip.setContent('Copied to Clipboard!');
  tooltip.show();
  setInterval(function(){
      tooltip.setContent('Copy Gesture Data');
  }, 5000);
});

// UTILS

let distFunc = function (a, b) {
  return Math.abs(a - b);
}

function lastSlice(arr, sliceLength) {
  return arr.slice(Math.max(arr.length - sliceLength, 1));
}

const allEqual = arr => arr.every(val => val === arr[0]);

const totalReducer = (accumulator, currentValue) => accumulator + currentValue;

const getAverageDist = (array) => {
  return array.reduce(totalReducer) / array.length;
}

const normalize = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}