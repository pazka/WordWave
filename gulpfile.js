const { series, parallel, src, dest } = require('gulp');
var exec = require('child_process').exec;
var rename = require("gulp-rename");
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const fs = require("fs")

var del = require('del');
buildVersion = "0.0.1"

async function cleanFront() {
    await del('WordWaveWeb/dist/*')
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
        './COMServer/dictionnaries/*'
    ], { base: './COMServer' })
        .pipe(dest('./build'))

    await src('./COMServer/config.prod.json')
        .pipe(rename('config.json'))
        .pipe(dest('./build'))

}

function buildFront(cb) {
    exec('cd WordWaveWeb && npm i && npm run build', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
}

async function copyFront() {
    await src(['./WordWaveWeb/dist/*'])
        .pipe(dest('./build/public'))
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

async function buildDocker(cb){
    exec(' cd build && docker build . --no-cache -t wordwave', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        console.log(err);

        fileName = "wordwave"+buildVersion

        exec(`mkdir dist && cd dist && docker save wordwave > ${fileName}.tar && gzip -v ${fileName}.tar`, function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err)
        });
    });
}

async function compress() {
    await src('./build')
        .pipe(tar('build.tar'))
        .pipe(gzip())
        .pipe(dest('.'))
}

const build = series(parallel(buildBack, buildFront), copyFront, setVersion,buildDocker);
const clean = parallel(cleanFront, cleanBack, cleanBuild);


exports.default = series(clean, build);