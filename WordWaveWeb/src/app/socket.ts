import {io, Socket} from "socket.io-client";
import {getBaseUrl} from "./rest";
import * as events from "./events";
import {On} from "./events";

let socket : Socket;
let currentRoom


export default function SocketIOService(){
    socket = io(getBaseUrl());

    console.log("I'm a new instance !")

    socket.on("connect", () => {
        console.log("connect : " + socket.connected);
    });

    socket.on("disconnect", (reason) => {
        console.log("disconnect : " + reason);
    });

    socket.on("join",(data)=>{
        console.log('Somebody joined')
    })
    
    socket.on("leave",(data)=>events.send(On.rcv_leave,data))

    socket.on("mouse",(data)=>events.send(On.rcv_mouse,data))
    
    socket.on("error",(data)=> {
        alert("An error occured on the server-side, you changes have not been persisted. Please try again later")
        console.error(data)
    })

    socket.on("new_text", (data) => {
        events.send(On.new_text,data)
    });

    socket.on("reset", (data) => {
        events.send(On.reset,{})
    });

    socket.on("reload", (data) => {
        events.send(On.reload,{})
    });
}