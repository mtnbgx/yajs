import NodeCache from "node-cache";
import { BaseCache } from "./baseCache";

export class MemoryCache implements BaseCache {
    nodeCache: NodeCache
    constructor() {
        this.nodeCache = new NodeCache({
            // 不克隆要缓存复杂对象
            useClones: false,
        });
    }
    keys(): string[] {
        return this.nodeCache.keys()
    }
    get<T>(key: string): T | undefined {
        return this.nodeCache.get(key)
    }
    del(key: string): number {
        return this.nodeCache.del(key)
    }
    set<T>(key: string, value: T, ttl: string | number): boolean {
        return this.nodeCache.set(key, value, ttl)
    }
}