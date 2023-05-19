const fs = require('fs/promises')
const { getRandomColorTable, getRandomBytes, convertToLittleEndian, convertToByteArray } = require('./utils')
const font = require('./font')
const colors = require('./colors')
const SW = require('./sw')

const NDOTS = 100
const PADDING_X = 10
const PADDING_Y = 5
const LETTER_SPACE = 7

const BCaptcha = 'g2x0cUTsZGJMUbgU25H6Q0jiXMXz3iF0k4K8EP4IPIzSKlhDJK2DZY1aItsC'

const GIF_HEADER_BLOCK = `\x47\x49\x46\x38\x39\x61` // 6 bytes (means: GIF89a)
const GIF_LZW_MINIMUM_CODE_SIZE = `\x04` // 1 byte
const GIF_ENDING = `\x00;` // 2 bytes

const GIF_META_DATA_LENGTH = GIF_HEADER_BLOCK.length + 7 + 10 + colors[0].length + GIF_LZW_MINIMUM_CODE_SIZE.length

function getGifSize(width, height) {
    return GIF_META_DATA_LENGTH + GIF_ENDING.length + (Math.trunc(width / 4) * 5 + 1) * height;
}

function getGifLogicalScreenDescriptor(width, height) {
    return `${convertToLittleEndian(width)}${convertToLittleEndian(height)}\xf3\0\0` // 7 bytes
}

function getGifImageDescriptor(width, height) {
    return `\x2c\0\0\0\0${convertToLittleEndian(width)}${convertToLittleEndian(height)}\0`
}


function letter(char, pos, imageData, swr, s1, s2, {
    width, height
}) {
    let l = imageData.length
    let charData = font[char].data
    let r = width * PADDING_Y + pos
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
                r += width
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
        const skewh = Math.floor(SW[sk2] / width)
        sk2 += swr[row] & 0x1

        const x = i + skew * width + skewh
        mpos = Math.max(mpos, pos + i - r)

        if (x - l < height * width) {
            imageData[x] = p << 4
        }
        i++
    }

    return mpos
}

function addLine(im, swr, s1, {
    width, height
}) {
    for (let x = 0, sk1 = s1; x < width - 1; x++) {
        if (sk1 >= width) sk1 %= width
        let skew = Math.floor(SW[sk1] / 16)
        sk1 += (swr[x] & 0x3) + 1
        let i = width * Math.trunc(PADDING_Y + height / 2.5 + skew) + x
        im[i + 0] = 0
        im[i + 1] = 0
        im[i + width] = 0
        im[i + width + 1] = 0
    }
}

function addDots(im, dr, {
    width, height
}) {
    for (let n = 0; n < NDOTS; n++) {
        const v = (
            (dr[n] << 24) |
            (dr[n + 1] << 16) |
            (dr[n + 2] << 8) |
            dr[n + 3]
        );
        let i = v % (width * (height - 3))

        im[i + 0] = 0xff
        im[i + 1] = 0xff
        im[i + 2] = 0xff
        im[i + width] = 0xff
        im[i + width + 1] = 0xff
        im[i + width + 2] = 0xff
    }
}

function applyBlur(im, {
    width, height
}) {
    for (let i = 0, y = 0; y < height - 2; y++) {
        for (let x = 0; x < width - 2; x++) {
            let c11 = im[i + 0]
            let c12 = im[i + 1]
            let c21 = im[i + width]
            let c22 = im[i + width + 1]
            im[i++] = Math.floor((c11 + c12 + c21 + c22) / 4)
        }
    }
}


async function createImageData(captchaString, {
    width,
    height,
}) {
    const skewRandom = getRandomBytes(200)
    const dotsRandom = getRandomBytes(100 * 4)
    const s1 = getRandomBytes(1)[0] & 0x7f
    const s2 = getRandomBytes(1)[0] & 0x3f

    const imageData = new Uint8Array(width * height).fill(0xff)

    let offset = PADDING_X
    for (const char of captchaString) {
        if (!(char in font)) {
            continue
        }
        offset = letter(char, offset, imageData, skewRandom, s1, s2, {
            width, height
        })
        offset += LETTER_SPACE
    }


    addLine(imageData, skewRandom, s1, {
        width, height
    })
    addDots(imageData, dotsRandom, {
        width, height
    })
    // applyBlur(imageData, {
    //     width, height
    // })

    return imageData
}


function makegif(imageData, gif, {
    width,
    height
}) {
    convertToByteArray(`${GIF_HEADER_BLOCK
        }${getGifLogicalScreenDescriptor(width, height)
        }${getRandomColorTable()
        }${getGifImageDescriptor(width, height)
        }${GIF_LZW_MINIMUM_CODE_SIZE
        }`,
    ).forEach((item, index) => {
        gif[index] = item
    })

    let i = 0
    let p = GIF_META_DATA_LENGTH

    for (let y = 0; y < height; y++) {
        gif[p] = Math.trunc(width / 4) * 5
        p++
        for (let x = 0; x < Math.trunc(width / 4); x++) {
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

    convertToByteArray(GIF_ENDING).forEach((item, index) => {
        gif[gif.length - GIF_ENDING.length + index] = item
    })
}

async function generateCaptchaImage(captchaString, {
    width,
    height,
}) {
    const gifSize = getGifSize(width, height)
    const gif = new Uint8Array(gifSize)
    const imageData = await createImageData(captchaString, {
        width,
        height
    })
    makegif(imageData, gif, {
        width,
        height
    })
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

function getGifDimensions(captchaString) {
    let width = 0
    let height = 0
    for (const char of captchaString) {
        width += font[char].width
        height = Math.max(height, font[char].height)
    }
    width += (captchaString.length - 1) * LETTER_SPACE
    width += 2 * PADDING_X
    height += 2 * PADDING_Y

    return {
        width: Math.min(255 / 5 * 4, width),
        height
    }
}

async function main() {
    try {
        const [captchaString, _] = generateCaptchaString(BCaptcha)
        const { width, height } = getGifDimensions(captchaString)
        const buffer = await generateCaptchaImage(captchaString, {
            width, height,
        })

        await fs.writeFile('captcha.gif', buffer)
    } catch (err) {
        console.error(err)
    }
}

main()