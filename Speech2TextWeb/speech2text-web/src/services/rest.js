import {isDev} from "./env";

let baseUrl = window.location.protocol + '//' + window.location.host
if (isDev())
    baseUrl = "http://localhost:9123"

const credentials = {login: "", mdp: ""}

export function setCredentials(login, mdp) {
    credentials.login = login
    credentials.mdp = mdp
}

function prepareRequest(url, method, contentType, resolve, reject) {
    let http = new XMLHttpRequest();
    http.open(method, url, true);
    http.setRequestHeader('Authorization', 'Basic ' + btoa(credentials.login + ":" + credentials.mdp))

    if (contentType)
        http.setRequestHeader('Content-type', contentType);

    http.onreadystatechange = function () {
        if (http.readyState === 4 && http.status === 200) {
            return resolve(http.response)
        }

        if (http.readyState === 4 && http.status !== 200) {
            return reject(http.response)
        }
    }
    return http
}

export function postLogin() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/login', 'POST', 'text/json', resolve, reject)
        http.send(credentials);
    })
}

export function postWords(url, text) {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words', 'POST', 'text/plain', resolve, reject)
        http.send(text);
    })
}

export function postExcludeWords(text) {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/exclude', 'POST', 'text/plain', resolve, reject)
        http.send(text);
    })
}

export function resetAllClients() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words', 'DELETE', null, resolve, reject)
        http.send();
    })
}

export function allClientsReload() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/reload', 'DELETE', null, resolve, reject)
        http.send();
    })
}

export function getInfo() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/info', 'GET', null, resolve, reject)
        http.send();
    })
}

export function getMeta() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/current/meta', 'GET', null, resolve, reject)
        http.send();
    })
}

export function getCount() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/current/count', 'GET', null, resolve, reject)
        http.send();
    })
}

export function getRecorded() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/current/recorded', 'GET', null, resolve, reject)
        http.send();
    })
}

export function getRegistered() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/current/registered', 'GET', null, resolve, reject)
        http.send();
    })
}

export function getExcluded() {
    return new Promise((resolve, reject) => {
        let http = prepareRequest(baseUrl + '/words/current/stop', 'GET', null, resolve, reject)
        http.send();
    })
}