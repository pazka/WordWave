import {useEffect, useState} from "react";
import {Button, FormGroup, FormLabel, Paper, TextareaAutosize} from "@mui/material";
import {allClientsReload, getInfo, postWords, resetAllClients} from "./services/rest";
import {
    addSpeechRecognizedListener,
    initSpeechRecognition,
    startSpeechRecognition,
    stopSpeechRecognition
} from "./services/speech-2-text";

export default (props)=> {
    const [speech, setSpeech] = useState(false)
    const [inputText,setInputText] = useState("")
    const [recText, setRecordedText] = useState("")
    const [regtext, setRegisteredText] = useState("")

    function handlePostText(text){
        setInputText("")
        postWords(text).then(
            registeredText=> setRegisteredText(registeredText)
        )
    }
    
    function handleResetClients(){
        if(window.confirm("Are you sure you want to reset the visual ? \n This will reset the manually excluded words, the server registered words and the visual of everybody connected on the website"))
            resetAllClients().then(x=>x).catch(x=>x)
    }
    
    useEffect(() => {
        initSpeechRecognition()
        
        addSpeechRecognizedListener((transcript)=>{
            setRecordedText(transcript)
            handlePostText(transcript)
        })
    }, [])
    
    function handleToggleSpeech() {
        setSpeech(!speech)
        if(speech){
            startSpeechRecognition()
            stopSpeechRecognition()
        }
    }
    
    return (<div className="App" style={{display: 'flex'}}>
            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        🎮 Client visuals
                    </FormLabel>
                    <Button
                        color={"secondary"}
                        variant={"contained"}
                        onClick={handleResetClients}
                    >
                        Reset visual
                    </Button>
                    <Button
                        color={"secondary"}
                        variant={"outlined"}
                        onClick={allClientsReload}
                    >
                        Reload visualizer in all clients
                    </Button>
                </FormGroup>
            </Paper>

            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        👂🎤 Speech Recognition Control
                    </FormLabel>
                    <Button
                        color={"primary"}
                        variant={speech ? "outlined" : "contained"}
                        onClick={e => handleToggleSpeech()}
                    >
                        {speech ? "Stop Recording" : "Start Recording"}
                    </Button>
                </FormGroup>
            </Paper>
            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        ✋🎤 Manual Text Input
                    </FormLabel>
                    <TextareaAutosize
                        label={"Text to send"}
                        value={inputText}
                        onChange={e=>setInputText(e.target.value)}
                    />
                    <Button
                        color={"primary"}
                        variant={"contained"}
                        onClick={e => handlePostText(inputText)}
                    >
                        {"Submit Manuel Text"}
                    </Button>
                </FormGroup>
            </Paper>
            <Paper elevation={5} style={{
                width : "95vw"
            }} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        🎧 Speech Result
                    </FormLabel>
                    <p>
                        {recText}
                    </p>
                    <hr/>
                    <FormLabel>
                        🧪 Server Result
                    </FormLabel>
                    <p>
                        {regtext}
                    </p>
                </FormGroup>
            </Paper>
        </div>
    )
}