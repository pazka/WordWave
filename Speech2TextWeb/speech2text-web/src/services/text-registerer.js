let textRecorded = ""
let textDisplayed = ""

export function reset() {
    textRecorded = ""
}

function addRecordedText(text) {
    textRecorded += text
}

function addTextDisplayed(text) {
    textDisplayed += text
}