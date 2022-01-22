# Three.js TypeScript starter template
A basic, ready to rumble, Three.js - TypeScript and Webpack enabled boilerplate template to kick-off your new 3D project.

## Features

- **TypeScript** supported
- **Webpack** integrated
  - **Development server** with **live reload**
  - **Source mapping**
  - **Optimized** production build
- Basic Three.js sphere / cube example
 
## Installation

Clone the template repository
```
git clone https://github.com/DaanDeSmedt/threejs-typescript-webpack-boilerplate.git
```

Install the required dependencies
```
npm install
```


## Running development server

```
npm run start
```

Webpack has been pre-configured to provide a auto opening development server with live reload support. After running above command, your browser will automatically open http://localhost:9999/ and serve the boilerplate Three.js scene.  

Making code changes will auto reload the served webpage and reflect changes made.


![Three.js boilerplate scene](docs/scene_boilerplate.jpg)


# Building for production

```
npm run build
```

Webpack has been pre-configured to build the project to `./dist` with support for source mapping.