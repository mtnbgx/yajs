## 全局变量
- ctx
- app
- sys （特权应用才有）

## 触发函数方法

- http：main
- cron：cron
- webSocket：ws

## api案例

- knex：ctx.knex('user')
- redis：ctx.redis.get('user')
- secret：ctx.secret
- request：ctx.request(参考fastify)
- reply：ctx.reply(参考fastify)
- cache：app.cache(参考node-cache)

## 引用函数（参考nodejs即可）
- ts：import
- js：require
  
## 建议

- 登录或者权限判断：yajs没有中间件以后大概率也不会有，但是yajs的ctx变量是全局的，所以建议用一个函数专门写个方法判断再引用调用即可