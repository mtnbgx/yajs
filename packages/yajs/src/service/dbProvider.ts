import { Config } from "./config";
import Knex from 'knex'
import Redis from 'ioredis'
import { Db } from "./db";
import NodeCache from 'node-cache'
import fs from 'fs'

export class DbProvider {
    config: Config
    db: Db
    knexInstances = new Map<string, any>()
    redisInstances = new Map<string, Redis>()
    constructor(config: Config, db: Db) {
        this.config = config
        this.db = db;
        ['SIGINT', 'SIGTERM'].forEach(signal => {
            process.on(signal, () => {
                this.saveCache()
                process.exit()
            })
        });
    }

    getKnex(project: string) {
        const config = this.config.getConfig()
        let knex = this.knexInstances.get(project)
        if (knex) {
            return knex
        }
        if (config.db === 'sqlite') {
            return this.db.getDb()
        } else {
            knex = Knex({
                client: 'pg',
                connection: config.pg,
                searchPath: [project],
                pool: { min: 0, max: 5 }
            });
        }
        this.knexInstances.set(project, knex)
        return knex
    }

    getRedis(project: string) {
        const config = this.config.getConfig()
        if (!config.redis) {
            return
        }
        let redis = this.redisInstances.get(project)
        if (redis) {
            return redis
        }
        redis = new Redis(config.redis || '', { keyPrefix: project })
        this.redisInstances.set(project, redis)
        return redis
    }

    cache?: NodeCache
    getCache() {
        if (this.cache) {
            return this.cache
        }
        this.cache = new NodeCache({
            // 要求序列化
            // useClones: true,
        });
        const cacheFile = this.config.getConfig().cacheFile
        const exist = fs.existsSync(cacheFile)
        if (exist) {
            fs.statSync(cacheFile)
            const str = fs.readFileSync(cacheFile, 'utf8')
            if (str) {
                if (this.cache) {
                    this.cache.data = JSON.parse(str)
                }
            }
        }
        return this.cache
    }

    saveCache() {
        console.log('nodeCache save disk');
        if (this.cache) {
            const cacheFile = this.config.getConfig().cacheFile
            fs.writeFileSync(cacheFile, JSON.stringify(this.cache.data))
        }
    }
}