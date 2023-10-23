import Fastify, { FastifyInstance } from 'fastify'
import { log } from "../log"
import { Config } from "./config"
import { DbProvider } from './dbProvider'
import fs from 'fs'
import { ApiError } from '../common/common'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { Func } from './func'
//@ts-ignore
import type Ws from '@fastify/websocket'
import { Cron } from './cron'

export class Web {
    config: Config
    dbProvider: DbProvider
    func: Func
    cron: Cron
    fastify: FastifyInstance
    constructor(config: Config, dbProvider: DbProvider, func: Func, cron: Cron) {
        this.config = config
        this.dbProvider = dbProvider
        this.func = func
        this.cron = cron
        //@ts-ignore
        this.fastify = Fastify({
            logger: log
        })
    }

    async run() {
        const config = this.config.getConfig()
        process.on('uncaughtException', function (err) {
            log.error('uncaughtException', err)
        })
        process.on('unhandledRejection', (reason, p) => {
            log.error({ reason, p }, 'unhandledRejection')
        });

        // 处理xml
        this.fastify.addContentTypeParser(['text/xml', 'application/xml'], (request, body, done) => done(null, body))
        this.fastify.setErrorHandler(function (error, request, reply) {
            if (error instanceof ApiError) {
                reply.status(error.statusCode).send({ message: error.message, code: error.code })
            } else {
                request.log.error(error)
                reply.status(500).send({ message: 'unknown error', code: 1000 })
            }
        })
        this.fastify.register(fastifyStatic, {
            root: config.publicDir,
            prefix: '/pub/',
            index: ['index.html'],
            setHeaders: config.browserCache ? (res, pathName) => {
                const ext = pathName.substring(pathName.lastIndexOf('.') + 1)
                const whiteList = ['js', 'css', 'png', 'svg', 'jpg', 'jpeg', 'png', 'mp4']
                if (whiteList.includes(ext)) {
                    res.setHeader("Cache-Control", "public, max-age=2592000");
                }
            } : undefined,
        })
        // allCronStart()
        this.fastify.register(multipart, {
            limits: {
                fieldNameSize: 100,
                fieldSize: 100,
                fields: 10,
                fileSize: 30 * 1024 * 1024,
                files: 1,
                headerPairs: 2000,
            }
        })
        this.registerFunc()
        if (config.openWs) {
            this.registerWs()
        }
        this.cron.allCronStart()

        this.fastify.listen({
            port: config.port || 3000,
            host: config.host || '0.0.0.0'
        }, function (err, address) {
            if (err) {
                log.error(err)
                process.exit(1)
            }
        })
    }

    private registerFunc() {
        this.fastify.all<{ Params: { project: string, name: string } }>('/api/:project/:name', async (request, reply) => {
            const { project, name } = request.params
            return this.func.funcCall(project, name, { request, reply })
        })
        this.fastify.all<{ Params: { project: string, name: string, ext: string } }>('/api/:project/:name/:ext', async (request, reply) => {
            const { project, name, ext } = request.params
            return this.func.funcCall(project, name, { request, reply, ext })
        })
    }

    private registerWs() {
        this.fastify.register(require('@fastify/websocket'))
        this.fastify.register(async (fastify) => {
            fastify.get('/ws', { websocket: true }, async (connection /* SocketStream */, req /* FastifyRequest */) => {
                const query: any = req.query
                if (!query.project || !query.name) {
                    connection.socket.close()
                    return
                }
                try {
                    const func = await this.func.getFunc(query.project, query.name, { event: 'connect', connection, req }, [])
                    if (func && func.ws) {
                        await func.ws()
                    } else {
                        connection.socket.close()
                    }
                } catch (e) {
                    fastify.log.error('ws error', e)
                    connection.socket.close()
                    return
                }

                connection.socket.on('close', async () => {
                    const func = await this.func.getFunc(query.project, query.name, { event: 'close', connection, req }, [])
                    if (func && func.ws) {
                        await func.ws()
                    }
                })
                connection.socket.on('message', async (message: any) => {
                    const func = await this.func.getFunc(query.project, query.name, { event: 'message', connection, req, message }, [])
                    if (func && func.ws) {
                        await func.ws()
                    }
                })
            })
        })
    }
}