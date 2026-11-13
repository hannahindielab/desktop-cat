// What differs between Windows, macOS and Linux, each in a file of its own.
// Every one offers the same things; win.js does what the cat has always done.
const PLATFORMS = {
  darwin: () => require('./mac'),
  linux: () => require('./linux'),
}

module.exports = (PLATFORMS[process.platform] ?? (() => require('./win')))()
