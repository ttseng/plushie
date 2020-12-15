let textLang = 'en';
let lang = "en-GB"; // target audio language

let soundEmojiDecorators = {
  none: " ",
  random: "🔀 ",
  silence: "🔇 ",
};

let consoleBtns = {
  "pair-btn": ["Pair Your Microbit", "Microbitをつなげる"],
  "reconnect-btn": ["Reconnect Microbit", "Microbitをつなげる"]
}

// toggle language labels
document.querySelectorAll("[lang]").forEach(function (el) {
  if (el.lang != textLang) {
    el.classList.add("hidden");
  } else {
    el.classList.remove("hidden");
  }
});

// change default gestures if needed
let defaultGestureNames = document.querySelectorAll(
  "#default-gestures .name"
);
defaultGestureNames.forEach(function (defaultGesture) {
  toggleDefaultGestureNames(defaultGesture);
});

// change confidence labels
let confidenceGestures = document.querySelectorAll("#gesture-confidence-container label span");
confidenceGestures.forEach(function (gesture) {
  toggleDefaultGestureNames(gesture);
})

// change selects
let soundSelects = [
  "shake-select",
  "bow-select",
  "none-select",
  "loud-select",
  "timer-countdown-start-select",
  "timer-countdown-end-select",
];
soundSelects.forEach(function (selectorName) {
  let selector = document.getElementById(selectorName);
  if (selector) {
    // replace sounds with japanese as needed
    let selectOptions = Array.from(selector.options);
    selectOptions.forEach(function (option) {
      let soundDecorator = "🔊 "; // default
      // check if it's one of the default sounds

      if (soundEmojiDecorators[option.value] !== undefined) {
        soundDecorator = soundEmojiDecorators[option.value];
      }
      // console.log('option.value: ', option.value, ' with decorator ', soundDecorator);

      option.innerHTML = soundDecorator + option.value;

    });
  }
});

function setAudioLanguage(languageInput) {
  // let browserLang = navigator.language;
  // let language = browserLang;

  if (languageInput) {
    lang = languageInput;
  }
  lang = languageCodes[lang];
  getVoices();
}

// UTILS
function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}
