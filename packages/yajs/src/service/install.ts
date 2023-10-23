import { TableNames } from '../consts'
import { Config } from './config'
import { Db } from './db'
import path from 'path'
import fs from 'fs'
import { log } from '../log'
import { Knex } from "knex";

export class Install {
    config: Config
    db: Db
    constructor(config: Config, db: Db) {
        this.config = config
        this.db = db
    }

    async run() {
        const config = this.config.getConfig()
        if (config.db === 'pg') {
            await this.db.getDb().schema.createSchemaIfNotExists("jsrun")
        }
        const has = await this.db.getDb().schema.hasTable(this.config.schemaTableConv('func'))
        if (has) {
            return
        }
        await this.createTableIfNotExists(TableNames.Project, t => {
            t.increments().primary();
            t.string('name').index().unique()
            t.text('secret')
            t.boolean('status').defaultTo(false)
            t.timestamps(true, true, true);
        });
        await this.createTableIfNotExists(TableNames.Func, t => {
            t.increments().primary();
            t.string('project');
            t.string('name');
            t.text('code');
            t.text('ts');
            t.boolean('status').defaultTo(false)
            t.timestamps(true, true, true);
            t.index(['project', 'name'])
            t.unique(['project', 'name']);
        });
        await this.createTableIfNotExists(TableNames.Cron, t => {
            t.increments().primary();
            t.string('project');
            t.string('name');
            t.string('label');
            t.string('cron');
            t.boolean('status').defaultTo(false)
            t.timestamps(true, true, true);
            t.index(['project', 'name'])
            t.unique(['project', 'name', 'label']);
        });
        await this.installProject()
        log.info('install success')
    }

    async installProject() {
        const config = this.config.getConfig()
        const prosPath = path.join(__dirname, '../../projects/')
        const projects = fs.readdirSync(prosPath)
        for (const project of projects) {
            const [pro] = await this.db.getDb()(this.config.schemaTableConv(TableNames.Project)).where({ name: project }).limit(1)
            if (pro) {
                // 项目存在就退出这个应用安装
                continue
            }
            log.info({ project }, 'project install')
            let secret = '{}'
            try {
                secret = fs.readFileSync(path.join(prosPath, project, 'secret.json'), 'utf8')
            } catch (e) {
                log.error('read secret fail', e)
            }
            await this.db.getDb()(this.config.schemaTableConv(TableNames.Project)).insert({ name: project, secret, status: true }).catch(() => { })
            try {
                const dir = path.join(prosPath, project, 'js')
                fs.accessSync(dir)
                const jss = fs.readdirSync(dir)

                for (const js of jss) {
                    if (!js.endsWith('.js')) {
                        continue
                    }
                    const code = fs.readFileSync(path.join(dir, js), 'utf8')
                    const name = js.slice(0, -3)
                    await this.db.getDb()(this.config.schemaTableConv(TableNames.Func)).insert({
                        project, name, code, status: true
                    })
                }
            } catch (e) {
                log.error(e, 'read js fail')
            }
            fs.cpSync(path.join(prosPath, project, 'static'), path.join(config.publicDir, project), { recursive: true })
        }
    }

    async createTableIfNotExists(table: string, t: (table: Knex.CreateTableBuilder) => void) {
        const has = await this.db.getDb().schema.hasTable(this.config.schemaTableConv(table))
        if (has) {
            return
        }
        return this.db.getDb().schema.createTable(this.config.schemaTableConv(table), t)
    }
}