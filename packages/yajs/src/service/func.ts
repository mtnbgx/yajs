import { Config } from './config'
import { Db } from './db'
import { ApiError } from '../common/common'
import { TableNames } from '../consts';
import { MCache } from './mCache';
import vm from 'vm'
import { DbProvider } from './dbProvider';
import { Secret } from './secret';
import { injector } from '../injector'
import { Cron } from './cron';
import { log } from '../log';

const keyGen = (project: string, name: string) => `func_${project}_${name}`

export class Func {
    config: Config
    db: Db
    mcache: MCache
    dbProvider: DbProvider
    secret: Secret
    constructor(config: Config, db: Db, mcache: MCache, dbProvider: DbProvider, secret: Secret) {
        this.config = config
        this.db = db
        this.mcache = mcache
        this.dbProvider = dbProvider
        this.secret = secret
    }
    ctxHook?: (ctx: any, project: string, name: string) => Promise<void>

    setCtxHook(fn: any) {
        this.ctxHook = fn
    }
    async funcCall(project: string, name: string, ctx: any) {
        const _module = await this.getFunc(project, name, ctx, [name])
        if (_module) {
            return _module.main()
        }
    }

    async getFunc(project: string, name: string, ctx: any, deps: string[]) {
        if (deps.length === 0) {
            deps.push(name)
        }
        const key = keyGen(project, name)
        let _module: any = this.mcache.getMCache().get(key)
        if (!_module) {
            const [func] = await this.db.getDb()(this.config.tableConv(TableNames.Func)).where({ project, name, status: true }).limit(1)
            if (!func) {
                const message = `${project + '/' + name} function does not exist`
                log.error(message)
                throw new ApiError(message, 500, 500)
            }
            func.code = func.code.replace(/=.?require\(\"/g, '= await require("')
            const fnStr = `(function(_module) {
                _module.init = async function(module,exports,require,ctx,app,sys){
                    ${func.code}
                }
            })`
            const fn = vm.runInThisContext(fnStr, { filename: `vm_func_${project}_${name}` });
            const curModule: any = {}
            fn.call(curModule, curModule)
            // 缓存2小时把
            this.mcache.getMCache().set(key, curModule, 7200)
            _module = curModule
        }
        if (_module && _module.init) {
            const newRequire = async (curName: string) => {
                if (!curName.startsWith('./')) {
                    return require(curName)
                }
                const moduleName = curName.slice(2)
                if (deps.includes(moduleName)) {
                    throw new ApiError(`cyclic dependence: ${moduleName}`, 500, 500)
                }
                const d = [...deps, moduleName]
                return this.getFunc(project, moduleName, ctx, d)
            }
            const module: any = {}
            // 赋值一次就好
            if (!ctx._func) {
                ctx._func = { project, name }
                ctx.knex = this.dbProvider.getKnex(project)
                const config = this.config.getConfig()
                if (config.redis) {
                    ctx.redis = this.dbProvider.getRedis(project)
                }
                ctx.secret = await this.secret.getProjectSecret(project)
                // 最后调用钩子
                this.ctxHook && await this.ctxHook(ctx, project, name)
            }
            await _module.init(module, module, newRequire, ctx, this.getApp(), ctx.secret.privilege ? await this.getSys() : {})
            return module
        }
    }

    getApp() {
        return {
            cache: this.dbProvider.getCache(),
            db: this.config.getConfig().db,
            tableConv: this.config.tableConv.bind(this.config),
            ApiError,
            config: {
                publicDir: this.config.getConfig().publicDir,
                mainShema: this.config.getConfig().mainShema
            }
        }
    }

    async getSys() {
        const cron = await injector.resolveClass(Cron)
        return {
            delFuncCache: this.delFuncCache.bind(this),
            delProjectAllFunc: this.delProjectAllFunc.bind(this),
            delCron: cron.delCron.bind(cron),
            callCron: cron.callCron.bind(cron),
            knexInstances: this.dbProvider.knexInstances,
            redisInstances: this.dbProvider.redisInstances,
            delProjectSecretCache: this.secret.delProjectSecretCache.bind(this.secret),
            mCache: this.mcache.getMCache(),
            config: this.config.getConfig()
        }
    }

    delFuncCache(project: string, name: string) {
        const key = keyGen(project, name)
        this.mcache.getMCache().del(key)
    }

    delProjectAllFunc(project: string) {
        this.mcache.getMCache().keys().forEach(name => {
            if (name.startsWith(`func_${project}_`)) {
                this.mcache.getMCache().del(name)
            }
        })
    }
}