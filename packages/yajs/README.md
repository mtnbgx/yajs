## 云函数

```
const { Yajs } = require("yajs")

const yajs = new Yajs()
yajs.ctxHook = async (ctx, project, name) => {
    ctx.hook = 'ok'
}
yajs.run()
```

## 预览

http://127.0.0.1:3000/pub/boot/