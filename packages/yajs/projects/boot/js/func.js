const AdmZip = require("adm-zip")
const dayjs = require("dayjs")
const path = require("path")
const crypto = require("crypto")

const funcTable = app.tableConv('func')
const projectTable = app.tableConv('project')
const cronTable = app.tableConv('cron')


const getHash = (str) => {
    const hash = crypto.createHash('sha1').update(str).digest('hex');
    return hash
}

const depolyOne = async ({ project, name, code, ts, status }) => {
    const [func] = await ctx.knex(funcTable).where({ project, name }).limit(1)
    if (func) {
        await ctx.knex(funcTable).where({ project, name }).update({ code, ts, status })
    } else {
        await ctx.knex(funcTable).insert({
            project, name, code, ts, status: true
        })
    }
    // 删除内存中函数
    sys.delFuncCache(project, name)
}

const checkSign = () => {
    const time = parseInt(ctx.request.headers['time'])
    const now = Math.floor(new Date().getTime() / 1000)
    if (!(now - 3 < time && time < now + 3)) {
        throw new app.ApiError(`expire:${time}:${now}`, 400, 400)
    }
    const token = sys?.config?.token || ctx.secret.token
    if (!token) {
        throw new app.ApiError('boot close', 400, 400)
    }
    const str = [token, time].join(',')
    const sign = getHash(str)
    if (ctx.request.headers['sign'] !== sign) {
        throw new app.ApiError('auth', 400, 400)
    }
}

exports.main = async () => {
    const { request, reply } = ctx
    // 检查sign
    checkSign()
    const action = request.body?.action || request.query?.action
    if (action === 'depolyOne') {
        const { project } = request.query
        const body = request.body
        await depolyOne({ ...body, project })
        return { data: true, msg: '操作成功' }
    }
    if (action === 'depolyAll') {
        const { project } = request.query
        const { list } = request.body
        for (const item of list) {
            await depolyOne({ ...item, project })
        }
        return { data: true, msg: '操作成功' }
    }
    if (action === 'depolyZip') {
        const files = await request.saveRequestFiles()
        if (files.length !== 1) {
            throw new app.ApiError('文件出错', 400, 400)
        }
        const file = files[0]
        if (file.mimetype !== 'application/x-zip-compressed') {
            throw new app.ApiError('格式出错', 400, 400)
        }
        const { project } = request.query
        const zip = new AdmZip(file.filepath);
        const zipEntries = zip.getEntries();
        // 全部关闭
        await ctx.knex(funcTable).where({ project }).update({ status: false })
        // 删除内存中所有函数
        sys.delProjectAllFunc(project)
        for (const zipEntry of zipEntries) {
            if (!zipEntry.isDirectory && zipEntry.name.endsWith('.js')) {
                const name = zipEntry.name.slice(0, -3)
                const code = zipEntry.getData().toString()
                const [func] = await ctx.knex(funcTable).where({ project, name }).limit(1)
                if (func) {
                    await ctx.knex(funcTable).where({ project, name }).update({ code, status: true })
                } else {
                    await ctx.knex(funcTable).insert({
                        project, name, code, status: true
                    })
                }
                // 删除内存中函数
                sys.delFuncCache(project, name)
            }
        }
        return { data: true, msg: "保存成功" }
    }
    if (action === 'down') {
        const { project } = request.query
        if (!project) {
            throw new app.ApiError('项目不存在', 400, 400)
        }
        // 全部关闭
        await ctx.knex(funcTable).where({ project }).update({ status: false })
        // 删除内存中所有函数
        sys.delProjectAllFunc(project)
        // 销毁数据库链接
        sys.knexInstances.get(project)?.destroy()
        sys.knexInstances.delete(project)
        sys.redisInstances.get(project)?.quit()
        sys.redisInstances.delete(project)
        return {
            data: true, msg: "下线成功"
        }
    }
    if (action === 'pkg') {
        const { project } = request.query
        if (!project) {
            throw new app.ApiError('项目不存在', 400, 400)
        }
        const funcs = await ctx.knex(funcTable).where({ project, status: true })
        const zip = new AdmZip()
        funcs.forEach(func => {
            zip.addFile(func.name + '.js', Buffer.from(func.code), 'utf8')
        })
        const buf = zip.toBuffer();
        reply.header('Content-Type', 'application/octet-stream')
        reply.header('Content-Disposition', `attachment; filename="${project}-${dayjs().format('YYYY-MM-DD HH:mm')}.zip"`)
        return reply
            .send(buf)
    }
    if (action === 'secret') {
        const { project: name } = request.query
        const { secret } = ctx.request.body
        const [curp] = await ctx.knex(projectTable).where({ name }).limit(1)
        if (curp) {
            await ctx.knex(projectTable).where({ name }).update({ secret })
        } else {
            await ctx.knex(projectTable).insert({ name, secret, status: true })
        }
        sys.delProjectSecretCache(name)
        return { data: true, msg: "设置成功" }
    }
    if (action === 'depolyStatic') {
        const files = await request.saveRequestFiles()
        if (files.length !== 1) {
            throw Error('文件出错')
        }
        const file = files[0]
        if (!['application/zip', 'application/x-zip-compressed'].includes(file.mimetype)) {
            throw new app.ApiError('格式出错', 400, 400)
        }
        const { project } = request.query
        const zip = new AdmZip(file.filepath);
        zip.extractAllTo(path.join(app.config.publicDir, project), true);
        return { data: true, msg: "上传成功" }
    }
    if (action === 'cronAll') {
        const { project } = request.query
        const { crons } = ctx.request.body
        const dbCrons = await ctx.knex(cronTable).where({ project })
        for (const c of dbCrons) {
            sys.delCron(c)
        }
        await ctx.knex(cronTable).where({ project }).del()
        for (const c of crons) {
            const newCron = {
                label: c.label, name: c.name, cron: c.cron, project, status: true
            }
            await ctx.knex(cronTable).insert(newCron)
            sys.callCron(newCron)
        }
        return { data: true, msg: "操作成功" }
    }
    return { data: false }
}