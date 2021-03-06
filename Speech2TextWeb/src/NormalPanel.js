import {Button, FormGroup, FormLabel, Paper} from "@mui/material";
import {getCount, getExcluded, getMeta, getRecorded, getRegistered} from "./services/rest";
import {download} from "./services/file";

export default (props) => {

    const fetchers = [
        ['MetaInfo.txt', getMeta],
        ['WordCount.txt', getCount],
        ['Counted Words.txt', getRegistered],
        ['Recorded Words.txt', getRecorded],
        ['Excluded Words.txt', getExcluded]
    ]

    const handleFetch = fetcher => event => {
        fetcher[1]().then(res => {
            download(fetcher[0], res)
        }).catch(err => {
            console.error(err)
            alert(err)
        })
    }

    return (<div className="App" style={{display: 'flex'}}>
            <Paper elevation={5} className={'form-group'}>
                <FormGroup>
                    <FormLabel>
                        🧾 Words Download
                    </FormLabel>
                    {fetchers.map((fetcher,i) => <Button
                        color={"primary"}
                        variant={"contained"}
                        key={i}
                        onClick={handleFetch(fetcher)}
                    >
                        {fetcher[0]}
                    </Button>)}
                </FormGroup>
            </Paper>
        </div>
    )
}