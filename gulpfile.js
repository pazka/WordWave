const { series, parallel, src, dest } = require('gulp');
var exec = require('child_process').exec;
var rename = require("gulp-rename");
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const fs = require("fs")

var del = require('del');
buildVersion = "0.0.1"

function cleanFront() {
    return del('WordWaveWeb/dist/*')
}

function cleanAdmin() {
    return del('Speech2TextWeb/speech2text-web/build/*')
}

async function cleanBack() {
}

async function cleanBuild() {
    await del('./build')
    await del('./dist')
}

async function buildBack() {
    await src([
        './COMServer/*.py',
        './COMServer/requirements.txt',
        './COMServer/DTO/*.py',
        './COMServer/dictionnaries/*',
        './COMServer/static/*'
    ], { base: './COMServer' })
        .pipe(dest('./build'))

    return src('./COMServer/config.prod.json')
        .pipe(rename('config.json'))
        .pipe(dest('./build'))

}

function buildFront(cb) {
    return new Promise((resolve, reject) => {
        exec('cd WordWaveWeb && npm i && npm run build', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            resolve()
        });
    })
}

function buildAdmin(cb) {
    return new Promise((resolve, reject) => {
        exec('cd Speech2TextWeb/speech2text-web && npm i && npm run build', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            resolve()
        });
    })
}

async function copyFront() {

    await src('./WordWaveWeb/dist/index.html')
        .pipe(rename('data.html'))
        .pipe(dest('./WordWaveWeb/dist/'))

    await del('./Speech2TextWeb/speech2text-web/build/index.html')

    return src(['./WordWaveWeb/dist/**/*'])
        .pipe(dest('./build/static'))
}

async function copyAdmin() {

    await src('./Speech2TextWeb/speech2text-web/build/index.html')
        .pipe(rename('admin.html'))
        .pipe(dest('./Speech2TextWeb/speech2text-web/build/'))

    await del('./Speech2TextWeb/speech2text-web/build/index.html')

    return src(['./Speech2TextWeb/speech2text-web/build/**/*'])
        .pipe(dest('./build/static'))
}

async function setVersion() {
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
}

function buildDocker(cb) {
    return new Promise((resolve, reject) => {
        exec(' cd build && docker build . --no-cache -t wordwave', function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err)
        });
        resolve()
    })
}

function compress() {
    return new Promise((resolve, reject) => {
        fileName = "wordwave." + buildVersion

        exec(`mkdir dist && cd dist && docker save wordwave > ${fileName}.tar && gzip -v ${fileName}.tar`, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            resolve()
        });
    })
}

const buildApp = series(parallel(buildBack, buildFront, buildAdmin), copyFront, copyAdmin, setVersion);
const build = series(buildApp, buildDocker, compress);
const clean = parallel(cleanAdmin, cleanFront, cleanBack, cleanBuild);

exports.buildApp = series(clean,buildApp)
exports.default = series(clean, build);