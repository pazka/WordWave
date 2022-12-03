import {TextElem} from "./TextElem";




export function getXYSize(text : TextElem,t : number){
    
}


export function getXYRot(text : TextElem,t : number){
    let sin = Math.sin(text.id * t)
    let cos = Math.cos(text.id * t)
    let l = text.text.length / 8


    let angleRadian = (sin > 0) ? Math.acos(cos) : -Math.acos(cos);
    
    let rot = angleRadian * 180 / Math.PI;
    let y = 500 + text.rndX * sin * l * 500
    let x = 800 + text.rndX * cos * l * 500
    
    return [x,y,rot]

}