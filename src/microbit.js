// Microbit Bluetooth documentation: https://lancaster-university.github.io/microbit-docs/resources/bluetooth/bluetooth_profile.html

// ACCELEROMETER
const ACCEL_SERVICE = "e95d0753-251d-470a-a062-fa1922dfa9a8".toLowerCase();
const ACCEL_DATA = "E95DCA4B-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const ACCEL_PERIOD = "E95DFB24-251D-470A-A062-FA1922DFA9A8".toLowerCase();
const services = [ACCEL_SERVICE];

let microbitPaired = false;

let sinX;
let sinY;

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

    let reconnectBtn = document.getElementById("reconnect-btn");
    reconnectBtn.classList.remove("active");

    if (!sensorDataLoaded) {
      // set up smoothie data collection parameters on first load
      setupDataCollection();
      sensorDataLoaded = true;
      microbitPaired = true;

      // hide instructions
      document.getElementById('instructions').classList.add('hidden');
    }
  } catch (error) {
    showModal(error);
  }
}

function showUI() {
  console.log("show ui");
  Array.from(document.getElementsByClassName("hidden-on-load")).forEach(
    function (el, index, array) {
      el.style.visibility = "initial";
      el.style.display = "inline-block";
    }
  );
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

function accelChanged(event) {
  // only run this when we're recording
  // Retrieve acceleration values,
  // then convert from milli-g (i.e. 1/1000 of a g) to g
  // console.log(event.target.value);
  const accelX = event.target.value.getInt16(0, true) / 1000.0;
  const accelY = event.target.value.getInt16(2, true) / 1000.0;
  const accelZ = event.target.value.getInt16(4, true) / 1000.0;

  // https://create.arduino.cc/projecthub/RVLAD/free-fall-detection-using-3-axis-accelerometer-06383e
  // accelT = Math.sqrt(
  //   Math.pow(accelX, 2) + Math.pow(accelY, 2) + Math.pow(accelZ, 2)
  // );
  // accelT = Number(accelT.toFixed(2));

  sinX = constrain(accelX, -1, 1);
  sinY = constrain(accelY, -1, 1);

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