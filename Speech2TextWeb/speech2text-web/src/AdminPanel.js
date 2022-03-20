import {useState} from "react";
import {Button, FormGroup, FormLabel, Paper} from "@mui/material";

export default (props)=> {
    const [speech, setSpeech] = useState(false)
    const [recText, setRecordedText] = useState("")
    const [regtext, setRegisteredText] = useState("")
    
    function handleToggleSpeech() {
        setSpeech(!speech)
    }
    
    return (<div className="App" style={{display: 'flex'}}>
            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        Control client visuals
                    </FormLabel>
                    <Button
                        color={"secondary"}
                        variant={"contained"}
                    >
                        Reset visual
                    </Button>
                    <Button
                        color={"secondary"}
                        variant={"outlined"}
                    >
                        Reload visualizer in all clients
                    </Button>
                </FormGroup>
            </Paper>

            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        Speech Recognition Control
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
        </div>
    )
}