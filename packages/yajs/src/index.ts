import { injector } from "./injector"
import { Config } from './service/config'
import { Cron } from './service/cron'
import { Db } from "./service/db"
import { DbProvider } from "./service/dbProvider"
import { Func } from "./service/func"
import { MCache } from "./service/mCache"
import { Secret } from "./service/secret"
import { Web } from "./service/web"
import { Install } from './service/install'

export class Yajs {
    injector = injector
    public ctxHook?: (ctx: any, project: string, name: string) => Promise<void>

    constructor(config: object = {}) {
        injector.register(Config, async () => {
            return new Config(config)
        })
    }

    async run() {
        // 注意检查循环依赖
        injector.register(Cron, ['config', 'db', 'func'])
        injector.register(Db, ['config'])
        injector.register(DbProvider, ['config', 'db'])
        injector.register(Func, ['config', 'db', 'mcache', 'dbProvider', 'secret'])
        injector.register(MCache, ['config'])
        injector.register(Secret, ['config', 'db', 'mcache'])
        injector.register(Web, ['config', 'dbProvider', 'func', 'cron'])
        injector.register(Install, ['config', 'db'])
        const install = await injector.resolveClass(Install)
        await install.run()
        const web = await injector.resolveClass(Web)
        if (this.ctxHook) {
            const func = await injector.resolveClass(Func)
            func.setCtxHook(this.ctxHook)
        }
        await web.run()
    }

}