import fs from 'fs'
import crypto from 'crypto'

export const fileMd5 = (filePath: string): Promise<string> => {
    const stream = fs.createReadStream(filePath)
    const hash = crypto.createHash('md5')
    return new Promise((resolve) => {
        stream.on('data', d => {
            hash.update(d)
        })
        stream.on('end', () => {
            resolve(hash.digest('hex'))
        })
    })
}

export const passwordMd5 = (text: string) => {
    return crypto.createHash('sha1').update(text).digest('hex')
}

export class ApiError extends Error {
    code: number
    statusCode: number
    constructor(message: string, code = 1, statusCode = 200) {
        super()
        this.message = message;
        this.code = code
        this.statusCode = statusCode
    }
}