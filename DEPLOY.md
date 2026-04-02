# DDP物流平台 — 部署指南

## 方式一：本地运行（立刻测试）

**前提：需要 Node.js 18+**

```bash
cd ddp-server
npm install
node server.js
```

打开浏览器访问 http://localhost:3000

---

## 方式二：Railway 云部署（推荐，免费，获得公网链接）

### 第1步：注册 Railway
访问 https://railway.app → 用 GitHub 账号登录（免费）

### 第2步：把代码放到 GitHub
```bash
cd ddp-server
git init
git add .
git commit -m "DDP logistics platform"
```

在 https://github.com/new 创建新仓库（命名如 `ddp-logistics`），然后：
```bash
git remote add origin https://github.com/你的用户名/ddp-logistics.git
git push -u origin main
```

### 第3步：Railway 部署
1. 登录 https://railway.app
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择你刚创建的 `ddp-logistics` 仓库
4. Railway 会自动检测 Node.js 并运行 `npm install && node server.js`
5. 部署完成后，点击 **Settings → Domains → Generate Domain**
6. 你会得到一个类似 `ddp-logistics-production.up.railway.app` 的链接

### 第4步：分享链接
把该链接发给所有相关方，他们可以直接在浏览器访问。

---

## 方式三：Render 云部署（备选免费方案）

1. 注册 https://render.com
2. 同样先推送代码到 GitHub
3. Render → New → Web Service → Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. 免费方案会分配 `.onrender.com` 域名

---

## 演示账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@ddplogistics.com | Admin2026! |
| Yingsheng 客户 | yingsheng@ddplogistics.com | Yingsheng2026! |
| MYTOP 客户 | mytop@ddplogistics.com | MYTOP2026! |
| RF Express 承运商 | rfexpress@ddplogistics.com | RFExpress2026! |
| Wingo Tech 发货商 | wingo@ddplogistics.com | Wingo2026! |

---

## 数据说明

- 数据库为 SQLite（`logistics.db` 文件，首次运行自动创建）
- 首次启动自动写入全部49个真实集装箱数据
- 消息、发票、用户数据实时保存

---

## 注意事项

- Railway 免费方案每月有500小时运行时，足够测试使用
- 如需永久运行建议升级为 $5/月方案
- SQLite 数据存在服务器内存，重新部署会重置数据（可升级使用 PostgreSQL 持久化）
