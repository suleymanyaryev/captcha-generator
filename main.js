const fs = require('fs/promises')
const generateCaptchaImage = require('./src/captcha')

const BCaptcha = 'g2x0cUTsZGJMUbgU25H6Q0jiXMXz3iF0k4K8EP4IPIzSKlhDJK2DZY1aItsC'

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
        const [captchaString, _] = generateCaptchaString(BCaptcha)
        const buffer = await generateCaptchaImage(captchaString)

        await fs.writeFile('captcha.gif', buffer)
    } catch (err) {
        console.error(err)
    }
}

main()