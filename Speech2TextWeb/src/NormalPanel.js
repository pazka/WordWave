import {Button, FormGroup, FormLabel, Link, Paper} from "@mui/material";
import {getCount, getCsvCount, getExcluded, getMeta, getRecorded, getRegistered} from "./services/rest";
import {download} from "./services/file";

export default (props) => {

    const fetchers = [
        ['MetaInfo.json', getMeta],
        ['WordOccurrences.json', getCount],
        ['WordOccurrences.csv', getCsvCount],
        ['Only Counted Words.txt', getRegistered],
        ['All Recorded Words.txt', getRecorded],
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
                    <Button><a href={"https://sensitivewords.alessiasanna.fr"} target={"_blank"}>Lien vers le visuel</a></Button>
                </FormGroup>
            </Paper>
        </div>
    )
}