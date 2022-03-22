# WordWave 

# Objective

This project is made for the artwork "Sonus Microform" directed by the artist Alessia Sanna. 
Multiple clients will display a data visualisation of the word spoken during a conference. 

Go watch in production : [https://wordwave.hosh.it/data.html](https://wordwave.hosh.it/data.html)

# How 

A unique client will register and manage a server. 
The server will broadcast all word modification to multiple clients which will display those words.

Visualisation : 

Admin interface : 

Recording / Not recording : 

### Option 

DataVisu - ?dark => Invert Black&White
DataVisu - ?min=N => won't display words which occur less than N times


# Build your own

### DEV Requirements : 
- python 3.9
- docker
- node
- gulp
- gzip

### PROD Requirements : 
- docker
- gzip

### Build an image
```cmd
npm i
gulp
```
The compressed file is in the dist folder

### Deploy the image :

- Copy and de-zip the build : `gzip -d wordwave.tar.gz`
- Load in docker : `docker load < wordwave.tar`
- Run in docker : `docker run -p <your_port>:80 wordwave`
- To override the default credentials : `docker run -e LOGIN=<your_login> -e MDP=<your_mdp> -e secret=<your_secret> -p <your_port>:80 wordwave`


# WIP

### COULD TO : 
- Remove underspoken words (<2 occ for exemple)
    
### TODO : 

- Sonus Microform keeps screen on wake up = 1h 
- Test voice register when screen is hidden = 1h

- Prettify Speech2Text = 3h 
   - Option To switch fr / en
   - Option to force retry of voice recognition
   - Display real status of Speech 

- Optimize WordWaveWeb for better perf (P5.js / WebGL / Unity) = 3h