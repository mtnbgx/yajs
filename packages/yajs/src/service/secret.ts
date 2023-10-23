import { TableNames } from "../consts"
import { log } from "../log"
import { Config } from "./config"
import { Db } from "./db"
import { MCache } from "./mCache"

const keyGen = (project: string) => `secret_${project}`

export class Secret {
    config: Config
    db: Db
    mcache: MCache
    constructor(config: Config, db: Db, mcache: MCache) {
        this.config = config
        this.db = db
        this.mcache = mcache
    }
    async getProjectSecret(project: string) {
        const secret = this.mcache.getMCache().get(keyGen(project))
        if (secret) {
            return secret
        }
        const [funcSecret] = await this.db.getDb()(this.config.tableConv(TableNames.Project)).where({ name: project, status: true }).limit(1)
        if (funcSecret) {
            try {
                const result = JSON.parse(funcSecret.secret) || {}
                this.mcache.getMCache().set(keyGen(project), result, 0)
                return result
            } catch (e) {
                log.error('funcSecret json parse fail', e)
            }
        }
        return {}
    }

    delProjectSecretCache(project: string) {
        this.mcache.getMCache().del(keyGen(project))
    }
}