const { randomBytes } = require('crypto')
const colors = require('./colors')

function urandom(size) {
    return new Promise((resolve, reject) => {
        randomBytes(size, (err, buf) => {
            err ? reject(err) : resolve(buf)
        })
    })
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min
}

function convertToLittleEndian(number) {
    const hexString = number.toString(16);
    let littleEndian = []

    for (let i = hexString.length - 2; i >= 0; i -= 2) {
        littleEndian.push(hexString.substr(i, 2))
    }

    littleEndian.push('00', '00')
    littleEndian = littleEndian.slice(0, 2)

    return littleEndian.map((item) => String.fromCharCode(parseInt(item, 16))).join('')
}

function getRandomColorTable() {
    return colors[random(0, colors.length)] // 48 bytes
}

module.exports = {
    random,
    urandom,
    convertToLittleEndian,
    getRandomColorTable
}