gzip -d wordwave.tar.gz
docker stop WordWave && docker rm WordWave || docker rm WordWave
docker load < wordwave.tar
docker run -d -it -p 9898:80 --name WordWave -e LOGIN=<your_login> -e MDP=<your_mdp> -e secret=<your_secret> wordwave