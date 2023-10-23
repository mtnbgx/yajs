import NodeCache from "node-cache";
import { BaseCache } from "./baseCache";
import { Redis } from "ioredis";
import { log } from "../../log";

const channel = 'ClusterCache-del';

export class ClusterCache implements BaseCache {
    nodeCache: NodeCache
    subRedis: Redis;
    sendRedis: Redis
    constructor(createRedis: () => Redis) {
        this.nodeCache = new NodeCache({
            // 不克隆要缓存复杂对象
            useClones: false,
        });
        this.subRedis = createRedis()
        this.sendRedis = createRedis()
        this.subRedis.subscribe(channel, (error, count) => {
            if (error) {
                log.error(error)
            }
            log.info(
                `Subscribed successfully! This client is currently subscribed to ${count} channels.`
            );
        })
        this.subRedis.on("message", (curChannel, message) => {
            if (curChannel === channel) {
                this.rightDel(message)
            }
        });
    }
    keys(): string[] {
        return this.nodeCache.keys()
    }
    get<T>(key: string): T | undefined {
        return this.nodeCache.get(key)
    }
    del(key: string): number {
        log.info('del publish', channel, key)
        this.sendRedis.publish(channel, key)
        return 1
    }
    set<T>(key: string, value: T, ttl: string | number): boolean {
        return this.nodeCache.set(key, value, ttl)
    }
    private rightDel(key: string) {
        return this.nodeCache.del(key)
    }
}