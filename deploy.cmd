ECHO 2.0.10

scp dist\wordwave.2.0.10.tar.gz pazka@hosh.it:~/serious/WordWave
ssh pazka@hosh.it
cd ~/serious/WordWave
gzip -d wordwave.2.0.10.tar.gz
docker stop WordWave && docker rm WordWave || docker rm WordWave 
docker load < wordwave.2.0.10.tar
docker run -d -it -p 9898:80 --name WordWave wordwave
