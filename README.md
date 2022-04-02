# WordWave 

# Objective

This project is made for the artwork "Sonus Microform" directed by the artist Alessia Sanna. 
Multiple clients will display a data visualisation of the word spoken during a conference. 

Go watch in production : [https://wordwave.hosh.it/data.html](https://wordwave.hosh.it/data.html)

# Result 

## Behaviour

A unique client will register and manage a server. 
The server will broadcast all word modification to multiple clients which will display those words.

## Visualisation : 

?dark => Invert Black&White

?min=N => won't display words which occur less than N times

![conférence](https://user-images.githubusercontent.com/8599093/159574811-6d00d700-837d-4f3f-ac5b-323d47cfb4d3.png)

## Admin interface : 

![image](https://user-images.githubusercontent.com/8599093/159574958-b7830c69-7c62-4d40-b575-9130d2910958.png)

 Recording / Not recording : 

![image](https://user-images.githubusercontent.com/8599093/159574985-8d5b1e44-8478-4ca1-b82b-3537f5e28e37.png)
![image](https://user-images.githubusercontent.com/8599093/159575004-59f309fb-8dc5-4ca5-a2ce-a5fea8479c65.png)

## Open Data : 
On the interface or at urls : 
```
words/current/recorded -> Logs of recorded words
words/current/registered -> Logs or counted words
words/current/count -> total count
words/current/meta -> meta informations
words/current/stop -> excluded word
words/current -> meta + count
```

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
    
### TODO : 

- Gradual culling of weak words (7/8 culled for 7000 registered and 2500 counted) 
- Gradual center + darken + Smallest when comming to certain number of words
- Clean up Render function to incroporate those function in a clean anner
- Plural test (remove -s)

- Sonus Microform keeps screen on wake up = 1h 
- Test voice register when screen is hidden = 1h

- Optimize WordWaveWeb for better perf (P5.js / WebGL / Unity) = 3h
