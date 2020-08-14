// MODEL LOADING PARAMETERS
let shouldLoadDefaultGestures = true;
let shouldLoadModel = true;
let withPeaks = true;
let dataDirectory = "none-bow-shake-peaks";
const numEpochs = 5; // change to 120 when not testing

// Microbit Bluetooth documentation: https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html
let accelService = null;
let accelCharacteristic = null;

// ACCELEROMETER
const ACCEL_SERVICE = "e95d0753-251d-470a-a062-fa1922dfa9a8".toLowerCase();
const ACCEL_DATA = "E95DCA4B-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const ACCEL_PERIOD = "E95DFB24-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const services = [ACCEL_SERVICE];

let microbitPaired = false;

let collectingData = false;

let lastAccelX = 0;
let lastAccelY = 0;
let lastAccelZ = 0;

let accelXArr = [];
let accelYArr = [];
let accelZArr = [];

let accelXSample = [];
let accelYSample = [];
let accelZSample = [];

let sinX;
let sinY;

let currentState;
let prevState;
let isPlaying = false;

let recordCountdownTime = 200; // time to record gesture = 3 seconds
let recordCountdownRunning = false;

let timerCountdownTime = 10; // 10 seconds
let timerCountdownRunning = false;

// for smoothiechart.js
let smoothie;
let accelXSeries = new TimeSeries();
let accelYSeries = new TimeSeries();
let accelZSeries = new TimeSeries();

// for plot.ly
let peaksArr = [];

// ML stuff
let currentGesture;
let loadedData = false;
let gestureData = [];
let modelNeedsTraining = false;
let isTraining = false;
let trainedGestures = [];

let voices;
let lang = "en-GB"; // target language
let synth = window.speechSynthesis; // speech synthesizer
let targetVoice;

let volume = 0;
let loudThreshold = document.getElementById('noise-input-threshold').value; 

let pencilIcon = "<i class='fas fa-pencil-alt'></i>";

// let loudThreshold = document.getElementById('noise-input-threshold').value;

let sensorDataLoaded = false;

// ml5js
let model;

function getVoices() {
  voices = synth.getVoices();
  targetVoice = voices.filter((voice) => voice.lang == lang)[0];
  if (!targetVoice) {
    // correct for mobile
    lang = lang.replace(/-/g, "_");
    targetVoice = voices.filter((voice) => voice.lang == lang)[0];
  }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = getVoices;
}

getVoices();

function showUI() {
  console.log("show ui");
  Array.from(document.getElementsByClassName("hidden-on-load")).forEach(
    function (el, index, array) {
      el.style.visibility = "initial";
      el.style.display = "inline-block";
    }
  );
}

async function pair() {
  if (!navigator.bluetooth) {
    showModal("Web Bluetooth is not supported in this browser.");
    return;
  }
  // requestDevice();
  try {
    console.log("requesting bluetooth device...");
    document.getElementById("status").innerHTML =
      "requesting bluetooth device...";
    const uBitDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "BBC micro:bit" }],
      optionalServices: services,
    });
    uBitDevice.addEventListener(
      "gattserverdisconnected",
      onMicrobitDisconnected
    );
    document.getElementById("status-container").style.display = "inline";
    document.getElementById("pair-btn").style.display = "none";

    console.log("connecting to GATT server...");
    document.getElementById("status").innerHTML =
      "connecting to GATT server...";
    const server = await uBitDevice.gatt.connect();

    console.log("getting service...");
    document.getElementById("status").innerHTML = "getting service...";
    accelService = await server.getPrimaryService(ACCEL_SERVICE);

    console.log("getting characteristics...");
    document.getElementById("status").innerHTML = "getting characteristics...";
    accelCharacteristic = await accelService.getCharacteristic(ACCEL_DATA);
    accelCharacteristic.startNotifications();

    accelCharacteristic.addEventListener(
      "characteristicvaluechanged",
      accelChanged
    );

    // show UI
    showUI();
    updateStatusContainer("");

    let reconnectBtn = document.getElementById("reconnect-btn");
    reconnectBtn.classList.remove("active");

    if (!sensorDataLoaded) {
      collectData();
      sensorDataLoaded = true;
      microbitPaired = true;
    }
  } catch (error) {
    showModal(error);
  }
}

function onMicrobitDisconnected() {
  console.log("microbit disconnected");

  // pause smoothie
  smoothie.stop();
  // pause prediction
  microbitPaired = false;

  // make pair button active
  let reconnectBtn = document.getElementById("reconnect-btn");
  reconnectBtn.classList.add("active");
}

function updateStatusContainer(status) {
  document.getElementById("status-label").innerHTML = "Detected Gesture:";
  document.getElementById("status").innerHTML = status;
}

function runSmoothie() {
  console.log("run smoothie");
  collectingData = true;
  collectData();
}

function collectData() {
  accelXArr = [];
  accelYArr = [];
  accelZArr = [];

  smoothie = new SmoothieChart({ tooltip: true });
  smoothie.addTimeSeries(accelXSeries, { strokeStyle: "red" });
  smoothie.addTimeSeries(accelYSeries, { strokeStyle: "green" });
  smoothie.addTimeSeries(accelZSeries, { strokeStyle: "blue" });
  smoothie.streamTo(document.getElementById("smoothie-chart"), 1000); // delay in MS
  smoothie.start();
}

function accelChanged(event) {
  // only run this when we're recording
  // Retrieve acceleration values,
  // then convert from milli-g (i.e. 1/1000 of a g) to g
  // console.log(event.target.value);
  const accelX = event.target.value.getInt16(0, true) / 1000.0;
  const accelY = event.target.value.getInt16(2, true) / 1000.0;
  const accelZ = event.target.value.getInt16(4, true) / 1000.0;

  // https://create.arduino.cc/projecthub/RVLAD/free-fall-detection-using-3-axis-accelerometer-06383e
  accelT = Math.sqrt(
    Math.pow(accelX, 2) + Math.pow(accelY, 2) + Math.pow(accelZ, 2)
  );
  accelT = Number(accelT.toFixed(2));

  const smoothedAccelX = accelX * 0.2 + lastAccelX * 0.8;
  const smoothedAccelY = accelY * 0.2 + lastAccelY * 0.8;
  const smoothedAccelZ = accelZ * 0.2 + lastAccelZ * 0.8;

  lastAccelX = smoothedAccelX;
  lastAccelY = smoothedAccelY;
  lastAccelZ = smoothedAccelZ;

  sinX = constrain(smoothedAccelX, -1, 1);
  sinY = constrain(smoothedAccelY, -1, 1);

  accelXArr.push(smoothedAccelX);
  accelYArr.push(smoothedAccelY);
  accelZArr.push(smoothedAccelZ);

  accelXSample.push(smoothedAccelX);
  accelYSample.push(smoothedAccelY);
  accelZSample.push(smoothedAccelZ);

  accelXSeries.append(new Date().getTime(), smoothedAccelX);
  accelYSeries.append(new Date().getTime(), smoothedAccelY);
  accelZSeries.append(new Date().getTime(), smoothedAccelZ);
}

function playAudio(name) {
  console.log("play audio for ", name);
  // stop all audio if countdown isn't running
  if (!timerCountdownRunning && currentState != "none") {
    stopAllAudio();
  }

  // play corresponding audio
  let selectEl = document.getElementById(name + "-select");
  if (selectEl) {
    let audioFileName = selectEl.options[
      selectEl.selectedIndex
    ].value.toLowerCase();

    // play corresponding audio element
    let audioEl = document.getElementById(audioFileName + "-audio");
    if (audioEl) {
      // check if it needs to be looped
      if (name.includes("countdown")) {
        let loopChecked = document.getElementById(name + "-loop-checkbox");
        if (loopChecked && loopChecked.checked) {
          audioEl.loop = true;
        }
      }
      console.log("play ", audioFileName);
      audioEl.play();
    } else if (audioFileName == "random") {
      console.log("play random");
      playRandomSound();
    } else if (audioFileName != "none") {
      // need to do text to speech
      speak(audioFileName);
    }
  }
}

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

function showTextSpeechModal() {
  $("#textToSpeechModal").modal("show");
}

function showModal(message) {
  document.getElementsByName("modal-message")[0].innerHTML = message;
  $("#myModal").modal("show");
  document.getElementById("pair-btn").style.display = "block";
}

// AUDIO FUNCTIONS

const recordButton = document.getElementById("record-btn");
const recordIcon = document.getElementById("record-icon");
let isRecording = false;
let rec;

function onClickPlay() {
  isPlaying = true;
  // stop all other audio (only for previewing track)
  stopAllAudio();

  let audio = event.target.querySelector("audio");
  if (audio) {
    audio.play();
  } else {
    let text = event.target.parentElement.querySelector(".name").innerHTML;
    speak(text);
  }
}

function playRandomSound() {
  let sounds = document.querySelectorAll("audio");
  sounds[Math.floor(Math.random() * Math.floor(sounds.length))].play();
}

function stopPlayback() {
  isPlaying = false;
  event.target.loop = false;
}

function startPlayback() {
  isPlaying = true;
}

function stopAllAudio() {
  // stop all other audio
  var sounds = document.getElementsByTagName("audio");
  for (i = 0; i < sounds.length; i++) {
    sounds[i].pause();
    sounds[i].currentTime = 0;
  }
}

function removeAudio() {
  let remove = confirm("Are you sure you want to remove this sound?");
  if (remove) {
    event.target.closest(".sound").remove();
    // console.log(event);
    let name = event.target
      .closest(".sound")
      .querySelector(".name")
      .innerHTML.trim();
    // console.log("name to remove ", name);
    removeFromSelects(name);
  }
}

function getAudioPermission() {
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }
  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia =
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    // set up for recording
    rec = new MediaRecorder(stream);
    rec.addEventListener("dataavailable", soundAvailable);
    if (recordButton) {
      recordButton.disabled = false;
    }

    // setup for detection mic levels (https://stackoverflow.com/a/52952907/1720985)
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    javascriptNode.onaudioprocess = function () {
      let array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      let values = 0;

      let length = array.length;
      for (var i = 0; i < length; i++) {
        values += array[i];
      }

      let average = values / length;
      volume = Math.round(average);
      document.getElementById('noise-level').innerHTML = volume;
    };
  });
}

function toggleRecordingState() {
  isRecording = !isRecording;

  if (isRecording) {
    // toggle to recording state and show stop icon on record button
    toggleRecordIcon();
    rec.start();

    // add sound item to page
  } else {
    toggleRecordIcon();
    rec.stop();
  }
}

// called when mediaRecorder is finished
function soundAvailable(e) {
  addSound(e.data);
}

function addSound(data) {
  let name;
  let isTTS = false;

  if (isString(data)) {
    // created from text to speech - skip name prompt
    name = data;
    isTTS = true;
  } else {
    name = prompt("Please enter a name for your sound", "");
  }

  // ask for name of file
  if (name.length > 0) {
    let soundDiv = document.createElement("div");
    soundDiv.classList.add("sound");
    let nameDiv = document.createElement("div");
    nameDiv.classList.add("name");
    nameDiv.innerHTML = name;
    soundDiv.append(nameDiv);

    let playDiv = document.createElement("div");
    playDiv.classList.add("play");
    playDiv.innerHTML = '<i class="fas fa-play"></i>';
    playDiv.addEventListener("click", onClickPlay);
    if (!isTTS) {
      let audioEl = document.createElement("audio");
      audioEl.id = name + "-audio";
      audioEl.src = URL.createObjectURL(data);
      audioEl.type = "audio/mpeg";
      audioEl.classList.add("prepend");
      stopAllAudio();
      audioEl.play();
      playDiv.append(audioEl);
    } else {
      // play the text to speech
      speak(name);
    }
    soundDiv.append(playDiv);

    let removeDiv = document.createElement("div");
    removeDiv.classList.add("remove");
    removeDiv.addEventListener("click", removeAudio);
    removeDiv.innerHTML = '<i class="fas fa-times"></i>';
    soundDiv.append(removeDiv);

    // add to page
    const soundsContainer = document.getElementById("sounds-container");
    const targetContainer = soundsContainer.querySelectorAll(".content")[0];
    targetContainer.prepend(soundDiv);

    // add event listeners
    addAudioEvtListeners();

    // update selects
    addToSelects(name);
  }
}

let loudTriggered = false;
function isLoud() {
  let loudSoundSelect = document.getElementById("loud-select");
  let loudValue = loudSoundSelect.value;
  if (loudValue != "none") {
    if (volume > loudThreshold && !loudTriggered) {
      loudTriggered = true;
      return true;
    } else if (volume < loudThreshold) {
      loudTriggered = false;
    }
  }
  return false;
}

function setNoiseThreshold(newThreshold) {
  loudThreshold = parseInt(newThreshold);
}

document.addEventListener("play", function (e) {
  if (e.target.classList.contains("prepend")) {
    // dynamically added audio element - add event listeners
    console.log("startPlayback callback");
    startPlayback();
  }
});

document.addEventListener("ended", function (e) {
  if (e.target.classList.contains("prepend")) {
    // dynamically added audio element - add event listeners
    console.log("stopPlayback callback");
    stopPlayback();
  }
});

// toggle between the microphone and stop icon of the record button
function toggleRecordIcon() {
  if (recordIcon.classList.contains("fa-microphone")) {
    // show the stop icon
    recordIcon.classList.remove("fa-microphone");
    recordIcon.classList.add("fa-stop");
  } else {
    // show the microphone icon
    recordIcon.classList.remove("fa-stop");
    recordIcon.classList.add("fa-microphone");
  }
}

function textOnChange() {
  let previewBtn = document.getElementById("preview-btn");
  let addTTSbtn = document.getElementById("add-tts-btn");
  if (event.target.value.length > 0) {
    previewBtn.disabled = false;
    addTTSbtn.disabled = false;
  } else {
    previewBtn.disaabled = true;
    addTTSbtn.disabled = true;
  }
}

function checkSubmit() {
  if (!event) event = window.event;
  let keyCode = event.keyCode;
  if (keyCode == "13") {
    addTTS();
  }
}

function previewTTS() {
  console.log("preview tts");
  event.preventDefault();
  let inputTxt = document.getElementById("text");
  console.log("inputTxt: ", inputTxt.value);
  speak(inputTxt.value);
}

function speak(text) {
  let utterThis = new SpeechSynthesisUtterance(text);
  utterThis.voice = targetVoice;
  utterThis.lang = lang;
  utterThis.onstart = startPlayback();
  utterThis.onend = stopPlayback();
  synth.speak(utterThis);
}

function addTTS() {
  let inputTxt = document.getElementById("text");
  let text = inputTxt.value;
  inputTxt.value = ""; // reset field

  // add sound
  addSound(text);
}

function populateSelects() {
  Array.from(document.getElementsByClassName("name")).forEach(function (
    soundNameDiv
  ) {
    let name = soundNameDiv.innerHTML.toLowerCase();
    addToSelects(name);
  });
}

function setDefaultSounds() {
  document.getElementById("shake-select").value = "wow";
  document.getElementById("bow-select").value = "applause";
  document.getElementById("timer-countdown-start-select").value = "tick-tock";
  document.getElementById("timer-countdown-end-select").value = "wow";
}

function addAudioEvtListeners() {
  document.querySelectorAll("audio").forEach(function (el) {
    el.addEventListener("ended", stopPlayback);
    el.addEventListener("play", startPlayback);
  });
}
// const inputFile = document.getElementById('file-upload');
// inputFile.addEventListener('change', function(){
//   addSound(this.files[0]);
// });

function addToSelects(name) {
  // only add if it's not already part of the dropdown
  let existingSounds = Array.from(
    document.querySelector(".audio-select").options
  ).map((e) => e.value);
  if (!existingSounds.includes(name)) {
    Array.from(document.getElementsByClassName("audio-select")).forEach(
      (dropdown) => {
        dropdown.options.add(new Option(`🔊 ${name}`, name));
      }
    );
  }
}

function removeFromSelects(name) {
  Array.from(document.getElementsByClassName("audio-select")).forEach(
    (dropdown) => {
      Array.from(dropdown.options).forEach(function (option) {
        if (option.value === name) {
          option.remove();
        }
      });
    }
  );
}

// states
function isUpsideDown([X, Y, accel]) {
  if (Y < -0.5) {
    return true;
  } else {
    return false;
  }
}

function isLyingDown([X, Y, accel]) {
  if (Y < 0.2 && Y > 0) {
    return true;
  } else {
    return false;
  }
}

function isNeutral([X, Y, accel]) {
  if (Y > 0.8 && standardDeviation(accel) < 0.5) {
    return true;
  } else {
    return false;
  }
}

function isStill([X, Y, accel]) {
  if (standardDeviation(accel) < 0.5) {
    return true;
  } else {
    return false;
  }
}

function isShaken([X, Y, accel]) {
  let avgAccel = average(accel);
  if (avgAccel > 1.5) {
    return true;
  } else {
    return false;
  }
}

// GESTURES

function addNewGesture(evt) {
  let gestureName = prompt("Enter your gesture name: ", "");

  if (gestureName.length > 0) {
    // format with all lower case and hyphens in place of spaces
    gestureName = gestureName.replace(/\s+/g, "-").toLowerCase();

    // create gesture container
    let gestureContainer = document.createElement("div");
    gestureContainer.classList.add(
      "gesture-container",
      "custom-gesture",
      "incomplete"
    );
    let numCustomGestures = document.getElementsByClassName("custom-gesture")
      .length;
    gestureContainer.setAttribute("id", gestureName);

    let title = document.createElement("label");
    title.innerHTML = gestureName + pencilIcon;
    title.addEventListener("click", renameGesture);
    gestureContainer.append(title);

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

    updateTrainingBtns();
  }
}

function renameGesture(evt) {
  let newName = prompt("Enter a new name: ", "");
  if (newName.length > 0) {
    evt.target.closest("label").innerHTML = newName + pencilIcon;
  }
}

function updateTrainingBtns() {
  let trainModelBtn = document.getElementById("train-btn");
  let newGestureBtn = document.getElementById("new-gesture-btn");
  let recordGestureBtns = document.getElementsByClassName("record-btn");

  // the train model btn should be disabled if there are any incomplete gestures
  if (document.getElementsByClassName("incomplete").length > 0) {
    trainModelBtn.disabled = true;
    trainModelBtn.classList.remove("active");
  } else if (document.getElementsByClassName("ready").length > 0) {
    trainModelBtn.disabled = false;
    trainModelBtn.classList.add("active");
    modelNeedsTraining = true;
  }

  if (isTraining) {
    trainModelBtn.disabled = true;
    trainModelBtn.classList.remove("active");
    if (isTraining) {
      newGestureBtn.disabled = true;

      Array.from(recordGestureBtns).forEach(function (btn) {
        btn.disabled = true;
      });
    }
  } else {
    newGestureBtn.disabled = false;
    Array.from(recordGestureBtns).forEach(function (btn) {
      btn.disabled = false;
    });
  }
}

function recordGesture(evt) {
  evt.target.disabled = true;
  let gestureID = evt.target.closest(".gesture-container").id.toLowerCase();
  console.log("gestureID: ", gestureID);
  currentGesture = gestureID;
  collectingData = true;
  recordCountdown.start();
}

function generatePlotly() {
  let container = document.querySelector(
    `#${currentGesture} .sample-container`
  );

  let plot = document.createElement("div");
  let name =
    "gesture_" + currentGesture + "_sample_" + container.children.length;
  plot.setAttribute("id", name);
  container.prepend(plot);

  console.log("generating plot for gesture", currentGesture, " ", name);

  let layout = {
    autosize: false,
    width: 300,
    height: 200,
    margin: {
      l: 20,
      r: 0,
      pad: 0,
      t: 15,
      b: 20,
    },
  };

  Plotly.newPlot(
    name,
    [
      {
        y: accelXSample,
        mode: "lines",
        line: { color: "red" },
        name: "ax",
      },
      {
        y: accelYSample,
        mode: "lines",
        line: { color: "green" },
        name: "ay",
      },
      {
        y: accelZSample,
        mode: "lines",
        line: { color: "blue" },
        name: "az",
      },
    ],
    layout,
    { staticPlot: true }
  );

  // generate peaks data

  let peaksData = peaks(accelXSample);
  peaksArr[0] = peaksData.numPeaks;
  peaksData = peaks(accelYSample);
  peaksArr[1] = peaksData.numPeaks;
  peaksData = peaks(accelZSample);
  peaksArr[2] = peaksData.numPeaks;

  // // peak detection plots
  // // x plot
  // let plotXpeak = document.createElement('div');
  // plotXpeak.setAttribute('id', name + 'x');
  // container.append(plotXpeak);

  // let peaksData = peaks(accelXSample);
  // peaksArr[0] = peaksData.numPeaks;

  // Plotly.newPlot(name+'x', [{
  //   y: peaksData.results,
  //   mode: 'lines',
  //   line: { color: 'red'}
  // },{
  //   y: accelXSample,
  //   mode: 'lines',
  //   line: {color: 'green'}
  // }],
  // layout,
  // { staticPlot: true});

  // // yplot
  // let plotYpeak = document.createElement('div');
  // plotYpeak.setAttribute('id', name + 'y');
  // container.append(plotYpeak);
  // peaksData = peaks(accelYSample);
  // peaksArr[1] = peaksData.numPeaks;

  // Plotly.newPlot(name+'y', [{
  //   y: peaksData.results,
  //   mode: 'lines',
  //   line: {color: 'red'}
  // },{
  //   y: accelYSample,
  //   mode: 'lines',
  //   line: {color: 'green'}
  // }],
  // layout,
  // { staticPlot: true});

  // // zplot
  // let plotZpeak = document.createElement('div');
  // plotZpeak.setAttribute('id', name + 'z');
  // container.append(plotZpeak);

  // peaksData = peaks(accelZSample);
  // peaksArr[2] = peaksData.numPeaks;

  // Plotly.newPlot(name+'z', [{
  //   y: peaksData.results,
  //   mode: 'lines',
  //   line: { color: 'red'}
  // },{
  //   y: accelZSample,
  //   mode: 'lines',
  //   line: {color: 'green'}
  // }],
  // layout,
  // { staticPlot: true});
}

function addData() {
  console.log("add data");
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
      id: new Date().getTime(),
    });
  } else {
    gestureData.push({
      xs: inputs_no_peaks,
      ys: target,
      id: new Date().getTime(),
    });
  }

  // increment sample size
  updateSampleCounter();

  console.log("added data to gesture ", targetGesture);
  console.log(" ");
}

function updateSampleCounter() {
  let counterContainer = document.querySelector(
    `#${currentGesture} .sample-counter`
  );
  let sampleContainer = document.querySelector(
    `#${currentGesture} .sample-container`
  );
  let gestureContainer = document.querySelector(`#${currentGesture}`);

  let sampleCount = sampleContainer.children.length;
  let minSamples = 3;
  let msg;
  if (sampleCount < minSamples) {
    gestureContainer.classList.remove("ready");
    gestureContainer.classList.add("incomplete");
    msg = `record ${minSamples - sampleCount} more ${pluralize(
      "sample",
      minSamples - sampleCount
    )}`;
  } else {
    gestureContainer.classList.remove("incomplete");
    gestureContainer.classList.add("ready");
    msg = `Samples: ${sampleCount}`;
  }
  counterContainer.innerHTML = msg;
  updateTrainingBtns();
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
  updateTrainingBtns();

  model.train(options, whileTraining, finishedTraining);
}

function modelLoaded() {
  console.log("default gestures loaded");
  gestureData = model.data.data.raw;
  trainedGestures = model.data.meta.outputs.gesture.uniqueValues;
  modelNeedsTraining = true;
  runPrediction();
}

function dataLoaded() {
  console.log("loaded data ", model.data);
  loadedData = true;
}

function whileTraining(epoch, loss) {
  console.log("epoch: ", epoch);
}

function finishedTraining() {
  console.log("finished training");
  collectingData = true;
  modelNeedsTraining = false;
  isTraining = false;

  // add new triggers
  updateTriggers();

  // remove any unneeded incomplete divs
  Array.from(document.getElementsByClassName("ready")).forEach(function (el) {
    el.classList.remove("ready");
  });

  // update training btns
  updateTrainingBtns();

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
  }, 100);
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
    let countdownChecked = document.getElementById("timer-countdown-trigger-checkbox")
      .checked;
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
    let timerTrigger = document.getElementById("countdown-trigger-select");
    timerTrigger.options.add(new Option(gesture, gesture));
  });

  trainedGestures = model.data.meta.outputs.gesture.uniqueValues;
}

function saveModel() {
  model.save();
}

// countdownstart - this is for recording gestures
let recordCountdown = (function (document) {
  let myTimer;

  function start() {
    if (!recordCountdownRunning) {
      recordCountdownRunning = true;

      // display countdown
      let display = document.querySelector(
        `#${currentGesture} .countdown-timer`
      );
      display.classList.add("active");

      myTimer = setInterval(myClock, 10);

      accelXSample = [];
      accelYSample = [];
      accelZSample = [];

      // // // check whether to loop audio
      // let countdownStartSelect = document.getElementById('countdown-start-select');
      // let audioFileName = countdownStartSelect.options[countdownStartSelect.selectedIndex].value.toLowerCase();
      // let audioEl = document.getElementById(audioFileName + "-audio");
      // if(document.getElementById('countdown-start-loop-checkbox').checked){
      //   audioEl.loop = true;
      // }else{
      //   audioEl.loop = false;
      // }

      // // play audio
      // playAudio("countdown-start");
    }
    let time = recordCountdownTime;

    function myClock() {
      time--;

      // update countdown timer
      let display = document.querySelector(
        `#${currentGesture} .countdown-timer`
      );
      display.innerHTML = time / 100;

      if (time == 0) {
        end();
        collectingData = false;
      }
    }
  }
  function reset() {
    clearInterval(myTimer);
    stopAllAudio();
    recordCountdownRunning = false;
    let display = document.querySelector(`#${currentGesture} .countdown-timer`);
    display.innerHTML = "2.00"; // iniital countdown time
    display.classList.remove("active");

    let recordBtn = document.querySelector(`#${currentGesture} .record-btn`);
    recordBtn.disabled = false;

    generatePlotly();

    // add data
    addData();
  }

  function end() {
    reset();
    // playAudio("countdown-end");
  }

  return { start: start, end: end, reset: reset };
})(document);

String.prototype.toMMSS = function () {
  var sec_num = parseInt(this, 10); // don't forget the second param
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - hours * 3600) / 60);
  var seconds = sec_num - hours * 3600 - minutes * 60;

  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }
  return minutes + ":" + seconds;
};

function setTimer() {
  let length = prompt("Enter new countdown time (in seconds)", timerTime);
  if (parseInt(length) !== timerTime) {
    timerTime = parseInt(length);
    event.target.innerHTML = length.toMMSS();
  }
}

// countdownstart
let timerCountdown = (function(document){
  let myTimer;

  function start(){
    if(!timerCountdownRunning){
      timerCountdownRunning = true;
      myTimer = setInterval(myClock, 1000);
      
      // check whether to loop audio
      let countdownStartSelect = document.getElementById('timer-countdown-start-select');
      let audioFileName = countdownStartSelect.options[countdownStartSelect.selectedIndex].value.toLowerCase();  
      let audioEl = document.getElementById(audioFileName + "-audio");
      if(document.getElementById('timer-countdown-start-loop-checkbox').checked){
        audioEl.loop = true;
      }else{
        audioEl.loop = false;
      }

      // play audio
      playAudio("timer-countdown-start");
    }
    let time = timerCountdownTime;

    function myClock(){
      console.log('time: ', time);
      time--;

      minutes = parseInt(time / 60, 10);
      seconds = parseInt(time % 60, 10);
  
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;
  
      let display = document.getElementById('timer-countdown');
      display.innerHTML = minutes + ":" + seconds;
      // display.innerHTML = --time;
      if(time == 0){
        end();
      }
    }
  }
  function reset(){
    console.log('end timer');
    clearInterval(myTimer);
    stopAllAudio();
    timerCountdownRunning = false;
    let display = document.getElementById('timer-countdown');
    display.innerHTML = timerCountdownTime.toString().toMMSS();
  }
  
  function end(){
    reset();
    playAudio("timer-countdown-end");
  }

  return {start: start, end: end, reset: reset};
})(document);

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]";
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

window.onload = function () {
  getAudioPermission();

  populateSelects();

  setDefaultSounds();
};
