import { createSlice } from '@reduxjs/toolkit';
import {setCredentials} from "../rest";

const initialState = {
    creds: {
        login : "",
        mdp : "",
    },
    textToSend : ""
};

export const counterSlice = createSlice({
    name: 'counter',
    initialState,
    // The `reducers` field lets us define reducers and generate associated actions
    reducers: {
        setCreds: (state,action) => {
            state.creds = action.payload;
        },
        setTextToSend: (state,action) => {
            state.textToSend = action.payload
        },
    },
});

export const {setCreds,setTextToSend} = counterSlice.actions

export default counterSlice.reducer;