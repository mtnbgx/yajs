const { Yajs } = require("./dist/index.js")

const yajs = new Yajs({
    token: '123456',
    db: 'sqlite',
    sqlite: ':memory:'
})
yajs.run()