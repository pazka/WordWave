import logo from './logo.svg';
import './App.css';
import {useEffect, useState} from "react";
import {Button, FormGroup, FormLabel, Paper, TextField} from "@mui/material";
import {getInfo, postLogin, setCredentials} from "./services/rest";
import AdminPanel from "./AdminPanel";
import NormalPanel from "./NormalPanel";
import {Sep} from "./Icons";


function App() {
    const [creds, setCreds] = useState({login: "", mdp: ""})
    const [pswHidden, setPswHidden] = useState(true)
    const [logged, setLogged] = useState(false)
    const [info, setInfo] = useState(null)

    useEffect(() => {
        getInfo().then(res => setInfo(res)).catch(err => {
            setInfo("Error with Server " + err)
        })
    }, [])

    function handleLogin() {
        postLogin().then(r => setLogged(true)).catch(e => {
            setLogged(false)
        })
    }

    function handleSetCreds(login, mdp) {
        const newCreds = {
            login: login ?? creds.login,
            mdp: mdp ?? creds.mdp
        }
        setCredentials(newCreds.login, newCreds.mdp)
        setCreds(newCreds)
    }

    return (
        <div className="App">
            <Paper elevation={5}
                   className={'form-group'}>
                <p>{info}</p>
            </Paper>
            <Paper elevation={5}
                   className={'form-group'}>
                {logged && <FormGroup>
                    <FormLabel>
                        🔑 Admin credentials
                    </FormLabel>
                    <p> ✅ Logged in !</p>
                </FormGroup>}
                {!logged && <FormGroup>
                    <FormLabel>
                        🔑 Admin credentials
                    </FormLabel>
                    <TextField
                        label={"login"}
                        name={"login"}
                        onChange={e => handleSetCreds(e.target.value, null)}
                        value={creds.login}
                    />
                    <TextField
                        label={"password"}
                        type={pswHidden ? "password" : "text"}
                        onMouseOver={e => setPswHidden(false)}
                        onMouseLeave={e => setPswHidden(true)}
                        name={"mdp"}
                        onChange={e => handleSetCreds(null, e.target.value)}
                        value={creds.mdp}
                    />
                    <Button variant="contained" onClick={handleLogin}>Login</Button>
                </FormGroup>}
            </Paper>
            <NormalPanel/>
            <Sep/>
            {logged && <AdminPanel/>}
        </div>
    );
}

export default App;
