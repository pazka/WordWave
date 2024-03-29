﻿import {useState} from "react";
import {Button, FormGroup, FormLabel, Paper, TextareaAutosize} from "@mui/material";
import {allClientsReload, postExcludeWords, postWords, resetAllClients} from "./services/rest";
import {Sep} from "./Icons";
import {SpeechSection} from "./SpeechSection";


export default (props) => {
    const [inputText, setInputText] = useState("")
    const [excludeText, setExcludeText] = useState("")
    const [recText, setRecordedText] = useState("")
    const [regtext, setRegisteredText] = useState("")

    function handleSpeechRecognized(transcript){
        setRecordedText(transcript)
        handlePostText(transcript)
    }
    
    function handlePostText(text) {
        postWords(text).then(
            registeredText => {
                setInputText("")
                setRegisteredText(registeredText)
            }
        ).catch(err => {
            console.error(err)
        })
    }

    function handleExcludeText(text) {
        postExcludeWords(text).then(
            registeredExcludeText => {}
        )
    }

    function handleResetClients() {
        if (window.confirm("Are you sure you want to reset the visual ? \n This will reset the manually excluded words, the server registered words and the visual of everybody connected on the website"))
            resetAllClients().then(x => x).catch(x => x)
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
            
            <SpeechSection onChange={handleSpeechRecognized}/>
            <Sep/>
            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        ✋🎤 Manual Text Input
                    </FormLabel>
                    <TextareaAutosize
                        label={"Text to send"}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
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
            
            <Paper elevation={2} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        ✋🚫 Additional Exclude Word
                    </FormLabel>
                    <TextareaAutosize
                        label={"Word to not count"}
                        value={excludeText}
                        onChange={e => setExcludeText(e.target.value)}
                    />
                    <Button
                        color={"primary"}
                        variant={"contained"}
                        onClick={e => handleExcludeText(excludeText)}
                    >
                        {"Submit additional Exclude Words"}
                    </Button>
                </FormGroup>
            </Paper>
            
            <Paper elevation={5} style={{
                width:"95vw"
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