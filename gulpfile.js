const { series, parallel, src, dest } = require('gulp');
var exec = require('child_process').exec;
var rename = require("gulp-rename");
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');
const fs = require("fs")

var del = require('del');

async function cleanFront() {
    await del('WordWaveWeb/dist/*')
}

async function cleanBack() {
}

async function cleanBuild() {
    await del('./build')
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

    await src([
        './version',
        './Dockerfile'
    ])
        .pipe(dest(['./build']))
}

async function compress() {
    await src('./build')
        .pipe(tar('build.tar'))
        .pipe(gzip())
        .pipe(dest('.'))
}

const build = series(parallel(buildBack, buildFront), copyFront, setVersion);
const clean = parallel(cleanFront, cleanBack, cleanBuild);


exports.default = series(clean, build);