import { Config } from "./config"
import { Db } from "./db"
import { CronJob } from "cron"
import { Func } from "./func"
import { log } from "../log"
import { TableNames } from "../consts"

export class Cron {
    config: Config
    db: Db
    func: Func
    constructor(config: Config, db: Db, func: Func) {
        this.config = config
        this.db = db
        this.func = func
    }

    cronMap = new Map<string, any>()

    callCron(cron: any) {
        const config = this.config.getConfig()
        if (!config.openCron) {
            return
        }
        if (!cron.status) {
            return
        }
        this.cronMap.get(cron.label)?.stop()
        const getFunc = this.func.getFunc.bind(this.func)
        const job = new CronJob(
            cron.cron,
            async function () {
                try {
                    const f = await getFunc(cron.project, cron.name, {}, [])
                    if (f && f.cron) {
                        f.cron()
                    } else {
                        log.warn(`The cron function is not configured：${cron.label}`)
                    }
                } catch (e) {
                    log.error(e, 'cron error')
                }
            },
            null,
            true,
            'Asia/Shanghai'
        );
        this.cronMap.set(cron.label, job)
    }

    delCron(cron: any) {
        const job = this.cronMap.get(cron.label)
        if (job) {
            job.stop()
            this.cronMap.delete(cron.label)
        }
    }

    // 启动所有定时任务启动时执行
    async allCronStart() {
        const config = this.config.getConfig()
        if (!config.openCron) {
            return
        }
        const crons = await this.db.getDb()(this.config.tableConv(TableNames.Cron)).where({ status: true })
        for (const cron of crons) {
            this.callCron(cron)
        }
    }
}