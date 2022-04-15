#!/bin/sh

# Only for server usage

rm wordwave.tar
gzip -d wordwave.tar.gz
docker stop WordWave && docker rm WordWave || docker rm WordWave
docker load < wordwave.tar
docker run -d -it -p 9898:80 --name WordWave -e LOGIN=***** -e MDP==***** -e secret==***** wordwave
