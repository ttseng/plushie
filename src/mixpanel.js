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

function logAddedGesture(gestureName){
    let user = getUser();
    mixpanel.track('Added Gesture', {'Name': gestureName});
}

function logRemovedGesture(gestureName){
    let user = getUser();
    mixpanel.track('Remove Gesture', {'Name': gestureName}, {'ip': false});
}

function logAddedSound(name, type){
    let user = getUser();
    console.log('logged ', name, ' ', type);
    mixpanel.track('Added Sound', {'Name': name, 'type': type}, {'ip': false});
}

// helper functions
function getNumSamples(gestureName){
    return gestureData.filter((sample) => sample.label == gestureName).length;
}

