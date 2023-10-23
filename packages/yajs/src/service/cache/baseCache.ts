type Key = string
export abstract class BaseCache {
    constructor() { }
    abstract get<T>(key: Key): T | undefined;
    abstract del(key: Key): number;
    abstract set<T>(key: Key, value: T, ttl: number | string): boolean;
    abstract keys(): string[];
}