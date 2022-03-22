import {styled} from "@mui/material";
import {Mic} from "@mui/icons-material";
import {flash} from "react-animations";
import MicNone from "@mui/icons-material/MicNone";


export const Listening = () => <Mic style={{
    borderRadius: '100%'
}}/>

export const NotListening = () => <MicNone style={{
    borderRadius: '100%'
}}/>

export const Sep = () => <span style={{width: "100vw", height: "0px"}}></span>