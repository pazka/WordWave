import {setCredentials} from "../rest";
import {setCreds} from "./adminSlice";

export async function setCredsEffect(login,mdp){
    return (dispatch,getState)=>{
        setCredentials(login,mdp)
        dispatch(setCreds())
    }
}