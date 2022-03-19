# WordWave 

# To build 

```cmd
npm i
gulp
```

# To deploy in a custom env

- Follow The Dockerfile to know which instructions to run
- Set the correct env vars
- python app.py

# To deploy with docker

# First deployement

- Copy `build/`
- Paste on the targeted environment
- `cd build && docker build . -t wordwave`
- `docker run WordWave`

# Re-deploy 

- Copy `build/`
- Paste on the targeted environment
- `cd build && docker build . -t wordwave --no-cache`
