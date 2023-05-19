const colors = require('./colors')

function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min
}

function getRandomBytes(length) {
    const byteArray = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        byteArray[i] = Math.floor(Math.random() * 256);
    }
    return byteArray;
}

function getRandomColorTable() {
    return colors[random(0, colors.length)] // 48 bytes
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

function convertToByteArray(str) {
    return str.split('').map((item) => item.charCodeAt(0))
}



module.exports = {
    getRandomBytes,
    getRandomColorTable,
    convertToLittleEndian,
    convertToByteArray,
}