// 数据层：localStorage 读写与记账规则（对照 docs/技术方案.md 第 3、8 节）
// 规则 1：余额永远由交易推导（单一数据源，删除记录自动重算）
// 规则 2：换汇是转账，不计入任何支出/收入统计
// 规则 3：跨币种消费按汇率折算成账户币种
// 规则 4：统计按基准货币（默认 CNY）折算

const STORE_KEY = 'zhongtai_v1';
const DEFAULT_RATE = 4.94; // 1 CNY = 4.94 THB

let db = loadDB();

function loadDB(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  }catch(e){ /* 数据损坏则从空账本开始 */ }
  return { accounts: [], transactions: [], rate: { cnyThb: DEFAULT_RATE, updatedAt: null } };
}
function saveDB(){ localStorage.setItem(STORE_KEY, JSON.stringify(db)); }

function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- 金额（一律以「分」为整数存储） ---------- */
function toFen(v){ const n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n * 100); }
function fmt(fen){
  const n = fen / 100;
  const abs = Math.abs(n).toFixed(2);
  const parts = abs.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + parts.join('.');
}
function curSymbol(cur){ return cur === 'CNY' ? '¥' : '฿'; }
function curName(cur){ return cur === 'CNY' ? '人民币' : '泰铢'; }

/* ---------- 汇率 ---------- */
function getRate(){ return (db.rate && db.rate.cnyThb) || DEFAULT_RATE; }
function setRate(v){ db.rate = { cnyThb: Math.round(parseFloat(v) * 10000) / 10000, updatedAt: Date.now() }; saveDB(); }
// 金额币种换算（分）：fromCur → toCur
function convertFen(fen, fromCur, toCur){
  if (fromCur === toCur) return fen;
  return fromCur === 'THB' ? Math.round(fen / getRate()) : Math.round(fen * getRate());
}

/* ---------- 账户 ---------- */
function addAccount(a){ a.id = uid('a'); db.accounts.push(a); saveDB(); }
function updateAccount(id, patch){ const a = db.accounts.find(x => x.id === id); if (a){ Object.assign(a, patch); saveDB(); } }
function removeAccount(id){
  const hasTx = db.transactions.some(t => t.accountId === id || t.toAccountId === id);
  if (hasTx) return false; // 有交易记录的账户不可删除，避免历史账目失真
  db.accounts = db.accounts.filter(x => x.id !== id);
  saveDB(); return true;
}
function accountCurrency(id){ const a = db.accounts.find(x => x.id === id); return a ? a.currency : 'CNY'; }

/* ---------- 交易 ---------- */
function addTransaction(t){ t.id = uid('t'); t.createdAt = Date.now(); db.transactions.push(t); saveDB(); }
function updateTransaction(id, patch){ const t = db.transactions.find(x => x.id === id); if (t){ Object.assign(t, patch); saveDB(); } }
function removeTransaction(id){ db.transactions = db.transactions.filter(x => x.id !== id); saveDB(); }

/* ---------- 余额（账户币种，分）· 规则 1 ---------- */
function accountBalance(accId){
  const a = db.accounts.find(x => x.id === accId);
  if (!a) return 0;
  let bal = a.initialBalance;
  db.transactions.forEach(t => {
    if (t.type === 'transfer'){
      if (t.accountId === accId) bal -= t.amount;
      else if (t.toAccountId === accId) bal += Math.round(t.amount * t.rate);
    } else if (t.accountId === accId){
      bal += t.type === 'expense' ? -t.convertedAmount : t.convertedAmount;
    }
  });
  return bal;
}
/* 总资产（折算 CNY，分）· 规则 4 */
function totalAssetsFenCny(){
  return db.accounts.reduce((s, a) => s + convertFen(accountBalance(a.id), a.currency, 'CNY'), 0);
}

/* ---------- 月度统计（折算 CNY，分）· 规则 2：换汇不计入 ---------- */
function monthTxns(y, m){
  return db.transactions.filter(t => {
    const d = String(t.date).split('-');
    return +d[0] === y && +d[1] === m;
  });
}
function monthSum(y, m){
  let exp = 0, inc = 0;
  monthTxns(y, m).forEach(t => {
    if (t.type === 'expense') exp += convertFen(t.convertedAmount, accountCurrency(t.accountId), 'CNY');
    else if (t.type === 'income') inc += convertFen(t.convertedAmount, accountCurrency(t.accountId), 'CNY');
  });
  return { exp, inc };
}
