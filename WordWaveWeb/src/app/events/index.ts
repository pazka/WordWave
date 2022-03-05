interface Events {
    [name: string]: {
        [id: string]: Function
    }
}

let events: Events = {}

export function sub(name: string, id: string, cb: Function) {
    if (!Object.keys(events).includes(name)) {
        events[name] = {}
    }

    events[name][id] = cb
}

export function send(name: string, data: any) {
    if (name !== On.snd_mouse) {
        console.group(`[${name}]${new Date()}`)
        console.log(data)
        console.groupEnd()
    }

    if (Object.keys(events).includes(name)) {
        Object.values(events[name]).forEach(cb =>
            cb(data)
        )
    }
}

const On = Object.freeze({
    snd_join: "snd_join",
    snd_mouse: "snd_mouse",
    snd_save: "snd_save",

    rcv_load: "rcv_load",
    rcv_mouse: "rcv_mouse",
    rcv_leave: "rcv_leave",

    new_text: "new_text",
    reset : "reset"
})
export {On}