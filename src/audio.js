// everything related ot audio features including audio recording and text-to-speech

// speech synthesis params
let voices;
let lang = "en-GB"; // target language
let synth = window.speechSynthesis; // speech synthesizer
let targetVoice;
getVoices();

// microphone params
let volume = 0;
let loudThreshold = document.getElementById('noise-input-threshold').value; 

// recording params
const recordButton = document.getElementById("record-btn");
const recordIcon = document.getElementById("record-icon");
let isRecording = false;
let rec; // mediarecorder item
let isPlaying = false;


// SETUP

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

function addAudioEvtListeners() {
  document.querySelectorAll("audio").forEach(function (el) {
    el.addEventListener("ended", stopPlayback);
    el.addEventListener("play", startPlayback);
  });
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


// RECORDING

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

// PLAYBACK

function playAudio(name) {
  console.log("play audio for ", name);
  // stop all audio if countdown isn't running
  if (!timerCountdownRunning && currentState != "none") {
    stopAllAudio();
  }

  if(!isCollectingData){
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
}

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

// MICROPHONE

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

// TEXT TO SPEECH

function showTextSpeechModal() {
  $("#textToSpeechModal").modal("show");
}

function getVoices() {
  voices = synth.getVoices();
  targetVoice = voices.filter((voice) => voice.lang == lang)[0];
  if (!targetVoice) {
    // correct for mobile
    lang = lang.replace(/-/g, "_");
    targetVoice = voices.filter((voice) => voice.lang == lang)[0];
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

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = getVoices;
}

// UPLOAD AUDIO

const inputFile = document.getElementById('file-upload');
inputFile.addEventListener('change', function(){
  addSound(this.files[0]);
});



// UTILS
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

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]";
}
