#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const { exec } = require('child_process')
const { promisify } = require('util')
const { program } = require('commander')
const { default: axios } = require('axios')
const crypto = require('crypto')
const AdmZip = require("adm-zip")
const FormData = require('form-data');
const os = require('os');

const CWD = process.cwd()
const BASE_API = '/api/boot/func'
const BASE_SRC = path.join(CWD, 'src')
const BASE_DIST = path.join(CWD, 'dist')
const ConfigName = './yajs.config.js'

program
    .option('-n --name <char>', '函数名称')
    .option('-d, --down', '下线函数', false)
    .option('-p, --publish', '发布列表', false)
    .option('-g, --generate', '生成配置', false)
    .option('-e, --env <char>', '环境选择', 'default')
    .option('--downProject', '下线项目', false)
    .option('--secret', '项目设置', false)
    .option('--cron', '定时任务', false)
    .option('--static <char>', '静态资源')

program.parse();

const options = program.opts();
// console.log(options)

if (options.generate) {
    const generate = async () => {
        const templatePath = path.join(__dirname, './template')
        await promisify(exec)(`cp -rf ${templatePath}/* ${CWD}`)
        await promisify(exec)(`mkdir ${BASE_DIST}`)
    }
    generate()
    return
}

if (options.downProject) {
    downProject()
    return
}

if (options.secret) {
    secret()
    return
}

if (options.cron) {
    cron()
    return
}

if (options.static) {
    depolyStatic()
    return
}

if (!options.name) {
    buildAll()
} else {
    publishOne()
}

function buildOne(name) {
    if (!name.endsWith('.ts')) {
        // js文件拷贝
        if (name.endsWith('.js')) {
            const source = fs.readFileSync(path.join(BASE_SRC, name), 'utf8')
            const distPath = path.join(BASE_DIST, name.slice(0, -3) + '.js')
            fs.writeFileSync(distPath, source, 'utf8')
            return source
        }
        return
    }
    const source = fs.readFileSync(path.join(BASE_SRC, name), 'utf8')
    let result = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        }
    });
    let code = result.outputText
    code = code.replace('"use strict";\n', '')
    code = code.replace('Object.defineProperty(exports, "__esModule", { value: true });\n', '')
    // code = code.replace('exports.main = void 0;\n', '')
    code = code.replace('const ctx = _CTX;\n', '')
    code = code.replace('const app = _APP;\n', '')
    code = code.replace('const sys = _SYS;\n', '')
    code = code.replace(/require\(\"/g, 'await require("')
    const distPath = path.join(BASE_DIST, name.slice(0, -3) + '.js')
    fs.writeFileSync(distPath, code, 'utf8')
    return [code, source]
}

async function buildAll() {
    await promisify(exec)(`rm -rf ${BASE_DIST} && mkdir ${BASE_DIST}`)
    const dir = fs.readdirSync(BASE_SRC)
    for (const name of dir) {
        if (options.publish) {
            await upload(name)
        } else {
            buildOne(name)
        }
        console.log(name)
    }
}

function getConfig() {
    let configPath = ''
    const cwdConfig = path.join(CWD, ConfigName)
    const exist = fs.existsSync(cwdConfig)
    if (exist) {
        configPath = cwdConfig
    } else {
        const userHome = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        const homeConfig = path.join(userHome, ConfigName)
        if (!fs.existsSync(homeConfig)) {
            console.error('找不到配置文件')
            throw Error('Configuration file not found')
        }
        configPath = homeConfig
    }
    const { config } = require(configPath)
    if (config[options.env]) {
        const result = config[options.env]
        return result
    } else {
        return config
    }
}

function getHash(str) {
    const hash = crypto.createHash('sha1').update(str).digest('hex');
    return hash
}

async function upload(name) {
    const config = getConfig()
    const [code, ts] = buildOne(name)
    const body = {
        name: name.split('.')[0],
        code,
        ts,
        status: true
    }
    const time = Math.floor(new Date().getTime() / 1000)
    const sign = getHash([config.token, time].join(','))
    const res = await axios.post(config.url + `${BASE_API}?action=depolyOne&project=${config.project}`,
        body,
        {
            headers: { sign, time }
        }
    )
        .then(res => res.data)
        .catch(err => console.log(err.response.data))
    console.log(res)
}

async function publishOne() {
    let name = options.name
    const isTs = await promisify(fs.stat)(path.join(BASE_SRC, options.name + '.ts')).catch(() => { })
    if (isTs) {
        name += '.ts'
    }
    if (!isTs) {
        const isJs = await promisify(fs.stat)(path.join(BASE_SRC, options.name + '.js')).catch(() => { })
        if (isJs) {
            name += '.js'
        } else {
            throw Error('file not found')
        }
    }
    upload(name)
}

async function request(action, body = {}) {
    const config = getConfig()
    const time = Math.floor(new Date().getTime() / 1000)
    const sign = getHash([config.token, time].join(','))
    const res = await axios.post(config.url + `${BASE_API}?action=${action}&project=${config.project}`,
        body,
        {
            headers: { sign, time }
        }
    )
        .then(res => res.data)
        .catch(err => console.log(err.response.data))
    console.log(res)
}

async function downProject() {
    return request('down')
}

async function secret() {
    const config = getConfig()
    if (!(config?.secret)) {
        return
    }
    return request('secret', { secret: config?.secret })
}


async function cron() {
    const config = getConfig()
    if (!(config?.crons)) {
        return
    }
    return request('cronAll', { crons: config?.crons })
}

async function depolyStatic() {
    const dir = path.join(CWD, options.static)
    const exist = fs.existsSync(dir)
    if (!exist) {
        console.log('文件不存在')
        return
    }
    const zip = new AdmZip();
    zip.addLocalFolder(dir, '')
    const file = path.join(os.tmpdir(), './yajs-dist.zip')
    zip.writeZip(file)
    const form = new FormData()
    form.append('file', fs.createReadStream(file))
    return request('depolyStatic', form)
}