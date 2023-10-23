import { BaseCache } from "./cache/baseCache";
import { ClusterCache } from "./cache/clusterCache";
import { MemoryCache } from "./cache/memoryCache";
import { Config } from "./config";
import { Db } from "./db";

export class MCache {

    cache?: BaseCache
    config: Config
    db: Db
    constructor(config: Config, db: Db) {
        this.config = config
        this.db = db
    }

    getMCache = () => {
        if (this.cache) {
            return this.cache
        }
        const config = this.config.getConfig()
        if (config.cluster) {
            this.cache = new ClusterCache(this.db.getRedis)
        } else {
            this.cache = new MemoryCache()
        }
        return this.cache
    }
}