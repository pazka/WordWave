# WordWave 

# Objective

This project is made for the artwork "Sonus Microform" directed by the artist Alessia Sanna. 
Multiple clients will display a data visualisation of the word spoken during a conference. 

# How 

A unique client will register and manage a server. 
The server will broadcast all word modification to multiple clients which will display those words.

### Option 

DataVisu - ?dark => Invert Black&White
DataVisu - ?min=N => won't display words that occur less than N times

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
The file is in the dist folder

### Deploy the image :

- Copy and de-zip the build : `gzip -d wordwave.tar.gz`
- Load in docker : `docker load < wordwave.tar`
- Run in docker : `docker run -p <your_port>:80 wordwave`


# WIP

### COULD TO : 
- Remove underspoken words (<2 occ for exemple)
    
### TODO : 
- Speech2Text keeps screen on wake up
- Integrate Speech2Text in admin page
- Prettify Speech2Text
- Optimize WordWaveWeb for better perf (P5.js)