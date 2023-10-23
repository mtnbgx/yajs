import { Config } from "./config";
import knex, { Knex } from 'knex'
import Redis from 'ioredis'

export class Db {
    config: Config
    constructor(config: Config) {
        this.config = config
    }
    db?: Knex
    getDb() {
        if (this.db) {
            return this.db
        }
        const config = this.config.getConfig()
        if (config.db === 'sqlite') {
            this.db = knex({
                client: 'better-sqlite3',
                connection: {
                    filename: config.sqlite,
                },
                useNullAsDefault: true
            })
        } else {
            this.db = knex({
                client: 'pg',
                connection: config.pg,
                searchPath: [config.mainShema],
                pool: { min: 0, max: 5 }
            });
        }
        return this.db
    }

    getRedis() {
        const config = this.config.getConfig()
        return new Redis(config.redis || '')
    }
}
