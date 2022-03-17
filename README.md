# WordWave 

# To build 

```cmd
npm i
gulp
```

# To deploy

# First deployement

- Copy `build/`
- Paste on the targeted environment
- `cd build && docker build . -t wordwave`
- `docker run WordWave`

# Re-deploy 

- Copy `build/`
- Paste on the targeted environment
- `cd build && docker build . -t wordwave --no-cache`
