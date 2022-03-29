ECHO 1.1.1

scp dist\wordwave.1.1.1.tar.gz pazka@hosh.it:~/serious/WordWave
ssh pazka@hosh.it

cd ~/serious/WordWave
gzip -d wordwave.1.1.1.tar.gz
docker stop WordWave && docker rm WordWave || docker rm WordWave 
docker load < wordwave.1.1.1.tar

docker run -d -it -p 9898:80 --name WordWave -e LOGIN=<your_login> -e MDP=<your_mdp> -e secret=<your_secret> wordwave