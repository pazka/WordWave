const { series,src,dest } = require('gulp');
var del = require('del');

function clean(cb) {
    del('./build')
    cb()
}


function build(cb) {
    // body omitted
    cb();
}

exports.build = build;
exports.default = series(clean, build);