import path from "path";

export class Config {
    private config: any

    constructor(config: object) {
        this.config = {
            publicDir: path.join(process.cwd(), './public'),
            domain: 'http://localhost:3000',
            mainShema: 'jsrun',
            fileBroswerDir: './public',
            db: 'pg',
            pg: process.env.pg,
            redis: process.env.redis,
            openWs: true,
            openCron: true,
            cluster: false,
            cacheFile: path.join(process.cwd(), 'kv.db'),
            sqlite: path.join(process.cwd(), 'sqlite.db'),
            browserCache: true,
            ...config,
            ...process.env
        }
    }

    getConfig() {
        return this.config
    }

    schemaTableConv(table: string, schema?: string) {
        if (this.config.db === 'pg') {
            return table
        }
        return (schema || this.config.mainShema) + '-' + table
    }

    tableConv(table: string, schema?: string) {
        return (schema || this.config.mainShema) + (this.config.db === 'pg' ? '.' : '-') + table
    }
}