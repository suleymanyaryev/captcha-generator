const fs = require('fs/promises')
const { getRandomColorTable, convertToLittleEndian } = require('./utils')

const WIDTH = 200
const HEIGHT = 70
const START_LINE = 12

const GIF_HEADER_BLOCK = `\x47\x49\x46\x38\x39\x61` // 6 bytes (means: GIF89a)
const GIF_LOGICAL_SCREEN_DESCRIPTOR = `${convertToLittleEndian(WIDTH)}${convertToLittleEndian(HEIGHT)}\xf3\0\0` // 7 bytes
const GIF_IMAGE_DESCRIPTOR = `\x2c\0\0\0\0${convertToLittleEndian(WIDTH)}${convertToLittleEndian(HEIGHT)}\0` // 10 bytes
const GIF_LZW_MINIMUM_CODE_SIZE = `\x04` // 1 byte
const GIF_ENDING = `\x00;` // 2 bytes
const GIF_META_DATA_LENGTH = 6 + 7 + 48 + 10 + 1
const GIF_SIZE = GIF_META_DATA_LENGTH + 2 + (Math.trunc((WIDTH / 4) * 5) + 1) * HEIGHT;


async function captcha() {
    const imageData = Buffer.alloc(WIDTH * HEIGHT).fill(0xff)
    return imageData
}

function makegif(imageData, gif) {
    gif.fill(`${GIF_HEADER_BLOCK
        }${GIF_LOGICAL_SCREEN_DESCRIPTOR
        }${getRandomColorTable()
        }${GIF_IMAGE_DESCRIPTOR
        }${GIF_LZW_MINIMUM_CODE_SIZE
        }`, 0, GIF_META_DATA_LENGTH, 'ascii')

    let i = 0
    let p = GIF_META_DATA_LENGTH

    for (let y = 0; y < HEIGHT; y++) {
        gif[p] = Math.trunc((WIDTH / 4) * 5)
        p++
        for (let x = 0; x < Math.trunc(WIDTH / 4); x++) {
            let a = imageData[i + 0] >> 4
            let b = imageData[i + 1] >> 4
            let c = imageData[i + 2] >> 4
            let d = imageData[i + 3] >> 4

            gif[p + 0] = 16 | (a << 5) // bbb10000
            gif[p + 1] = (a >> 3) | 64 | (b << 7) // b10000xb
            gif[p + 2] = b >> 1 // 0000xbbb
            gif[p + 3] = 1 | (c << 1) // 00xbbbb1
            gif[p + 4] = 4 | (d << 3) // xbbbb100
            i += 4
            p += 5
        }
    }

    gif.fill(GIF_ENDING, GIF_SIZE - 2)
}

async function generate() {
    const gif = Buffer.alloc(GIF_SIZE)
    const imageData = await captcha()
    makegif(imageData, gif)
    return gif
}

async function main() {
    try {
        const buffer = await generate()
        await fs.writeFile('captcha.gif', buffer)
    } catch (err) {
        console.error(err)
    }
}

main()