exports.config = {
    default: {
        project: "test",
        token: "123456",
        url: "http://127.0.0.1:3000",
        secret: {
            "privilege": true
        },
        crons: [
            // { label: 'test key', name: 'hello', cron: '*/10 * * * * *' }
        ]
    },
    production: {
        project: "test",
        // 生产环境token最好是使用环境变量
        token: process.env.YAJS_TOKEN,
        url: "http://127.0.0.1:3000",
        secret: {
            "privilege": true
        },
        crons: [
            // { label: 'test key', name: 'hello', cron: '*/10 * * * * *' }
        ]
    }
}