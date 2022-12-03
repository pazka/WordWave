const { series, parallel, src, dest } = require('gulp');
var exec = require('child_process').exec;
var rename = require("gulp-rename");
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const fs = require("fs")

var del = require('del');
buildVersion = ""

const cleanFront = async () => {
    await del('WordWaveWeb/dist/*')
}

const cleanAdmin = async () => {
    await del('Speech2TextWeb/build/*')
}

const cleanBack = async () => {
}

const cleanBuild = async () => {
    await del('./build')
    await del('./dist')
}

const buildBack = async () => {
    await src([
        './COMServer/*.py',
        './COMServer/requirements.txt',
        './COMServer/DTO/*.py',
        './COMServer/dictionnaries/*',
        './COMServer/static/*'
    ], { base: './COMServer' })
        .pipe(dest('./build'))

    await src('./COMServer/config.prod.json')
        .pipe(rename('config.json'))
        .pipe(dest('./build'))
}

const buildFront = () => {
    return new Promise(cb => {
        exec('cd WordWaveWeb && npm i && npm run build', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}

const buildAdmin = () => {
    return new Promise(cb => {
        exec('cd Speech2TextWeb && npm i && npm run build', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}

const renameFrontIndex = () => {
    return src('./WordWaveWeb/dist/index.html')
        .pipe(rename('data.html'))
        .pipe(dest('./WordWaveWeb/dist'))

}
const copyFront = () => {
    return src('./WordWaveWeb/dist/**/*')
        .pipe(dest('./build/static'))
}

const renameAdminIndex = () => {
    return src('./Speech2TextWeb/build/index.html')
        .pipe(rename('admin.html'))
        .pipe(dest('./Speech2TextWeb/build'))
}

const copyAdmin = () => {
    return src('./Speech2TextWeb/build/**/*')
        .pipe(dest('./build/static'))
}

const setVersion = async(cb)=> {
    let version = await fs.readFileSync('./version')
    version = String(version).split('.')
    version[version.length - 1]++
    version = version.join('.')
    await fs.writeFileSync('./version', version)

    buildVersion = version
    await src([
        './version',
        './Dockerfile'
    ])
        .pipe(dest(['./build']))
        
    return new Promise(cb => {
        exec('git tag '+version, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}

const buildDocker = () => {
    return new Promise(cb => {
        exec(' cd build && docker build . --no-cache -t pazka/wordwave', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}

/**
 * Old way of publishing the resulting backend docker image
 * Now I will use "publish"
 */

const compress = () => {
    return new Promise(cb => {
        fileName = "wordwave"

        exec(`mkdir dist && cd dist && docker save pazka/wordwave > ${fileName}.tar && gzip -v ${fileName}.tar`, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}

const publish = () => {
    return new Promise(cb => {
        fileName = "wordwave"

        exec(`docker push pazka/wordwave:latest`, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr)
            console.log(err);
            cb()
        });
    })
}


const buildFrontTask = series(buildFront,renameFrontIndex,copyFront)
const buildAdminTask = series(buildAdmin,renameAdminIndex,copyAdmin)

const buildApp = series(buildBack, parallel(buildFrontTask, buildAdminTask), setVersion);
const buildImage = series(buildDocker, publish)

const build = series(buildApp, buildImage);
const clean = parallel(cleanAdmin, cleanFront, cleanBack, cleanBuild);

exports.clean = clean
exports.buildImage = buildImage
exports.buildApp = series(clean, buildApp)
exports.default = series(clean, build);