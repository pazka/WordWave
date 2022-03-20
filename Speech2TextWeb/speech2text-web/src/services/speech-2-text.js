let s2t = null
let state = "stopped"
let timeout = false
const handlers = {}

export function initSpeechRecognition(lang = 'fr-FR') {
    console.log("Initing speechRecognition")
    if (s2t)
        return

    const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition;
    s2t = new SpeechRecognition();
    s2t.lang = lang;
    s2t.continuous = true;

// This runs when the speech recognition service starts
    s2t.onstart = function () {
        console.log("[S2T] : Started");
    };

    s2t.onspeechend = function () {
        console.log("[S2T] : SpeechEnd");
    }

    s2t.onaudioend = function () {
        console.log("[S2T] : Audio End");
    }
    
    s2t.onend = function () {
        console.log("[S2T] : End");
        if(state === "started" && !timeout) {
            s2t.start();
        }
    }

// This runs when the speech recognition service returns result
    s2t.onresult = function (event) {
        let res = event.results[event.results.length - 1]

        var transcript = res[0].transcript;
        var confidence = res[0].confidence;

        console.log(transcript, confidence)
        Object.values(handlers).forEach(h => {
            h(transcript)
        })
    };
}

export function addSpeechStoppedListener(handler) {
    const handlerId = Math.random() * Date.now()
    handlers[handlerId] = handler
    return handlerId
}

export function addSpeechRecognizedListener(handler) {
    const handlerId = Math.random() * Date.now()
    handlers[handlerId] = handler
    return handlerId
}

export function removeSpeechRecognizedListener(handlerId) {
    delete handlers[handlerId]
}

export function startSpeechRecognition() {
    if (!s2t)
        throw new Error("s2t not inited")
    
    if(state==="started")
        return
    
    state = "started"
    s2t.start();
    console.log("[S2T]=",state)
}

export function stopSpeechRecognition() {
    if (!s2t)
        throw new Error("s2t not inited")

    state = "stopped"
    s2t.stop();
    console.log("[S2T]=",state)
}