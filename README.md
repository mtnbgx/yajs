# Yajs框架

## 简介

Yajs是一个基于Nodejs实现的一个自运行的云函数框架，它允许你通过接口来发布代码，目前默认会内置一个Knex（Postgres或者Sqlite）、Redis（可选）。本文档将介绍如何使用Yajs框架进行开发。

## 亮点

- 超轻量：启动内存在100m以内，500Mb内存的vps运行无负担
- 支持多种运行环境：支持单体部署、集群部署（k8s、serverless）
- 支持Websocket（单体部署下）
- 支持Cron定时任务
- 支持boot、cli等多种发布代码方式
- 支持Typescipt

## 开始教程

1. 创建一个新的文件夹，用于存放项目文件。例如，创建一个名为`my_project`的文件夹。

2. 在项目文件夹中，初始化一个新的Yajs项目。输入以下命令：

```bash
npm init -y
# 安装依赖，有可能需要安装 build-essential （安装sqlite时需要）
npm i @mtnbgx/yajs
```

这将生成一个`package.json`文件，其中包含项目的基本信息并安装yajs。

3. 开始编码，新建文件index.js并填写。

```bash
const { Yajs } = require("@mtnbgx/yajs")

const yajs = new Yajs({
    // config
    port: 3000,
    token: '123456',
    db: 'sqlite',
})
yajs.run()
```
你没看错就几行就完成服务端代码了

4. 安装依赖和运行 
```
node index.js
```

5. 预览Boot(没错借鉴了路由器类似的恢复后台)，token代码为前面的123456，外网环境自己改下token

http://127.0.0.1:3000/pub/boot/

6. boot端发布函数
    - 项目名填：test
    - 选择函数更改
    - 名称填test
    - 填入代码
    ```
    exports.main = async () => {
        return { data: { name: 'admin' } }
    }
    ```
    - 提交后访问http://127.0.0.1:3000/api/test/test

    
> 到这里你已经学会boot下的发布云函数了
## Cli下发布代码（目前只支持Typescript）
```bash
    npm i @mtnbgx/yajs-cli -g
    mkdir test
    cd test
    # 查看操作命令
    yajs -h
    # 生成项目
    yajs -g
    # 编辑好 yajs.config.js配置文件后
    yajs -n hello
    # 访问
    curl http://127.0.0.1:3000/api/test/test
```

## 其他文档

[云函数api](./docs/api.md)

## 预计开发扩展

- 支持像PHP一样监听本地文件来部署代码
- 支持编写ts代码、管理文件等操作的面板端（已有但是还需剥离原本的业务代码、目前先优先支持cli）