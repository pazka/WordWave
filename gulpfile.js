const { series, parallel, src, dest } = require('gulp');
var exec = require('gulp-exec');
const through2 = require('through2');
const fs = require("fs")

var del = require('del');

function cleanFront() {
    return del('./WordWaveWeb/build')
}

function cleanBack(cb) {
    return cb()
}

function cleanBuild(){
    return del('./build')
}

function buildBack(cb) {
    src([
        './COMServer/*.py',
        './COMServer/DTO/',
        './COMServer/requirements.txt',
        './COMServer/dictionnaries/'
    ])
        .pipe(dest('./build'))

    src('./COMServer/config.prod.json')
    .pipe(dest('./build/config.json'))

    return cb()
}

function buildFront(cb) {
    return cb()
}

async function  setVersion() {
    let version = await fs.readFileSync('./version')
    version = String(version).split('.')
    version[version.length - 1]++
    version = version.join('.')
    await fs.writeFileSync('./version',version)

    return src('./version')
        .pipe(dest(['./build']))
}

const build = series(parallel(buildBack, buildFront), setVersion);
const clean = parallel(cleanFront, cleanBack,cleanBuild );


exports.default = series(clean, build);