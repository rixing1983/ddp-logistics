const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ddp-logistics-secret-2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ────────────────────────────────────────────────────────────────────
//  DATABASE
// ────────────────────────────────────────────────────────────────────
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'shipping.db'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  company TEXT,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer TEXT,
  etd TEXT, eta TEXT,
  isf_filed INTEGER DEFAULT 0,
  container TEXT NOT NULL,
  qty INTEGER, shipper TEXT,
  description TEXT, weight TEXT,
  master_bill TEXT, hbl TEXT,
  cbp_hold INTEGER DEFAULT 0,
  in_bond TEXT, exported INTEGER DEFAULT 0,
  trailer TEXT, status TEXT DEFAULT 'PENDING',
  size TEXT DEFAULT '40HC',
  m_est_arr TEXT, m_arrived TEXT, m_unloaded TEXT,
  m_lfd TEXT, m_cleared TEXT, m_prepick TEXT,
  m_brownsville TEXT, m_unpacked TEXT, m_border TEXT,
  m_mx_customs TEXT, m_est_del TEXT, m_delivered TEXT,
  gps TEXT, mx_driver TEXT,
  consignee_contact TEXT, delivery_address TEXT,
  cost REAL DEFAULT 0, price REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer TEXT NOT NULL,
  container_id INTEGER,
  amount REAL NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (container_id) REFERENCES containers(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  sender_name TEXT,
  sender_role TEXT,
  sender_company TEXT,
  channel TEXT NOT NULL,
  container_id INTEGER,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS read_receipts (
  user_id INTEGER,
  message_id INTEGER,
  PRIMARY KEY (user_id, message_id)
);
`);

// ─── Seed default users ─────────────────────────────────────────────
function seedUser(email, password, role, company, name) {
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (!exists) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (email,password_hash,role,company,name) VALUES (?,?,?,?,?)').run(email, hash, role, company, name);
  }
}
seedUser('admin@ddplogistics.com',   'Admin2026!',      'admin',    'DDP Logistics',   'Admin 管理员');
seedUser('yingsheng@ddplogistics.com','Yingsheng2026!', 'customer', 'Yingsheng',       'Yingsheng 客户');
seedUser('mytop@ddplogistics.com',   'MYTOP2026!',      'customer', 'MYTOP',           'MYTOP 客户');
seedUser('rfexpress@ddplogistics.com','RFExpress2026!', 'vendor',   'RF EXPRESS',      'RF Express 承运商');
seedUser('wingo@ddplogistics.com',   'Wingo2026!',      'vendor',   'WINGO TECH CO',   'Wingo Tech 发货商');

// ─── Seed containers ────────────────────────────────────────────────
function seedContainers() {
  const cnt = db.prepare('SELECT COUNT(*) as n FROM containers').get();
  if (cnt.n > 0) return;
  const ins = db.prepare(`INSERT INTO containers
    (customer,etd,eta,isf_filed,container,qty,shipper,description,weight,master_bill,hbl,
     cbp_hold,in_bond,exported,trailer,status,size,
     m_est_arr,m_arrived,m_unloaded,m_lfd,m_cleared,m_prepick,m_brownsville,
     m_unpacked,m_border,m_mx_customs,m_est_del,m_delivered,
     gps,mx_driver,consignee_contact,delivery_address,price,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const rows = [
    ['Yingsheng','2026-02-01','2026-03-03',1,'ZCSU9045182',876,'WINGO TECH CO','塔扇 Tower Fan','8,760 KG','ZIMUNGB20669234','YSSZ26010311',0,'145185316',1,'1203','DELIVERED','40HC','2026年1月30日','✅2026.2.4','✅2026.2.6','/','✅','✅2026.2.7','✅2026/2/7','✅','','','2月19日','✅','','RF EXPRESS Tractor037 / Angel Castro / THERMO1203','Mario Chen 5648959686','C.3 36b-MZ 012, Nueva Espanita, Cuautitlán EM 54879',0,'❌代付杂费$70.35；❌卡车滞留费$600 已发账单未收款'],
    ['Yingsheng','2026-01-24','2026-02-28',1,'TEMU8040108',1784,'SHENZHEN LAMEI','卷帘及配件','17,630 KG','ZIMUNGB20669233','JLS26017784',0,'145185751',1,'3346','DELIVERED','40HC','2026年1月30日','✅2026.2.4','✅2026.2.6','/','✅','✅2026.2.7','✅2026/2/9','✅','','','2026/2/12 Noon','✅','http://hosting.wialon.com/...TEMU8040108','RF EXPRESS Tractor037 / Angel Castro / CAJA559848','Josellyne: 55 4823 5237','Rabaul, Pical Pantaco 02520 CDMX; Bodega15 cortina6',0,'DELIVERED'],
    ['Yingsheng','2026-01-21','2026-02-19',1,'YMLU9558698',825,'SHENZHEN LAMEI','床垫 Mattress','19,750 KG','E226231397001','HZYL2017705',1,'145184830',0,'','DELIVERED','40HC','2026年2月17日','✅2026.2.21','✅2026.2.21','/','✅','✅2026.2.21','✅','✅','','','2026/3/4','✅','http://hosting.wialon.com/...YMLU9558698','RF EXPRESS Tractor008 / Jose Ángel Valles','Vivian 56-1062-4499','Calz. Azcapotzalco-La Villa 774A, Azcapotzalco 02300 CDMX',0,'CBP HOLD | ✅RigMore垫付滞留费$2105；✅RigMore垫付滞箱费$350'],
    ['Yingsheng','2026-01-24','2026-02-28',1,'CXDU2034320',1784,'SHENZHEN LAMEI','SNACK BOWL | 零食碗','17,617 KGS','ONEYSZPFBK381400','JLS26017784',1,'145185751',1,'3346','DELIVERED','40HC','2026年3月10日','✅2026.3.12','✅2026.3.12','2026.3.18','✅2026.3.14','✅2026.3.24','✅2026.3.24','','','','客人想3/15-3/20到达','✅','https://hosting.wialon.com/...CXDU2034320','RF EXPRESS Tractor023 / Jose Ramiro Teran / CAJA3346','Cel +52 8117 957991 / qiang huo 2381168825','C. Potrerillos 6, Col. Parque Industrial Izcalli, 57810 Nezahualcóyotl',0,'DELIVERED'],
    ['Yingsheng','2026-02-01','2026-03-03',1,'TEMU8109919',876,'WINGO TECH CO','BATHROOM MIRROR | 浴室镜','17,980 KGS','ZIMUSHH32037564','YSSZ26010311',0,'145185316',1,'1203','DELIVERED','40HC','2026年3月11日','✅2026.3.10','✅2026.3.10','/','✅2026.3.13','✅2026.3.14','✅2026.3.14','✅','','','✅2026.3.24','✅','','RF EXPRESS Tractor037 / Angel Castro / THERMO1203','Cell +528683627626 / john +52 712 115 2844','Av industrial 91, el trébol, 54610 Tepotzotlán México',0,'DELIVERED | ✅$600卡车滞留费'],
    ['MYTOP','','2026-03-23',1,'BSIU5004705',0,'V5302 // LAREDO','THERMAL BOTTLE','13,070 KG','','',0,'145186204',1,'35','DELIVERED','TRANSFER','','✅2026.3.11','✅卸船2026.3.17','','客户自己清关','','','','','','2026/3/22 已提走','✅','','','','LOS REYES-TEXCOCO KM.13.3, 56255 VILLA SANTIAGO CUAUTLALPAN, MEXICO',0,'DELIVERED | ❌未结账'],
    ['Yingsheng','2026-03-23','2026-03-24',1,'R108 // PHARR, TX',866,'ESGU8014250','DESK OFF CHAIR','26,895 KGS OVERWEIGHT','','',0,'145185795',1,'R108','DELIVERED','TRANSFER','/','','','','/','✅2026.3.31','','','','','','✅','','','qiang huo 2381168825 / Cristian 5637896851','墨飞2仓: C. Potrerillos 6, Izcalli, 57810 Nezahualcóyotl',0,'DELIVERED'],
    ['Yingsheng','','2026-03-23',0,'EGSU8014250 (美转墨)',0,'V5302 // LAREDO','办公椅','13,820 KG','EGLV143570975078','',0,'',1,'35','DELIVERED','TRANSFER','/','','','/','/','/','✅2026.3.24','','','','2026/3/22 已提走','✅','','Antonio López Sáenz / Truck760DT1 / Tráiler R108','Cassie 6265915380','Teolopark Nave2B, Camino a Tecla, Teoloyucan 54786',0,'DELIVERED | ❌未结账'],
    ['Yingsheng','2026-01-21','2026-02-19',1,'ZCSU9045393',825,'SHENZHEN LAMEI','WIRED HEADSET | 有线耳机','18,900 KGS','ZIMUSHH32017705','HZYL2017705',1,'145184830',0,'','CBP_HOLD','40HC','2026年2月21日','✅2026.2.28','✅2026.2.28','2026/3/6','✅2026.3.13','✅2026.3.13','','','','','客人想3/15-3/20到达','','','','入仓andy +52 5523067544 / 出仓Frady +52 5549313093','LOGIPARK I TEPOTZOTLAN, 54785 Tepotzotlán',0,'CBP HOLD | ✅RigMore垫付滞留费$2105；✅RigMore垫付滞箱费$350'],
    ['Yingsheng','2026-01-25','2026-02-21',1,'YMLU9570564',2125,'SHENZHEN LAMEI','TOWER FAN | 塔扇','7,910 KGS','YMJAE2322550022','NBF26011774',1,'145185025',0,'1203','CBP_HOLD','40HC','2026年2月25日','✅2026.3.4','✅2026.3.4','/','✅2026.3.24','✅2026.3.24','2026.3.27派送','','','','客人想3/15-3/20到达','','','','edgar +52 55 8115 6832','Bodega 4, Av. Ejido Teoloyucan, 54785 Teoloyucan',17150,'CBP HOLD | ❌RigMore垫付Wharfage$76+$228.70'],
    ['Yingsheng','2026-02-11','2026-03-12',1,'KOCU9028387',1105,'WINGO TECH CO','MIRROR | 家居用品','19,220 KGS','HDMUSZPM33549400','GSDRHMAN549400',0,'145187140',0,'','CLEARED','40HC','','✅2026.3.23','✅2026.3.23','/','✅2026.3.23','hold','','','','','预计2026.3.30派送','','','','Qin Yunbing 5573451409','Camino de la masa 3, 54990 Tultepec EM',0,'到仓库先hold，等GOSU1063163一起走'],
    ['Yingsheng','2026-02-10','2026-03-14',1,'GOSU1065314',1437,'WINGO TECH CO','TOWER FAN | 塔扇','22,914 KGS','ZIMUSHH32050470','YGLDYSSZ26020140',0,'145187394',0,'','CLEARED','40HC','2026年3月14日','✅2026.3.23','✅2026.3.23','3月27日','✅2026.3.26','hold','','','','','预计2026.3.30派送','','','','5580341203 Celina / 5543442527 Bella / 5514562060 Lydia','Av. del Peral 32, 54713 Cuautitlán Izcalli cortina22',17500,'IN WAREHOUSE'],
    ['MYTOP','2026-02-06','2026-03-15',1,'ZCSU9044268',1068,'JINAN YANGGSHENG','WORK UNIFORM | 纺织品等','18,002 KGS','ZIMUNGB20881315','KAL60200077',0,'145186252',1,'T31','IN_TRANSIT_MX','40HC','/','✅2026.3.11','✅卸船2026.3.17','','客户自己清关','/','','✅提货2026.3.24','','','✅2026.3.24','','','','kaia chen +52 5657132641 / wenjia +52 55 6184 3956','Calle Lago Esmeralda No.2, Atizapán de Zaragoza CP52989',0,'2026.3.16显示hold'],
    ['MYTOP','2026-02-06','2026-03-15',1,'ZCSU9035184',910,'FUZHOU WEIKA','CURTIN SHOWER H | 卫浴五金','15,204 KGS','ZIMUNGB20881314','KAL60200076',0,'145186204',1,'T10','IN_TRANSIT_MX','40HC','2026年3月14日','✅2026.3.11','✅卸船2026.3.17','3月27日','客户自己清关','','✅2026.3.25','','','','✅2026.3.25','','','','5580341203 Celina / 5543442527 Bella / 5514562060 Lydia','Av. del Peral 32, 54713 Cuautitlán Izcalli cortina22',17500,'2026.3.16显示hold'],
    ['Yingsheng','2026-02-11','2026-03-17',1,'ONEU7007467',995,'SHENZHEN LAMEI','MIRROR | 镜子','20,800 KGS','ONEYSZPG23691300','SZPVJLS26027911',0,'145187103',0,'1203','IN_TRANSIT_MX','40HC','2026年3月17日','✅2026.3.24','✅2026.3.24','/','✅2026.3.24','✅2026.3.24','2026.3.27派送','','','','','','','','入仓andy +52 5523067544 / 出仓Frady +52 5549313093','LOGIPARK I TEPOTZOTLAN, 54785 Tepotzotlán',17150,'超重额外费用$500'],
    ['Yingsheng','2026-02-11','2026-03-17',1,'MOEU1412713',1891,'SHENZHEN LAMEI','CUTLERY TRAY | 金色餐具托盘','17,130 KGS','ONEYSZPG31759700','AXXMAE26020129T',0,'145187136',0,'','CLEARED','40HC','2026年3月17日','✅2026.3.23','✅2026.3.23','/','预计2026.3.27','✅2026.3.31','','','','','','','','qiang huo 2381168825 / Cristian 5637896851','C. Potrerillos 6, 57810 Nezahualcóyotl',0,'❌RigMore垫付$105'],
    ['Yingsheng','2026-02-17','2026-03-31',1,'GOSU1063163',1212,'WINGO TECH CO','CAR PLAYER | 车载播放器','27,140 KGS','ZIMUSHH32059333','YGLDSSZ26020175',0,'','0','','ISF_FILED','40HC','2026年3月17日','','','','','','','','','','','','','','Qin Yunbing 5573451409','Camino de la masa 3, 54990 Tultepec EM',0,''],
    ['Yingsheng','2026-02-18','2026-04-01',1,'ONEU7043802',16,'SHENZHEN LAMEI','SINK | 水槽','14,880 KGS','ONEYTAOG10023600','MLILMQD26022455',0,'','0','','ISF_FILED','40HC','2026年3月23日','','','','','','','','','','','','','','qiang huo 2381168825 / Cristian 5637896851','C. Potrerillos 6, 57810 Nezahualcóyotl',0,''],
    ['Yingsheng','2026-02-22','2026-03-24',1,'ZCSU9030388',1399,'SHENZHEN LAMEI','HAIR BASIN | 工具','14,160 KGS','ZIMUSHH32047291','OBSH2627642',0,'145185795',0,'','IN_BOND','40HC','/','','','','/','✅2026.3.31','','','','','','','','','qiang huo 2381168825 / Cristian 5637896851','墨飞2仓: C. Potrerillos 6, 57810 Nezahualcóyotl',0,''],
    ['Yingsheng','2026-02-19','2026-03-24',1,'ZCSU9042603',1255,'WINGO TECH CO','STORAGE CABINET | 家具','23,508 KGS','ZIMUSHH32060336','YGLDYSSZ26020261',0,'145187405',0,'','IN_BOND','40HC','2026年3月24日','','','','','','','','','','','','','','VIVIAN 5610624499','Calz. Azcapotzalco - La Villa 774, 02300 CDMX',17900,''],
    ['Yingsheng','2026-03-22','2026-04-17',1,'CXDU2230908',1451,'SHENZHEN LAMEI','PHONE CASE | 手机壳','21,500 KGS','COSU6447003276','OBLMOBSH2637158',0,'','0','','ISF_FILED','40HC','2026年4月17日','','','','','','','','','','','','','','qiang huo 2381168825 / Cristian 5637896851','C. Potrerillos 6, 57810 Nezahualcóyotl',0,''],
    ['Yingsheng','2026-03-21','2026-04-18',1,'EGSU8013762',661,'WINGO TECH CO','HOOK SHOWER | 挂钩/浴帘杆','16,536 KGS','EGLV149601807715','YGLDSSZ26030128',0,'','0','','ISF_FILED','40HC','2026年4月18日','','','','','','','','','','','','','','5580341203 Celina / 5543442527 Bella','Av. del Peral 32, Cuautitlán Izcalli 54713 cortina22',0,''],
    ['Yingsheng','2026-03-24','2026-04-21',1,'TLLU4590072',614,'WINGO TECH CO','OFFICE CHAIR | 办公椅','17,271 KGS','ZIMUNGB20724886','NIVBYFZ2603053',0,'','0','','ISF_FILED','40HC','2026年4月21日','','','','','','','','','','','','','','5580341203 Celina / 5543442527 Bella','Av. del Peral 32, Cuautitlán Izcalli 54713',0,''],
    ['Yingsheng','2026-03-24','2026-04-21',1,'ZCSU7375328',775,'WINGO TECH CO','OFFICE CHAIR | 办公椅','17,542 KGS','ZIMUNGB20724887','NIVBYFZ2603054',0,'','0','','ISF_FILED','40HC','2026年4月21日','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-03-21','2026-04-27',1,'EITU1629244',1077,'WINGO TECH CO','COAT RACK | 衣帽架','11,179 KGS','EGLV140658288756','NXHSQDXH26030188',0,'','0','','PENDING','40HC','2026.5.3','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-03-26','2026-04-28',1,'ZCSU9026789',1313,'SHENZHEN LAMEI','MIRROR | 镜子','20,440 KGS','ZIMUSHH32080199','GSDRHZYL2080199',0,'','0','','ISF_FILED','40HC','2026年4月28日','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-03-26','2026-04-28',1,'ZCSU9027126',1767,'SHENZHEN LAMEI','MIRROR | 镜子','21,400 KGS','ZIMUSHH32080182','GSDRHZYL2080182',0,'','0','','ISF_FILED','40HC','2026年4月28日','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-03-04','2026-05-01',1,'KOCU9017952',1168,'SHENZHEN LAMEI','BATHROOM VANITY | 浴室柜','17,025 KG','HDMUSHAM90142600','ZHEMZJWL26040120',0,'','0','','PENDING','40HC','2026.5.1','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-04-01','2026-05-03',1,'SEGU5929688',958,'WINGO TECH CO','PAPER BAG | 纸袋','23,571 KGS','ONEYSZPG67537300','YGLDYSSZ26030254',0,'','0','','PENDING','40HC','2026.5.3','','','','','','','','','','','','','','','',0,''],
    ['Yingsheng','2026-04-03','2026-05-08',1,'COSU6448756010',876,'WINGO TECH CO','STROLLER | 婴儿手推车','7,333 KGS','COSU6448756010','NXHSQDXH26030499',0,'','0','','PENDING','40HC','/','','','','/','/','/','','','','','','','','取货Cassie 6265915380 / 送货Celina 5580341203','Av. del Peral 32, Cuautitlán Izcalli 54713 cortina22',0,''],
    ['Yingsheng','2026-04-03','2026-05-08',1,'COSU6448758970',1018,'WINGO TECH CO','COAT RACK | 衣帽架','12,000 KGS','COSU6448758970','NXHSQDXH26030500',0,'','0','','PENDING','40HC','/','','','','/','/','/','','','','','','','','取货Cassie / 送货john +52 712 115 2844','Av industrial 91, el trébol, CP54610 Tepotzotlán',0,''],
    ['Yingsheng','','',0,'HMMU9067284 (美转墨)',1379,'','DEC. PANELS | 装饰板/办公桌','19,150 KGS','HMMU9067284','',0,'',1,'2012','IN_TRANSIT_MX','TRANSFER','/','','','/','/','/','✅提货2026.3.24','','','','','','','','取货Cassie 6265915380 / 送货Reed 7201970639','Reed 7201970639','Manzana14, Industrial la Presa, 54187 Tlalnepantla',0,'ENROUTE'],
    ['MYTOP','','',0,'TEMU8032925',0,'LAREDO','电子产品及配件、家居日用品','13,849 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'CXDU1722668',0,'LAREDO','电子产品及配件、3D打印产品','17,950 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'EGHU8007600',0,'LAREDO','电子产品及配件、家居厨房用品','16,810 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'TEMU8029639',0,'LAREDO','3D打印与电子设备、家居户外','16,290 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'OOLU5386296',0,'LAREDO','电子产品及配件、家居厨房','18,640 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'DRYU4565800',0,'LAREDO','3D打印及相关耗材、工具五金','18,570 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
    ['MYTOP','','',0,'CSNU9544509',0,'LAREDO','3D打印及相关耗材、电子产品','18,880 KG','','',0,'',0,'','PENDING','40HC','','','','','','','','','','','','','','','ATTN: SUNNY TEL: +1 628 2222655','ATLANTIC LOGISTICS MEXICO SA DE CV, SAN JUAN IXHUATEPE, 54180 MEX',0,''],
  ];
  const insertMany = db.transaction(rows => rows.forEach(r => ins.run(...r)));
  insertMany(rows);
}
seedContainers();

// ─── Seed sample invoices ───────────────────────────────────────────
function seedInvoices() {
  const cnt = db.prepare('SELECT COUNT(*) as n FROM invoices').get();
  if (cnt.n > 0) return;
  const ins = db.prepare('INSERT INTO invoices (customer,container_id,amount,description,status,due_date) VALUES (?,?,?,?,?,?)');
  ins.run('Yingsheng', 1, 3200.00, 'DDP报关清关服务费 - ZCSU9045182 Tower Fan', 'paid', '2026-03-01');
  ins.run('Yingsheng', 2, 3200.00, 'DDP报关清关服务费 - TEMU8040108 卷帘', 'paid', '2026-03-01');
  ins.run('Yingsheng', 3, 4100.00, 'DDP报关清关服务费 + CBP滞留费 - YMLU9558698', 'paid', '2026-03-15');
  ins.run('Yingsheng', 9, 5200.00, 'DDP报关服务费 + CBP Hold附加费 - ZCSU9045393', 'pending', '2026-04-15');
  ins.run('Yingsheng',10, 4800.00, 'DDP报关服务费 + CBP Hold附加费 - YMLU9570564', 'pending', '2026-04-15');
  ins.run('MYTOP', 13, 3500.00, 'DDP报关清关服务费 - ZCSU9044268', 'pending', '2026-04-20');
  ins.run('MYTOP', 14, 3500.00, 'DDP报关清关服务费 - ZCSU9035184', 'pending', '2026-04-20');
  ins.run('Yingsheng', null, 1200.00, '❌卡车滞留费代付 - 多票（待核对）', 'overdue', '2026-03-31');
}
seedInvoices();

// ────────────────────────────────────────────────────────────────────
//  AUTH MIDDLEWARE
// ────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ────────────────────────────────────────────────────────────────────
//  AUTH ROUTES
// ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Required' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: '邮箱或密码错误' });
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, company: user.company, name: user.name },
    JWT_SECRET, { expiresIn: '30d' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, company: user.company, name: user.name } });
});

app.get('/api/me', auth, (req, res) => res.json(req.user));

// ────────────────────────────────────────────────────────────────────
//  USERS (admin)
// ────────────────────────────────────────────────────────────────────
app.get('/api/users', auth, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id,email,role,company,name,created_at FROM users ORDER BY role,company').all();
  res.json(users);
});

app.post('/api/users', auth, adminOnly, (req, res) => {
  const { email, password, role, company, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email,password_hash,role,company,name) VALUES (?,?,?,?,?)').run(email, hash, role||'customer', company||'', name||'');
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: '邮箱已存在' }); }
});

app.put('/api/users/:id', auth, adminOnly, (req, res) => {
  const { email, password, role, company, name } = req.body;
  const updates = [];
  const params = [];
  if (email) { updates.push('email=?'); params.push(email); }
  if (password) { updates.push('password_hash=?'); params.push(bcrypt.hashSync(password, 10)); }
  if (role) { updates.push('role=?'); params.push(role); }
  if (company !== undefined) { updates.push('company=?'); params.push(company); }
  if (name !== undefined) { updates.push('name=?'); params.push(name); }
  if (!updates.length) return res.json({ ok: true });
  params.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ ok: true });
});

app.delete('/api/users/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────
//  CONTAINERS
// ────────────────────────────────────────────────────────────────────
function containerFilter(user) {
  if (user.role === 'admin') return '';
  if (user.role === 'customer') return ` WHERE customer='${user.company.replace(/'/g,"''")}'`;
  if (user.role === 'vendor') return ` WHERE shipper='${user.company.replace(/'/g,"''")}'`;
  return ' WHERE 1=0';
}

app.get('/api/containers', auth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM containers${containerFilter(req.user)} ORDER BY created_at DESC`).all();
  res.json(rows);
});

app.get('/api/containers/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM containers WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'customer' && row.customer !== req.user.company) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'vendor' && row.shipper !== req.user.company) return res.status(403).json({ error: 'Forbidden' });
  res.json(row);
});

const CONTAINER_FIELDS = ['customer','etd','eta','isf_filed','container','qty','shipper','description','weight','master_bill','hbl','cbp_hold','in_bond','exported','trailer','status','size','m_est_arr','m_arrived','m_unloaded','m_lfd','m_cleared','m_prepick','m_brownsville','m_unpacked','m_border','m_mx_customs','m_est_del','m_delivered','gps','mx_driver','consignee_contact','delivery_address','cost','price','notes'];

app.post('/api/containers', auth, adminOnly, (req, res) => {
  const fields = CONTAINER_FIELDS.filter(f => req.body[f] !== undefined);
  const vals = fields.map(f => req.body[f]);
  const r = db.prepare(`INSERT INTO containers (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...vals);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/containers/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const fields = CONTAINER_FIELDS.filter(f => req.body[f] !== undefined);
  if (!fields.length) return res.json({ ok: true });
  const vals = [...fields.map(f => req.body[f]), req.params.id];
  db.prepare(`UPDATE containers SET ${fields.map(f=>`${f}=?`).join(',')},updated_at=datetime('now') WHERE id=?`).run(...vals);
  const updated = db.prepare('SELECT * FROM containers WHERE id=?').get(req.params.id);
  io.emit('container_updated', updated);
  res.json({ ok: true });
});

app.delete('/api/containers/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM containers WHERE id=?').run(req.params.id);
  io.emit('container_deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────
//  INVOICES
// ────────────────────────────────────────────────────────────────────
app.get('/api/invoices', auth, (req, res) => {
  let where = '';
  if (req.user.role === 'customer') where = ` WHERE customer='${req.user.company.replace(/'/g,"''")}'`;
  const rows = db.prepare(`SELECT i.*,c.container as container_num FROM invoices i LEFT JOIN containers c ON i.container_id=c.id${where} ORDER BY i.created_at DESC`).all();
  res.json(rows);
});

app.post('/api/invoices', auth, adminOnly, (req, res) => {
  const { customer, container_id, amount, description, status, due_date } = req.body;
  const r = db.prepare('INSERT INTO invoices (customer,container_id,amount,description,status,due_date) VALUES (?,?,?,?,?,?)').run(customer, container_id||null, amount, description, status||'pending', due_date||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/invoices/:id', auth, adminOnly, (req, res) => {
  const { customer, container_id, amount, description, status, due_date } = req.body;
  db.prepare('UPDATE invoices SET customer=?,container_id=?,amount=?,description=?,status=?,due_date=? WHERE id=?').run(customer, container_id||null, amount, description, status, due_date||null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ────────────────────────────────────────────────────────────────────
//  MESSAGES (channel-based)
// ────────────────────────────────────────────────────────────────────
// Channel naming: "admin-customer:Yingsheng", "admin-vendor:RF EXPRESS", "general"
function canReadChannel(user, channel) {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return channel === `admin-customer:${user.company}` || channel === 'general';
  if (user.role === 'vendor') return channel === `admin-vendor:${user.company}` || channel === 'general';
  return false;
}

app.get('/api/messages', auth, (req, res) => {
  const { channel, since } = req.query;
  if (channel && !canReadChannel(req.user, channel)) return res.status(403).json({ error: 'Forbidden' });
  let where = channel ? `WHERE m.channel=?` : `WHERE (m.channel='general'`;
  const params = [];
  if (channel) { params.push(channel); }
  else {
    if (req.user.role === 'customer') where += ` OR m.channel='admin-customer:${req.user.company}'`;
    if (req.user.role === 'vendor') where += ` OR m.channel='admin-vendor:${req.user.company}'`;
    if (req.user.role === 'admin') where = 'WHERE 1=1';
    else where += ')';
  }
  if (since) { where += ` AND m.created_at > ?`; params.push(since); }
  const msgs = db.prepare(`SELECT m.*, u.email as sender_email,
    (SELECT COUNT(*) FROM read_receipts WHERE message_id=m.id AND user_id=?) as is_read
    FROM messages m LEFT JOIN users u ON m.sender_id=u.id ${where} ORDER BY m.created_at ASC LIMIT 200`).all(req.user.id, ...params);
  res.json(msgs);
});

app.post('/api/messages', auth, (req, res) => {
  const { channel, content, container_id } = req.body;
  if (!channel || !content) return res.status(400).json({ error: 'channel and content required' });
  if (!canReadChannel(req.user, channel)) return res.status(403).json({ error: 'Forbidden' });
  const r = db.prepare('INSERT INTO messages (sender_id,sender_name,sender_role,sender_company,channel,content,container_id) VALUES (?,?,?,?,?,?,?)').run(req.user.id, req.user.name, req.user.role, req.user.company, channel, content, container_id||null);
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid);
  io.to(channel).emit('new_message', msg);
  res.json(msg);
});

app.post('/api/messages/:id/read', auth, (req, res) => {
  try { db.prepare('INSERT OR IGNORE INTO read_receipts (user_id,message_id) VALUES (?,?)').run(req.user.id, req.params.id); }
  catch {}
  res.json({ ok: true });
});

app.get('/api/messages/unread-count', auth, (req, res) => {
  const result = db.prepare(`SELECT COUNT(*) as n FROM messages m
    WHERE m.sender_id != ? AND m.id NOT IN (SELECT message_id FROM read_receipts WHERE user_id=?)`).get(req.user.id, req.user.id);
  res.json({ count: result.n });
});

// ────────────────────────────────────────────────────────────────────
//  SOCKET.IO
// ────────────────────────────────────────────────────────────────────
io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, JWT_SECRET);
    next();
  } catch { next(new Error('auth')); }
});

io.on('connection', socket => {
  const u = socket.user;
  socket.join('general');
  if (u.role === 'customer') socket.join(`admin-customer:${u.company}`);
  if (u.role === 'vendor') socket.join(`admin-vendor:${u.company}`);
  if (u.role === 'admin') {
    const channels = db.prepare("SELECT DISTINCT channel FROM messages WHERE channel != 'general'").all();
    channels.forEach(c => socket.join(c.channel));
    socket.on('join_channel', ch => socket.join(ch));
  }
});

// ────────────────────────────────────────────────────────────────────
//  STATS (admin dashboard)
// ────────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, adminOnly, (req, res) => {
  const byStatus = db.prepare("SELECT status, COUNT(*) as n FROM containers GROUP BY status").all();
  const byCustomer = db.prepare("SELECT customer, COUNT(*) as n FROM containers GROUP BY customer").all();
  const revenue = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status='paid'").get();
  const pending = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status='pending'").get();
  const cbpHolds = db.prepare("SELECT COUNT(*) as n FROM containers WHERE cbp_hold=1").get();
  res.json({ byStatus, byCustomer, revenue: revenue.total||0, pending: pending.total||0, cbpHolds: cbpHolds.n });
});

// ────────────────────────────────────────────────────────────────────
//  SPA routes
// ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'public/portal.html')));

// ────────────────────────────────────────────────────────────────────
//  START
// ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚢 DDP Container Tracker running on http://localhost:${PORT}`);
  console.log(`\n📋 Default login accounts:`);
  console.log(`   Admin:     admin@ddplogistics.com / Admin2026!`);
  console.log(`   Yingsheng: yingsheng@ddplogistics.com / Yingsheng2026!`);
  console.log(`   MYTOP:     mytop@ddplogistics.com / MYTOP2026!`);
  console.log(`   RF Express: rfexpress@ddplogistics.com / RFExpress2026!`);
  console.log(`   Wingo Tech: wingo@ddplogistics.com / Wingo2026!`);
});
