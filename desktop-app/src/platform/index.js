// What differs between Windows, macOS and Linux, each in a file of its own.
// Every one offers the same things; win.js does what the cat has always done.
module.exports = process.platform === 'linux' ? require('./linux') : require('./win')
