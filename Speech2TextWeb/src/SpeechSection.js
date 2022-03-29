import {Button, FormGroup, FormLabel, MenuItem, Paper, Select, Switch, ToggleButton} from "@mui/material";
import {Listening, NotListening} from "./Icons";
import {useEffect, useState} from "react";
import {
    initSpeechRecognition, setForceRetry,
    setListener,
    startSpeechRecognition,
    stopSpeechRecognition
} from "./services/speech-2-text";
import {tryKeepAwake} from "./services/wake-screen";
import SelectInput from "@mui/material/Select/SelectInput";
import {availableLangs, getCurrentLangOrDefault} from "./services/lang";

interface Props {
    onChange: Function
}

export const SpeechSection = (props) => {
    const [canKeepAwake, setCanKeepAwake] = useState(false)
    const [lang, setLang] = useState(getCurrentLangOrDefault())
    const [speechState, setSpeechState] = useState({
        listening: false, hearing: false, active: false, error: null
    })
    const [alwaysOn, setAlwaysOn] = useState(true)

    useEffect(() => {
        initSpeechRecognition(lang)
        tryKeepAwake().then(res => setCanKeepAwake(true)).catch(err => setCanKeepAwake(false))
    }, [])
    
    setListener('result', (transcript) => {
        if (props.onChange) {
            props.onChange(transcript)
        }
    })
    setListener('start', () => setSpeechState({
        ...speechState,
        active: true
    }))
    setListener('soundstart', () => setSpeechState({
        ...speechState,
        active: true,
        hearing: true,
        error: null
    }))
    setListener('speechstart', () => setSpeechState({
        ...speechState,
        active: true,
        hearing: true,
        listening: true,
        error: null
    }))
    setListener('speechend', () => setSpeechState({
        ...speechState,
        listening: false
    }))
    setListener('soundend', () => setSpeechState({
        ...speechState,
        hearing: false,
        listening: false
    }))
    setListener('end', () => setSpeechState({
        ...speechState,
        active: false,
        hearing: false,
        listening: false
    }))
    setListener('error', (err) => {
        if (err.error !== "no-speech") {
            handleSetForceRetry(false)
        }

        setSpeechState({
            ...speechState,
            error: err.error + " " + err.message
        })
    })

    function handleSetSpeech(state) {
        if (state) {
            startSpeechRecognition()
        } else {
            stopSpeechRecognition()
        }

        setSpeechState({
            ...speechState,
            active: state
        })
    }

    function handleSetForceRetry(value) {
        setAlwaysOn(value)
        setForceRetry(value)
    }

    const handleLangChange = (lang) => {
        handleSetSpeech(false)
        setSpeechState({
            ...speechState,
            active: false,
            hearing: false,
            listening: false
        })
        initSpeechRecognition(lang)
        
        handleSetSpeech(true)
        setLang(lang)
    }


    return (
        <Paper elevation={5} className={'form-group'} style={{
            backgroundColor: (speechState.active ? "red" : "inherit"),
            animation: (speechState.hearing ? `0.5s ease alternate-reverse pulse infinite` : "")
        }}>
            <FormGroup>
                <FormLabel>
                    👂🎤 Speech Recognition Control
                </FormLabel>
                <Button
                    color={"primary"}
                    variant={speechState.listening ? "outlined" : "contained"}
                    onClick={e => handleSetSpeech(!speechState.active)}
                >
                    {speechState.listening ? <Listening/> : <NotListening/>}
                    {speechState.active ? "Stop Listening" : "Start Listening"}
                </Button>
                <span>
                    Always Recording 
                    <Switch checked={alwaysOn}
                            onChange={e => handleSetForceRetry(e.target.checked)}
                            inputProps={{'aria-label': 'controlled'}}/> 
                </span>
                <Select
                    label={"Language"}
                    value={lang}
                    variant="standard"
                    onChange={e => handleLangChange(e.target.value)}>
                    {Object.keys(availableLangs).map(ln => (
                        <MenuItem value={ln}>{availableLangs[ln]}</MenuItem>
                    ))}
                </Select>
                {speechState.error && <b>{"ERROR : " + speechState.error.replace('-', ' ')}</b>}
                {!canKeepAwake && <p> Error when trying to prevent the screen to go to sleep</p>}

            </FormGroup>
        </Paper>
    )
}