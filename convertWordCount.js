// read file WordCount.json

var fs = require('fs');
var data = fs.readFileSync('WordCount.json');
var words = JSON.parse(data);

// sort keys by value
var items = Object.keys(words).map(function(key) {  
    return [key, words[key]];
}
);

items.sort(function(first, second) {
    return second[1] - first[1];
}
);

//print result in a file name result.txt, the result is printed with one key-value by line, and making the index appearent at each line
var result = '';
for (var i = 0; i < items.length; i++) {
    result += "N°" +i + ' = ' + items[i][0] + ' : ' + items[i][1]
    result += '\n';
}

fs.writeFile('result.txt', result, function(err) {
    if (err) throw err;
    console.log('Saved!');
})
