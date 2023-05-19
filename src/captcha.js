const fs = require('fs/promises')
const { getRandomColorTable, convertToLittleEndian, urandom } = require('./utils')
const font = require('./font')
const SW = require('./sw')

const WIDTH = 200
const HEIGHT = 70
const START_LINE = 12
const BCaptcha = 'g2x0cUTsZGJMUbgU25H6Q0jiXMXz3iF0k4K8EP4IPIzSKlhDJK2DZY1aItsC'

const GIF_HEADER_BLOCK = `\x47\x49\x46\x38\x39\x61` // 6 bytes (means: GIF89a)
const GIF_LOGICAL_SCREEN_DESCRIPTOR = `${convertToLittleEndian(WIDTH)}${convertToLittleEndian(HEIGHT)}\xf3\0\0` // 7 bytes
const GIF_IMAGE_DESCRIPTOR = `\x2c\0\0\0\0${convertToLittleEndian(WIDTH)}${convertToLittleEndian(HEIGHT)}\0` // 10 bytes
const GIF_LZW_MINIMUM_CODE_SIZE = `\x04` // 1 byte
const GIF_ENDING = `\x00;` // 2 bytes
const GIF_META_DATA_LENGTH = 6 + 7 + 48 + 10 + 1
const GIF_SIZE = GIF_META_DATA_LENGTH + 2 + (Math.trunc((WIDTH / 4) * 5) + 1) * HEIGHT;


function letter(char, pos, imageData, swr, s1, s2) {
    let l = imageData.length
    let charData = font[char]
    let r = WIDTH * START_LINE + pos
    let i = r
    let sk1 = s1 + pos
    let sk2 = s2 + pos
    let mpos = pos
    let row = 0

    for (let j = 0, k = charData.length; j < k; j++) {
        let p = charData[j]
        if (p === -101) {
            continue
        }

        if (p < 0) {
            if (p === -100) {
                r += WIDTH
                i = r
                sk1 = s1 + pos
                row++
                continue
            }
            i += -p
            continue
        }

        if (sk1 >= 200) {
            sk1 = sk1 % 200
        }
        const skew = Math.floor(SW[sk1] / 20)
        sk1 += (swr[pos + i - r] & 0x1) + 1

        if (sk2 >= 200) {
            sk2 %= 200
        }
        const skewh = Math.floor(SW[sk2] / WIDTH)
        sk2 += swr[row] & 0x1

        const x = i + skew * WIDTH + skewh
        mpos = Math.max(mpos, pos + i - r)

        if (x - l < HEIGHT * WIDTH) {
            imageData[x] = p << 4
        }
        i++
    }

    return mpos
}

async function createImageData(captchaString) {
    const rb = await urandom(200 + 100 * 4 + 1 + 1)
    const swr = Buffer.alloc(200)
    const dr = Buffer.alloc(100 * 4)
    let s1
    let s2

    rb.copy(swr, 0, 0, 200)
    rb.copy(dr, 0, 200, 200 + 100 * 4)
    s1 = rb.readUInt8(200 + 100 * 4)
    s2 = rb.readUInt8(200 + 100 * 4 + 1)

    const imageData = Buffer.alloc(WIDTH * HEIGHT).fill(0xff)

    s1 &= 0x7f
    s2 &= 0x3f

    let offset = 15
    for (const char of captchaString) {
        if (!(char in font)) {
            continue
        }
        offset = letter(char, offset, imageData, swr, s1, s2)
        offset += 7
    }

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

async function generateCaptchaImage(captchaString) {
    const gif = Buffer.alloc(GIF_SIZE)
    const imageData = await createImageData(captchaString)
    makegif(imageData, gif)
    return gif
}


function generateCaptchaString(BCaptcha) {
    let length = BCaptcha.length / 10
    let mod = BCaptcha.length - 1
    let random = Math.round(Math.random() * 1000)
    let captcha = ""
    for (let i = 1; i <= length; i++) {
        let num = random * i % mod
        captcha += BCaptcha[num]
    }
    return [captcha, random]
}

async function main() {
    try {
        // const captchaString = generateCaptchaString(BCaptcha)
        const buffer = await generateCaptchaImage('abcdef')
        await fs.writeFile('captcha.gif', buffer)
    } catch (err) {
        console.error(err)
    }
}

main()