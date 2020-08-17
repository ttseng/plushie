// MODEL LOADING PARAMETERS
let shouldLoadDefaultGestures = true;
let shouldLoadModel = true;
let withPeaks = true;
let dataDirectory = "data/none-bow-shake-peaks";

// ml5js
let model;
const numEpochs = 120; // change to 120 when not testing

let isCollectingData = false;
let isTraining = false;
let trainedGestures;

let pencilIcon = "<i class='fas fa-pencil-alt'></i>";

// warning messages
let insufficientDataWarning =
  "You need at least 3 samples for each gesture to train the model.";
let insufficientGesturesWarning =
  "You need at least 2 gestures to train the model. Add some more gestures!";

let removeIcon = '<i class="fas fa-times"></i>';

// p5 / ml5 stuff
function setup() {
  // p5js canvas
  let canvas = createCanvas(250, 250, WEBGL);
  canvas.parent("p5js-container");

  createNeuralNetwork();

  // load default gestures
  if (shouldLoadDefaultGestures) {
    loadDefaultGestures();
  }
}

function createNeuralNetwork() {
  // ml5js neural network
  let options = {
    inputs: [
      "ax_max",
      "ax_min",
      "ax_std",
      "ax_peaks",
      "ay_max",
      "ay_min",
      "ay_std",
      "ay_peaks",
      "az_max",
      "az_min",
      "az_std",
      "az_peaks",
    ],
    outputs: ["gesture"],
    task: "classification",
    debug: "false",
    learningRate: 0.5,
  };

  let options_no_peaks = {
    inputs: [
      "ax_max",
      "ax_min",
      "ax_std",
      "ay_max",
      "ay_min",
      "ay_std",
      "az_max",
      "az_min",
      "az_std",
    ],
    outputs: ["gesture"],
    task: "classification",
    debug: "false",
    learningRate: 0.5,
  };

  if (withPeaks) {
    model = ml5.neuralNetwork(options);
  } else {
    model = ml5.neuralNetwork(options_no_peaks);
  }
}

// currently drawing the taurus to show microbit orientation
function draw() {
  background(0);
  orbitControl();
  translate(0, 0, 0);
  normalMaterial();
  push();
  rotateX(-asin(sinY));
  rotateY(asin(sinX));
  torus(100, 20);
  pop();
}

function loadDefaultGestures() {
  console.log("load default gesture data");
  // load default data
  model.loadData(`${dataDirectory}/gestures.json`, dataLoaded);

  if (shouldLoadModel) {
    // load default model
    console.log("load default gesture model");
    const modelInfo = {
      model: `${dataDirectory}/model.json`,
      metadata: `${dataDirectory}/model_meta.json`,
      weights: `${dataDirectory}/model.weights.bin`,
    };

    model.load(modelInfo, modelLoaded);
  }
}

function addDefaultGestures() {
  let container = document.getElementById("default-gestures");
  let gestures = getModelGestures();
  trainedGestures = gestures;  

  gestures.forEach(function (gestureName) {
    container.append(gestureLabel(gestureName, true));
  });
}

function removeGesture(evt) {
  let gestureLabelEl = evt.target.closest('label');
  let gestureName = gestureLabelEl.querySelector('.name').innerHTML;
  let isTrained = gestureLabelEl.classList.contains('trained');

  let isTrainedAlert = "Are you sure you want to remove this gesture? You'll have to retrain the model.";
  let isUntrainedAlert =  "Are you sure you want to remove this gesture?";
  let alertMsg = isTrained ? isTrainedAlert : isUntrainedAlert;

  let remove = confirm(
    alertMsg
  );
  if (remove) {
    console.log("remove ", gestureName);

    if(isTrained){
        console.log('remove trained gesture');
        if(gestureLabelEl.closest('.gesture-container')){
            // remove the custom gesture
            gestureLabelEl.closest('.gesture-container').remove();
        }else{
            // remove default gesture
            gestureLabelEl.remove();
        }
        
        // remove corresponding trigger
        let actionEl = document.querySelector(`.action.${gestureName}`);
        if(actionEl){
            actionEl.remove();
            modelNeedsTraining = true;
        }
    }else{
        // remove gestureContainer
        console.log('remove untrained gesture');
        gestureLabelEl.closest('.gesture-container').remove();
    }
    
    hideStatusContainer();

    // clean gestureData of this gesture's info
    gestureData = gestureData.filter((data) => data.ys.gesture !== gestureName);

    updateMLBtns();
  }
}

function getModelGestures() {
  return model.data.meta.outputs.gesture.uniqueValues;
}

function recordGesture(evt) {
  evt.target.disabled = true;
  let gestureID = evt.target.closest(".gesture-container").id.toLowerCase();
  console.log("recording gestureID: ", gestureID);
  currentGesture = gestureID;
  isCollectingData = true;
  recordCountdown.start();
}

function gestureLabel(gestureName, isTrained){
    let label = document.createElement("label");
    let trainLabel = isTrained ? "trained" : "untrained";
    label.classList.add("gesture", trainLabel);
    let labelName = document.createElement('span');
    labelName.classList.add('name');
    labelName.innerHTML = gestureName;
    label.append(labelName);

    let removeBtn = document.createElement('div');
    removeBtn.classList.add('remove');
    removeBtn.innerHTML = removeIcon;
    removeBtn.addEventListener('click', removeGesture);
    label.append(removeBtn);
    return label;
}

function addNewGesture(evt) {
  let gestureName = prompt("Enter your gesture name: ", "");

  if (gestureName) {
    // format with all lower case and hyphens in place of spaces
    gestureName = gestureName.replace(/\s+/g, "-").toLowerCase();

    // create gesture container UI
    let gestureContainer = document.createElement("div");
    gestureContainer.classList.add(
      "gesture-container",
      "custom-gesture",
      "incomplete"
    );
    gestureContainer.setAttribute("id", gestureName);

    // label.addEventListener("click", renameGesture);
    gestureContainer.append(gestureLabel(gestureName, false));

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
    gestureContainer.append(recordContainer);

    let sampleCounter = document.createElement("div");
    sampleCounter.classList.add("sample-counter");
    sampleCounter.innerHTML = `record at least 3 samples`;
    gestureContainer.append(sampleCounter);

    let sampleContainer = document.createElement("div");
    sampleContainer.classList.add("sample-container");
    sampleContainer.setAttribute("id", name);
    gestureContainer.append(sampleContainer);

    let parentContainer = document.getElementById("custom-gestures");
    parentContainer.prepend(gestureContainer);

    updateMLBtns();
  }
}

function renameGesture(evt) {
  let newName = prompt("Enter a new name: ", "");
  if (newName.length > 0) {
    evt.target.closest("label").innerHTML = newName + pencilIcon;
  }
}

function enableTrainBtn() {
  let trainModelBtn = document.getElementById("train-btn");
  trainModelBtn.disabled = false;
  trainModelBtn.classList.add("active");
  modelNeedsTraining = true;
}

function disableTrainBtn() {
  let trainModelBtn = document.getElementById("train-btn");
  trainModelBtn.disabled = true;
  trainModelBtn.classList.remove("active");
  modelNeedsTraining = false;
}

function showWarning(msg) {
  let warning = document.getElementById("warning");
  warning.innerHTML = msg;
  warning.classList.remove("hidden");
}

function hideWarning() {
  let warning = document.getElementById("warning");
  warning.classList.add("hidden");
}

function updateMLBtns() {
  let newGestureBtn = document.getElementById("new-gesture-btn");
  let recordGestureBtns = document.getElementsByClassName("record-btn");

  // the train model btn should be disabled if there are any incomplete gestures
  if (document.getElementsByClassName("incomplete").length > 0) {
    // there are some newly added gestures that don't have enough samples yet - require more samples before retraining
    disableTrainBtn();
    showWarning(insufficientDataWarning);
  } else {
    let trainedGesturesEls = document.querySelectorAll("label.trained");
    let numTrainedGestures = trainedGesturesEls ? trainedGesturesEls.length : 0;
    let untrainedGesturesEls = document.querySelectorAll("label.untrained");
    let numUntrainedGestures = untrainedGesturesEls
      ? untrainedGesturesEls.length
      : 0;

    if (numTrainedGestures + numUntrainedGestures < 2) {
      disableTrainBtn();
      showWarning(insufficientGesturesWarning);
    } else {
      if (modelNeedsTraining) {
        // the user has removed gestures and the model needs to be retrained
        enableTrainBtn();
        hideWarning();
      } else if (document.getElementsByClassName("ready").length > 0) {
        // there are new gestures that haven't been added to the model yet
        enableTrainBtn();
        hideWarning();
      }else{
          hideWarning();
      }
    }

    // determine whether to hide or show detected gesture status in console
    if(document.querySelectorAll('label.untrained') && document.querySelectorAll('label.untrained').length > 0){
        hideStatusContainer();
    }else{
        showStatusContainer();
    }
  }

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
  let gestureDataStart = gestureData.slice();
  console.log('start add data with gestureDataStart.length: ', gestureDataStart.length, gestureDataStart);
  let accelX = accelXSample.slice(0);
  let accelY = accelYSample.slice(0);
  let accelZ = accelZSample.slice(0);

  let inputs = {
    ax_max: Math.max(...accelX),
    ax_min: Math.min(...accelX),
    ax_std: standardDeviation(accelX),
    ax_peaks: peaksArr[0],
    ay_max: Math.max(...accelY),
    ay_min: Math.min(...accelY),
    ay_std: standardDeviation(accelY),
    ay_peaks: peaksArr[1],
    az_max: Math.max(...accelZ),
    az_min: Math.min(...accelZ),
    az_std: standardDeviation(accelZ),
    az_peaks: peaksArr[2],
  };

  let inputs_no_peaks = {
    ax_max: Math.max(...accelX),
    ax_min: Math.min(...accelX),
    ax_std: standardDeviation(accelX),
    ay_max: Math.max(...accelY),
    ay_min: Math.min(...accelY),
    ay_std: standardDeviation(accelY),
    az_max: Math.max(...accelZ),
    az_min: Math.min(...accelZ),
    az_std: standardDeviation(accelZ),
  };

  let targetGesture = document.querySelector(`#${currentGesture}`).id;

  let target = {
    gesture: targetGesture,
  };

  if (withPeaks) {
    model.addData(inputs, target);
  } else {
    model.addData(inputs_no_peaks, target);
  }

  // add to gestureData JSON
  if (withPeaks) {
    gestureData.push({
      xs: inputs,
      ys: target,
      id: id
    });
  } else {
    gestureData.push({
      xs: inputs_no_peaks,
      ys: target,
      id: id
    });
  }

  // increment sample size
  updateSampleCounter();

  // update training btns
  updateMLBtns();

  console.log("added data to gesture ", targetGesture);

  console.log('end add data with gestureData.length: ', gestureData.length, gestureData);
  console.log(" ");
}

// shown in console UI
function updateStatusContainer(status) {
  document.getElementById("status-label").innerHTML = "Detected Gesture:";
  document.getElementById("status").innerHTML = status;
}

function hideStatusContainer() {
  document.getElementById("status-container").classList.add("hidden");
}

function showStatusContainer() {
  document.getElementById("status-container").classList.remove("hidden");
}

function dataLoaded() {
  console.log("loaded data ", model.data);
  loadedData = true;
}

function modelLoaded() {
  console.log("default gestures loaded");

  // populate default gestures container based on model data
  addDefaultGestures();

  gestureData = model.data.data.raw.slice();
  modelNeedsTraining = true;
  runPrediction();
}

function exportData() {
  model.saveData("data_" + new Date().getTime());
}

function trainModel() {
  console.log("train model");

  if (modelNeedsTraining) {
    // reset model and re-add data
    createNeuralNetwork();
    gestureData.forEach(function (item) {
      let inputs = item.xs;
      let target = item.ys;
      model.addData(inputs, target);
    });
  }

  // export the dataset
  exportData();

  model.normalizeData();

  let options = {
    epochs: numEpochs,
  };
  isTraining = true;
  updateMLBtns();

  model.train(options, whileTraining, finishedTraining);
}

function whileTraining(epoch, loss) {
  console.log("epoch: ", epoch);
}

function finishedTraining() {
  console.log("finished training");
  modelNeedsTraining = false;
  isTraining = false;

  // show status container with prediction
  showStatusContainer();

  // add new triggers
  updateTriggers();

  // remove any unneeded incomplete divs
  Array.from(document.getElementsByClassName("ready")).forEach(function (el) {
    el.classList.remove("ready");
    el.querySelector("label").classList.remove("untrained");
    el.querySelector("label").classList.add("trained");
  });

  // update training btns
  updateMLBtns();

  runPrediction();
}

function runPrediction() {
  console.log("run prediction");

  let prediction = setInterval(function () {
    let num_samples = 97;

    if (microbitPaired && !isTraining && accelXArr.length > num_samples) {
      // this is based on the length of the arrays from the dataset
      // let num_samples = 1;
      let ax_data = accelXArr.slice(
        Math.max(accelXArr.length - num_samples, 1)
      );
      let ay_data = accelYArr.slice(
        Math.max(accelYArr.length - num_samples, 1)
      );
      let az_data = accelZArr.slice(
        Math.max(accelZArr.length - num_samples, 1)
      );
      // console.log('ax_data', ax_data, 'ay_data', ay_data, 'az_data', az_data);

      let inputs = {
        ax_max: Math.max(...ax_data),
        ax_min: Math.min(...ax_data),
        ax_std: standardDeviation(ax_data),
        ax_peaks: peaks(ax_data).numPeaks,
        ay_max: Math.max(...ay_data),
        ay_min: Math.min(...ay_data),
        ay_std: standardDeviation(ay_data),
        ay_peaks: peaks(ay_data).numPeaks,
        az_max: Math.max(...az_data),
        az_min: Math.min(...az_data),
        az_std: standardDeviation(az_data),
        az_peaks: peaks(az_data).numPeaks,
      };

      let inputs_no_peaks = {
        ax_max: Math.max(...ax_data),
        ax_min: Math.min(...ax_data),
        ax_std: standardDeviation(ax_data),
        ay_max: Math.max(...ay_data),
        ay_min: Math.min(...ay_data),
        ay_std: standardDeviation(ay_data),
        az_max: Math.max(...az_data),
        az_min: Math.min(...az_data),
        az_std: standardDeviation(az_data),
      };

      if (withPeaks) {
        model.classify(inputs, predictionResults);
      } else {
        model.classify(inputs_no_peaks, predictionResults);
      }
    }
  }, 300);
}

function predictionResults(error, results) {
  if (error) {
    console.log("prediction result error!");
    console.error(error);
    return;
  }
  updateStatusContainer(results[0].label);

  // play sounds
  currentState = results[0].label.toLowerCase();

  if (currentState != prevState) {
    console.log("");
    console.log("new state: ", currentState);

    playAudio(currentState);

    // check if should start countdown
    let countdownChecked = document.getElementById(
      "timer-countdown-trigger-checkbox"
    ).checked;
    if (countdownChecked) {
      let countdownTriggerSelect = document.getElementById(
        "timer-countdown-trigger-select"
      );
      let countdownTrigger = countdownTriggerSelect.options[
        countdownTriggerSelect.selectedIndex
      ].value.toLowerCase();
      // console.log('countdownTrigger: ', countdownTrigger);
      if (countdownTrigger == currentState && !timerCountdownRunning) {
        console.log("start countdown");
        timerCountdown.start();
      }
    }
  }
  prevState = currentState;

  // check if volume threshold is met
  if (isLoud()) {
    startPlayback();
    playAudio("loud");
  }
}

function updateTriggers() {
  let newGestures = model.data.meta.outputs.gesture.uniqueValues.filter(
    (gesture) => trainedGestures.includes(gesture) == false
  ); // newly added gestures
  newGestures.forEach(function (gesture) {
    console.log("adding trigger element for ", gesture);
    // add a new trigger element
    let triggersContainer = document.querySelector("#triggers .content");
    let newTriggerContainer = document.createElement("div");
    newTriggerContainer.classList.add("action");

    let descriptionContainer = document.createElement("div");
    descriptionContainer.classList.add("description");

    let gestureSelectContainer = document.createElement("select");
    gestureSelectContainer.setAttribute("id", `${gesture}-select`);
    // add defualt audio elements
    gestureSelectContainer.innerHTML = `<option value="none">🔇 None</option>
      <option value="random">🔀 Random</option>`;
    gestureSelectContainer.classList.add("audio-select");

    descriptionContainer.innerHTML = `On <label>${gesture}</label>, play sound<br/>`;
    descriptionContainer.append(gestureSelectContainer);
    newTriggerContainer.append(descriptionContainer);
    triggersContainer.prepend(newTriggerContainer);
    populateSelects();

    // update timer trigger
    let timerTrigger = document.getElementById(
      "timer-countdown-trigger-select"
    );
    timerTrigger.options.add(new Option(gesture, gesture));
  });

  trainedGestures = getModelGestures();
}

function saveModel() {
  model.save();
}
