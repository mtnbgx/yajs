type Creator = (injector: Injector) => Promise<any>
type AConstructorTypeOf<T> = new (...args: any[]) => T;

class Injector {
    dependencies = new Map<string, { clz: any, value?: any, deps: string[], creator?: Creator }>()

    register<T>(clz: AConstructorTypeOf<T>, deps: string[]): void;
    register<T>(clz: AConstructorTypeOf<T>, creator: Creator): void;
    register<T>(clz: AConstructorTypeOf<T>, value: any) {
        if (Array.isArray(value)) {
            this.dependencies.set(clz.name.toLocaleLowerCase(), { clz, deps: value })
        } else {
            this.dependencies.set(clz.name.toLocaleLowerCase(), { clz, creator: value, deps: [] })
        }
    }

    async resolveClass<T>(cl: AConstructorTypeOf<T>): Promise<T> {
        return this.resolve(cl.name.toLocaleLowerCase())
    }

    async resolve(name: string) {
        const pack = this.dependencies.get(name)
        if (!pack) {
            return
        }
        if (pack.value) {
            return pack.value
        }
        if (pack.deps.length === 0) {
            let ins: any
            if (pack.creator) {
                ins = await pack.creator(this)
            } else {
                ins = new pack.clz()
            }
            pack.value = ins
            this.dependencies.set(name, pack)
            return ins
        } else {
            let insList: any[] = []
            for (const dep of pack.deps) {
                insList.push(await this.resolve(dep.toLocaleLowerCase()))
            }
            const ins = new pack.clz(...insList)
            pack.value = ins
            this.dependencies.set(name, pack)
            return ins
        }
    }
}

export const injector = new Injector()
