const fs = require('fs/promises');
const Jimp = require('jimp');
const path = require('path');

const folderPath = './letters';
const letterHeight = 50


async function getImageGrayscaleMatrix(imagePath) {
    const image = await Jimp.read(imagePath)
    if (image.getHeight() !== letterHeight) {
        image.resize(Jimp.AUTO, letterHeight)
    }

    const pixels = [];
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (
        x,
        y,
        idx
    ) {
        const grayValue = this.bitmap.data[idx];
        pixels.push(grayValue < 255 ? grayValue : -1);
    });

    // Convert the list to a matrix
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const matrix = [];
    for (let i = 0; i < pixels.length; i += width) {
        matrix.push(pixels.slice(i, i + width));
    }

    return matrix
}

function convertMatrixToFlatArray(matrix) {
    const result = []
    for (let i = 0; i < matrix.length; i++) {
        let skipped = 0
        for (j = 0; j < matrix[i].length; j++) {
            if (matrix[i][j] === -1) {
                skipped++
                continue
            }
            if (skipped > 0) {
                result.push(-skipped)
                skipped = 0
            }
            result.push(matrix[i][j])
        }
        result.push(-100)
    }
    return result
}



async function main() {
    try {
        const images = (await fs.readdir(folderPath)).filter(file => path.extname(file).toLowerCase() === '.png');
        const map = {}
        for (const image of images) {
            const imagePath = path.join(folderPath, image)
            const matrix = await getImageGrayscaleMatrix(imagePath)
            const arr = convertMatrixToFlatArray(matrix)
            const imageName = path.parse(image).name;
            map[imageName] = arr
        }

        await fs.writeFile('letters.json', JSON.stringify(map))
    } catch (err) {
        console.error(err)
    }
}


main()