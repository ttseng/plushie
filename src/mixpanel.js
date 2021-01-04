// analytics on how people construct their machine learning models

let mixpanelUid; // the user id on mixpanel

function getUser(){
    if(!mixpanelUid){
        mixpanelUid = Date.now();
        identifyUser(mixpanelUid);
    }
    return mixpanelUid;
}

function identifyUser(userId){
    mixpanel.identify(userId);
    mixpanel.people.set({
        "USER_ID": mixpanelUid
    })
}

function logTrainedModel(){
    let user = getUser();

    let gestures = getCurrentGestures();
    let gesturesString = gestures.toString();
    let samples = [];
    for(i=0; i<gestures.length; i++){
        // note this is getting all untrained and trained gesture data
        let gestureSamples = getNumSamples(gestures[i]);
        samples.push(gestureSamples);
    }
    let samplesString = samples.toString();

    mixpanel.track('Trained Model', {'Gestures': gesturesString, 'Samples': samplesString});
}

function logAddedGesture(gestureName){
    let user = getUser();
    mixpanel.track('Added Gesture', {'Name': gestureName});
}

function logRemovedGesture(gestureName){
    let user = getUser();
    mixpanel.track('Remove Gesture', {'Name': gestureName}, {'ip': false});
}

// this should be called after a sample has been added
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

// this actually isn't a mixpanel function
function emailLog(){
    let mailToContents = `mailto:scientiffic@gmail.com?subject=My Plushie Project ${getUser()}`;
    let link = document.createElement('a');
    link.href = mailToContents;
    link.target = "_blank";
    link.style.display = 'none';

    // copy body to clipboard
    let dataToCopy = JSON.stringify({ data: gestureData });
    // console.log('dataToCopy: ', dataToCopy);
    let textArea = document.createElement('textarea');
    textArea.value = dataToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy'); // copy the json contents to clipboard
    document.body.removeChild(textArea);
    
    document.body.appendChild(link);
    link.click(); // trigger email 
    document.body.removeChild(link);
}

// helper functions
function getNumSamples(gestureName){
    return gestureData.filter((sample) => sample.label == gestureName).length;
}

