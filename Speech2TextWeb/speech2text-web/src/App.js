import logo from './logo.svg';
import './App.css';
import {useState} from "react";
import {Button, FormGroup, FormLabel, Paper, TextField} from "@mui/material";
import {postLogin, setCredentials} from "./services/rest";
import AdminPanel from "./AdminPanel";
import NormalPanel from "./NormalPanel";


function App() {
    const [creds, setCreds] = useState({login: "", mdp: ""})
    const [pswHidden, setPswHidden] = useState(true)
    const [logged, setLogged] = useState(false)

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
                   className={'form-group'}
                   style={{width: '33vw', marginRight: '66vw'}}>
                <FormGroup>
                    <FormLabel>
                        Admin credentials
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
                    <Button onClick={handleLogin}>Loggin</Button>
                </FormGroup>
            </Paper>
            {logged && <AdminPanel/>}
            <NormalPanel/>
        </div>
    );
}

export default App;
