// Microbit Bluetooth documentation: https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html

// ACCELEROMETER
const ACCEL_SERVICE = "e95d0753-251d-470a-a062-fa1922dfa9a8".toLowerCase();
const ACCEL_DATA = "E95DCA4B-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const ACCEL_PERIOD = "E95DFB24-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const services = [ACCEL_SERVICE];

let microbitPaired = false;

let sinX;
let sinY;
let lastAccelX = 0;
let lastAccelY = 0;

let currentState; // gesture prediction name
let prevState;

let sensorDataLoaded = false;

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
    document.getElementById("status-container").classList.remove('hidden');
    document.getElementById("pair-btn").style.display = "none";

    console.log("connecting to GATT server...");
    document.getElementById("status").innerHTML =
      "connecting to GATT server...";
    const server = await uBitDevice.gatt.connect();

    console.log("getting service...");
    document.getElementById("status").innerHTML = "getting service...";
    let accelService = await server.getPrimaryService(ACCEL_SERVICE);

    console.log("getting characteristics...");
    document.getElementById("status").innerHTML = "getting characteristics...";
    let accelCharacteristic = await accelService.getCharacteristic(ACCEL_DATA);
    accelCharacteristic.startNotifications();

    accelCharacteristic.addEventListener(
      "characteristicvaluechanged",
      accelChanged
    );

    // show UI
    showUI();
    updateStatusContainer("");

    // hide pair button
    let reconnectBtn = document.getElementById("reconnect-btn");
    reconnectBtn.classList.add('hidden');
    microbitPaired = true;

    if (!sensorDataLoaded) {

      // first load
      // set up smoothie data collection parameters on first load
      setupDataCollection();
      sensorDataLoaded = true;

      // hide instructions
      document.getElementById('instructions').classList.add('hidden'); 
    }else{
      // reconnected microbit
      smoothie.start();
    }
  } catch (error) {
    showModal(error);
  }
}

function showUI() {
  console.log("show ui");
  Array.from(document.getElementsByClassName("hidden-on-load")).forEach(
    function (el, index, array) {
      el.classList.remove('hidden-on-load');
    }
  );
}

function onMicrobitDisconnected() {
  console.log("microbit disconnected");

  // pause smoothie
  smoothie.stop();
  // pause prediction
  microbitPaired = false;

  // stop all sounds
  stopAllAudio();

  // make pair button active
  let reconnectBtn = document.getElementById("reconnect-btn");
  reconnectBtn.classList.remove('hidden');
  reconnectBtn.classList.add("active");
}

function accelChanged(event) {
  // only run this when we're recording
  // Retrieve acceleration values,
  // then convert from milli-g (i.e. 1/1000 of a g) to g
  // console.log(event.target.value);
  const accelX = event.target.value.getInt16(0, true) / 1000.0;
  const accelY = event.target.value.getInt16(2, true) / 1000.0;
  const accelZ = event.target.value.getInt16(4, true) / 1000.0;

  const smoothedAccelX = accelX * 0.2 + lastAccelX * 0.8;
  const smoothedAccelY = accelY * 0.2 + lastAccelY * 0.8;

  sinX = constrain(smoothedAccelX, -1, 1);
  sinY = constrain(smoothedAccelY, -1, 1);

  lastAccelX = smoothedAccelX;
  lastAccelY = smoothedAccelY;

  accelXArr.push(accelX);
  accelYArr.push(accelY);
  accelZArr.push(accelZ);

  accelXSample.push(accelX);
  accelYSample.push(accelY);
  accelZSample.push(accelZ);

  accelXSeries.append(new Date().getTime(), accelX);
  accelYSeries.append(new Date().getTime(), accelY);
  accelZSeries.append(new Date().getTime(), accelZ);
};

function showModal(message) {
  document.getElementsByName("modal-message")[0].innerHTML = message;
  $("#myModal").modal("show");
  document.getElementById("pair-btn").style.display = "block";
}