// 界面与交互（对照 docs/设计规范.md；按 docs/执行步骤.md 阶段 2 逐小步实现）

/* ---------- 小工具 ---------- */
function $(sel){ return document.querySelector(sel); }
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function todayStr(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function rateText(){
  return '1 ฿ ≈ ¥' + (1 / getRate()).toFixed(4) + ' · ' +
    (db.rate.updatedAt ? '汇率更新于 ' + new Date(db.rate.updatedAt).toLocaleDateString() : '默认汇率');
}

/* ---------- 页面切换 ---------- */
const PAGE_IDS = ['home', 'add', 'stats', 'me', 'sub-accounts', 'sub-account-form', 'sub-rates', 'sub-backup'];
function switchPage(id){
  PAGE_IDS.forEach(k => {
    const el = document.getElementById('page-' + k);
    if (el) el.classList.toggle('active', k === id);
  });
  document.querySelectorAll('.tab[data-page]').forEach(t => t.classList.toggle('active', t.dataset.page === id));
  $('#fabBtn').classList.toggle('active', id === 'add');
  if (id === 'add') renderAddPage();
  if (id === 'sub-accounts') renderAccList();
  if (id === 'sub-rates') renderRates();
}
function wireNav(){
  document.querySelectorAll('.tab[data-page]').forEach(t => t.addEventListener('click', () => switchPage(t.dataset.page)));
  $('#fabBtn').addEventListener('click', () => switchPage('add'));
  document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.back)));
  // 我的页菜单
  document.querySelectorAll('.menu-item[data-action]').forEach(el => el.addEventListener('click', () => {
    const act = el.dataset.action;
    if (act === 'accounts') switchPage('sub-accounts');
    else if (act === 'rates') switchPage('sub-rates');
    else if (act === 'backup') switchPage('sub-backup');
    else toast('「' + el.querySelector('.mi-name').textContent + '」将在 V2 后续版本提供');
  }));
}

/* ================= 总览页 ================= */
let homeCur = 'CNY'; // 总资产显示币种，点按总资产卡切换
function renderHome(){
  const total = totalAssetsFenCny();
  const shown = homeCur === 'CNY' ? total : convertFen(total, 'CNY', 'THB');
  $('#totalAmount').textContent = curSymbol(homeCur) + fmt(shown);
  $('#totalLabel').textContent = '总资产（折合' + curName(homeCur) + '）';
  $('#totalSub').textContent = rateText() + ' · 点按切换货币显示';
  renderAccCards();
  renderRecent();
}
function renderAccCards(){
  const box = $('#accCards');
  if (!db.accounts.length){
    box.innerHTML = '<div class="empty" style="min-width:100%;"><span class="big">💳</span>还没有账户<br>去「我的 → 账户管理」添加你的钱包吧</div>';
    return;
  }
  box.innerHTML = db.accounts.map(a => {
    const bal = accountBalance(a.id);
    const sub = a.currency === 'THB'
      ? '<div class="sub-bal">≈ ' + curSymbol('CNY') + fmt(convertFen(bal, 'THB', 'CNY')) + '</div>' : '';
    return '<div class="acct-card"><div class="name">' + a.emoji + ' ' + a.name + '</div>' +
      '<div class="bal">' + curSymbol(a.currency) + fmt(bal) + '</div>' + sub + '</div>';
  }).join('');
}
let recentRange = 'all'; // 最近记录筛选：all | month
function renderRecent(){
  const box = $('#recentList');
  if (!db.transactions.length){
    box.innerHTML = '<div class="empty"><span class="big">📝</span>还没有记录<br>点中间的 ＋ 记第一笔吧</div>';
    return;
  }
  let list = db.transactions.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (recentRange === 'month'){
    const d = new Date();
    const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    list = list.filter(t => String(t.date).slice(0, 7) === ym);
  }
  list = list.slice(0, 10);
  box.innerHTML = list.length
    ? list.map(t => recItemHtml(t)).join('')
    : '<div class="empty"><span class="big">📝</span>本月还没有记录</div>';
  document.querySelectorAll('#recentList .rec-item').forEach(el =>
    el.addEventListener('click', () => openTxSheet(el.dataset.id)));
}
function recItemHtml(t){
  const a = db.accounts.find(x => x.id === t.accountId);
  const aName = a ? a.name : '已删除账户';
  if (t.type === 'transfer'){
    const to = db.accounts.find(x => x.id === t.toAccountId);
    return '<div class="rec-item" data-id="' + t.id + '"><div class="rec-icon">💱</div>' +
      '<div class="rec-info"><div class="rec-name">换汇 · ' + aName + ' → ' + (to ? to.name : '已删除账户') +
      '<span class="tag-transfer">不计入支出</span></div>' +
      '<div class="rec-meta">汇率 ' + t.rate + ' · ' + t.date + '</div></div>' +
      '<div class="rec-amt transfer">' + curSymbol(a.currency) + fmt(t.amount) + ' → ' +
      curSymbol(to ? to.currency : 'THB') + fmt(Math.round(t.amount * t.rate)) + '</div></div>';
  }
  const cats = t.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = cats.find(c => c[0] === t.categoryId) || ['📦', '其他'];
  const sign = t.type === 'expense' ? '-' : '+';
  const cross = t.txCurrency && t.txCurrency !== a.currency
    ? ' · ' + curSymbol(t.txCurrency) + fmt(t.amount) + ' 自动折算'
    : '';
  return '<div class="rec-item" data-id="' + t.id + '"><div class="rec-icon">' + cat[0] + '</div>' +
    '<div class="rec-info"><div class="rec-name">' + cat[1] + (t.note ? ' · ' + t.note : '') + '</div>' +
    '<div class="rec-meta">' + aName + cross + ' · ' + t.date + '</div></div>' +
    '<div class="rec-amt ' + (t.type === 'expense' ? 'expense' : 'income') + '">' + sign +
    curSymbol(a.currency) + fmt(t.convertedAmount) + '</div></div>';
}

/* ================= 记账页 ================= */
let addType = 'expense';       // expense | income | transfer
let addCat = 0;                // 分类下标
let addAccountId = null;       // 账户
let amountStr = '';            // 键盘输入的金额字符串
let txCurrency = null;         // 记账金额的币种；null = 跟随账户币种

function renderAddPage(){
  renderCats();
  renderChips();
  updateAmountDisplay();
  updateAddHint();
  if (addType === 'transfer') updateTransferHint();
}
function renderCats(){
  const list = addType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  $('#catGrid').innerHTML = list.map((c, i) =>
    '<div class="cat' + (i === addCat ? ' sel' : '') + '" data-i="' + i + '"><div class="emo">' + c[0] +
    '</div><div class="nm">' + c[1] + '</div></div>').join('');
  document.querySelectorAll('#catGrid .cat').forEach(el =>
    el.addEventListener('click', () => { addCat = +el.dataset.i; renderCats(); }));
}
function renderChips(){
  const box = $('#acctChips');
  if (!db.accounts.length){
    box.innerHTML = '<div class="empty" style="padding:16px 0;">还没有账户，先去「我的 → 账户管理」添加</div>';
    return;
  }
  if (!db.accounts.some(a => a.id === addAccountId)) addAccountId = db.accounts[0].id;
  box.innerHTML = db.accounts.map(a =>
    '<div class="chip' + (a.id === addAccountId ? ' sel' : '') + '" data-id="' + a.id + '">' +
    a.emoji + ' ' + a.name + ' · ' + curSymbol(a.currency) + '</div>').join('');
  document.querySelectorAll('#acctChips .chip').forEach(el =>
    el.addEventListener('click', () => {
      addAccountId = el.dataset.id;
      txCurrency = null;
      renderChips();
      updateAmountDisplay();
      updateAddHint();
    }));
  renderCurSel();
}
function renderCurSel(){
  const acc = db.accounts.find(x => x.id === addAccountId);
  const box = $('#curSel');
  if (!acc || addType === 'transfer'){ box.style.display = 'none'; return; }
  box.style.display = 'flex';
  const cur = txCurrency || acc.currency;
  box.innerHTML = ['CNY', 'THB'].map(c =>
    '<button class="' + (c === cur ? 'sel' : '') + '" data-c="' + c + '">' + curSymbol(c) + ' ' + curName(c) + '</button>').join('');
  document.querySelectorAll('#curSel button').forEach(b =>
    b.addEventListener('click', () => {
      txCurrency = b.dataset.c;
      renderCurSel();
      updateAmountDisplay();
      updateAddHint();
    }));
}
function amountCur(){
  if (addType === 'transfer') return transferFromCurrency();
  const acc = db.accounts.find(x => x.id === addAccountId);
  if (!acc) return 'CNY';
  return txCurrency || acc.currency;
}
function updateAmountDisplay(){
  $('#amountValue').textContent = amountStr || '0.00';
  $('#amountPrefix').textContent = curSymbol(amountCur()) + ' ';
  $('#amountDisplay').className = 'amount-display ' + (addType === 'income' ? 'income' : 'expense');
}
function updateAddHint(){
  const acc = db.accounts.find(x => x.id === addAccountId);
  if (addType === 'transfer'){ $('#curHint').textContent = '换汇是转账 · 不计入支出'; return; }
  if (!acc){ $('#curHint').textContent = '请先选择账户'; return; }
  const fen = toFen(amountStr);
  if (txCurrency && txCurrency !== acc.currency && fen > 0){
    const conv = convertFen(fen, txCurrency, acc.currency);
    $('#curHint').textContent = acc.name + ' 是' + curName(acc.currency) + '账户 · ' +
      curSymbol(txCurrency) + fmt(fen) + ' 将自动折算 ' + curSymbol(acc.currency) + fmt(conv);
  } else {
    $('#curHint').textContent = acc.name + ' · ' + curName(acc.currency);
  }
}
/* 换汇面板 */
function transferFromCurrency(){
  const a = db.accounts.find(x => x.id === $('#trFrom').value);
  return a ? a.currency : 'CNY';
}
function renderTransferSelects(){
  if (!db.accounts.length) return;
  const opts = db.accounts.map(a => '<option value="' + a.id + '">' + a.emoji + ' ' + a.name + '（' + curName(a.currency) + '）</option>').join('');
  $('#trFrom').innerHTML = opts;
  $('#trTo').innerHTML = opts;
  const cny = db.accounts.find(a => a.currency === 'CNY');
  const thb = db.accounts.find(a => a.currency === 'THB');
  $('#trFrom').value = cny ? cny.id : db.accounts[0].id;
  $('#trTo').value = thb ? thb.id : db.accounts[0].id;
  $('#trRate').value = getRate();
}
function updateTransferHint(){
  const from = db.accounts.find(x => x.id === $('#trFrom').value);
  const to = db.accounts.find(x => x.id === $('#trTo').value);
  if (!from || !to) return;
  const fen = toFen(amountStr);
  const rate = parseFloat($('#trRate').value) || getRate();
  const toFenVal = Math.round(fen * rate);
  $('#trHint').textContent = '转出 ' + curSymbol(from.currency) + fmt(fen) + '（' + from.name + '）→ 转入 ' +
    curSymbol(to.currency) + fmt(toFenVal) + '（' + to.name + '）· 总资产不变，不计入支出';
}
function setAddType(type){
  addType = type;
  document.querySelectorAll('.type-btn').forEach(x => {
    x.classList.remove('on-expense', 'on-income', 'on-transfer');
    x.classList.add('on-' + type);
  });
  $('#transferBox').style.display = type === 'transfer' ? 'block' : 'none';
  $('#catGrid').style.display = type === 'transfer' ? 'none' : 'grid';
  $('#curSel').style.display = 'none';
  addCat = 0;
  if (type === 'transfer') renderTransferSelects();
  renderCats();
}

/* ================= 记录保存 / 编辑 / 删除 ================= */
let editingTxId = null; // 正在编辑的记录；null = 记新账
function exitEditMode(){
  if (editingTxId){
    editingTxId = null;
    $('#saveBtn').textContent = '保存这笔账';
  }
}
function buildTxPayload(){
  const fen = toFen(amountStr);
  const note = $('#noteInput').value.trim();
  const date = $('#dateInput').value || todayStr();
  if (addType === 'transfer'){
    const rate = parseFloat($('#trRate').value) || getRate();
    return { type: 'transfer', amount: fen, accountId: $('#trFrom').value, toAccountId: $('#trTo').value,
      rate: rate, note: note, date: date };
  }
  const cats = addType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const acc = db.accounts.find(x => x.id === addAccountId);
  const cur = txCurrency || acc.currency;
  return { type: addType, amount: fen, txCurrency: cur, accountId: acc.id,
    categoryId: cats[addCat][0], convertedAmount: convertFen(fen, cur, acc.currency),
    note: note, date: date };
}
function saveRecord(){
  const fen = toFen(amountStr);
  if (fen <= 0){ toast('请输入金额'); return; }
  if (addType !== 'transfer'){
    const acc = db.accounts.find(x => x.id === addAccountId);
    if (!acc){ toast('请选择账户'); return; }
  } else if (!$('#trFrom').value || !$('#trTo').value){
    toast('请先在「我的 → 账户管理」添加账户'); return;
  } else if ($('#trFrom').value === $('#trTo').value){
    toast('转出和转入不能是同一个账户'); return;
  }
  const payload = buildTxPayload();
  if (editingTxId) updateTransaction(editingTxId, payload);
  else addTransaction(payload);
  exitEditMode();
  // 重置表单
  amountStr = '';
  $('#noteInput').value = '';
  $('#dateInput').value = todayStr();
  renderAll();
  updateAmountDisplay();
  updateAddHint();
  toast('已保存 ✓');
}
function loadToForm(t){
  editingTxId = t.id;
  $('#saveBtn').textContent = '保存修改';
  amountStr = t.amount ? String(t.amount / 100) : '';
  txCurrency = t.txCurrency || null;
  addAccountId = t.accountId;
  $('#noteInput').value = t.note || '';
  $('#dateInput').value = t.date || todayStr();
  if (t.type === 'transfer'){
    setAddType('transfer');
    $('#trFrom').value = t.accountId;
    $('#trTo').value = t.toAccountId;
    $('#trRate').value = t.rate;
  } else {
    setAddType(t.type);
    const cats = t.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const i = cats.findIndex(c => c[0] === t.categoryId);
    addCat = i >= 0 ? i : 0;
  }
  renderAddPage();
  switchPage('add');
}
function openTxSheet(id){
  const t = db.transactions.find(x => x.id === id);
  if (!t) return;
  const title = t.type === 'transfer' ? '💱 换汇记录' : (t.type === 'expense' ? '支出记录' : '收入记录');
  $('#sheet').innerHTML =
    '<div class="s-title">' + title + '</div>' +
    '<button class="s-btn" id="sheetEdit">编辑</button>' +
    '<button class="s-btn danger" id="sheetDelete">删除</button>' +
    '<button class="s-btn cancel" id="sheetCancel">取消</button>';
  $('#sheetMask').classList.add('show');
  $('#sheetCancel').addEventListener('click', closeSheet);
  $('#sheetEdit').addEventListener('click', () => { closeSheet(); loadToForm(t); });
  $('#sheetDelete').addEventListener('click', () => {
    closeSheet();
    removeTransaction(id);
    renderAll();
    toast('记录已删除');
  });
}
function closeSheet(){ $('#sheetMask').classList.remove('show'); }
/* 通用二次确认面板 */
function openConfirmSheet(title, msg, btnText, onConfirm){
  $('#sheet').innerHTML =
    '<div class="s-title">' + title + '</div>' +
    '<div class="s-msg">' + msg + '</div>' +
    '<button class="s-btn danger" id="sheetOk">' + btnText + '</button>' +
    '<button class="s-btn cancel" id="sheetCancel">取消</button>';
  $('#sheetMask').classList.add('show');
  $('#sheetCancel').addEventListener('click', closeSheet);
  $('#sheetOk').addEventListener('click', () => { closeSheet(); onConfirm(); });
}

/* ================= 数据备份（3.1） ================= */
function exportBackup(){
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '中泰记账备份-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('备份文件已生成 ✓');
}
function restoreBackup(text){
  try{
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)){
      throw new Error('格式不符');
    }
    openConfirmSheet('恢复备份', '恢复会覆盖当前账本里的所有数据，确定继续吗？', '覆盖并恢复', () => {
      db = data;
      if (!db.rate) db.rate = { cnyThb: DEFAULT_RATE, updatedAt: null };
      saveDB();
      renderAll();
      toast('备份已恢复 ✓');
    });
  }catch(err){
    toast('文件格式不对，请选择本工具导出的备份文件');
  }
}
function clearAllData(){
  openConfirmSheet('清空账本', '清空后所有账户和记录都会消失且无法恢复。建议先导出备份。确定清空吗？', '确定清空', () => {
    localStorage.removeItem(STORE_KEY);
    db = loadDB();
    renderAll();
    toast('账本已清空，重新开始吧');
  });
}

/* ================= 账户管理 ================= */
let editingAccId = null;   // 正在编辑的账户；null = 新建
let emojiSel = EMOJI_OPTIONS[0];
function renderAccList(){
  const box = $('#accountList');
  if (!db.accounts.length){
    box.innerHTML = '<div class="empty"><span class="big">💳</span>还没有账户<br>点右上角「＋ 新建」添加第一个账户</div>';
    return;
  }
  box.innerHTML = db.accounts.map(a =>
    '<div class="acct-item" data-id="' + a.id + '"><div class="ai-emoji">' + a.emoji + '</div>' +
    '<div class="ai-info"><div class="ai-name">' + a.name + '</div>' +
    '<div class="ai-cur">' + curName(a.currency) + '</div></div>' +
    '<div class="ai-bal">' + curSymbol(a.currency) + fmt(accountBalance(a.id)) + '</div></div>').join('');
  document.querySelectorAll('#accountList .acct-item').forEach(el =>
    el.addEventListener('click', () => openAccForm(el.dataset.id)));
}
function openAccForm(id){
  editingAccId = id || null;
  const a = id ? db.accounts.find(x => x.id === id) : null;
  $('#accFormTitle').textContent = a ? '编辑账户' : '新建账户';
  $('#accName').value = a ? a.name : '';
  emojiSel = a ? a.emoji : EMOJI_OPTIONS[0];
  $('#accCurrency').value = a ? a.currency : 'CNY';
  $('#accBalance').value = a ? (a.initialBalance / 100) : '';
  $('#btnDeleteAccount').style.display = a ? 'block' : 'none';
  renderEmojiPick();
  renderTplChips();
  switchPage('sub-account-form');
}
function renderEmojiPick(){
  $('#accEmoji').innerHTML = EMOJI_OPTIONS.map(e =>
    '<div class="emoji-opt' + (e === emojiSel ? ' sel' : '') + '" data-e="' + e + '">' + e + '</div>').join('');
  document.querySelectorAll('#accEmoji .emoji-opt').forEach(el =>
    el.addEventListener('click', () => { emojiSel = el.dataset.e; renderEmojiPick(); }));
}
function renderTplChips(){
  $('#tplChips').innerHTML = ACCOUNT_TEMPLATES.map(t =>
    '<div class="chip" data-n="' + t.name + '">' + t.emoji + ' ' + t.name + '</div>').join('');
  document.querySelectorAll('#tplChips .chip').forEach(el => el.addEventListener('click', () => {
    const tpl = ACCOUNT_TEMPLATES.find(t => t.name === el.dataset.n);
    $('#accName').value = tpl.name;
    emojiSel = tpl.emoji;
    $('#accCurrency').value = tpl.currency;
    renderEmojiPick();
  }));
}

/* ================= 汇率管理 ================= */
function renderRates(){
  $('#rateInput').value = getRate();
  $('#rateInfo').textContent = '1 泰铢 ≈ ' + (1 / getRate()).toFixed(4) + ' 人民币 · ' +
    (db.rate.updatedAt ? '上次更新 ' + new Date(db.rate.updatedAt).toLocaleString() : '尚未联网更新（默认 4.94）');
}

/* ================= 统计页 ================= */
let statCur = 'cny'; // 基准货币：cny | thb
let statY = null, statM = null; // 展示的年月，默认当前月
function initStatDate(){
  const d = new Date();
  statY = d.getFullYear();
  statM = d.getMonth() + 1;
}
function shiftStatMonth(delta){
  const target = statY * 12 + (statM - 1) + delta;
  const now = new Date();
  if (target > now.getFullYear() * 12 + now.getMonth()){ toast('不能看未来的月份哦'); return; }
  statY = Math.floor(target / 12);
  statM = (target % 12) + 1;
  renderStats();
}
function renderStats(){
  const s = monthSum(statY, statM);
  $('#statMonth').textContent = statY + '年' + statM + '月';
  const sy = statCur === 'cny' ? '¥' : '฿';
  $('#statExp').textContent = sy + fmt(statCur === 'cny' ? s.exp : convertFen(s.exp, 'CNY', 'THB'));
  $('#statInc').textContent = sy + fmt(statCur === 'cny' ? s.inc : convertFen(s.inc, 'CNY', 'THB'));
  renderBars(statY, statM);
  const now = new Date();
  $('#statNext').disabled = (statY === now.getFullYear() && statM === now.getMonth() + 1);
}
function renderBars(y, m){
  // 按分类汇总本月支出（规则 2：换汇不计入），折算 CNY 后按金额降序
  const sum = {};
  monthTxns(y, m).forEach(t => {
    if (t.type !== 'expense') return;
    const cny = convertFen(t.convertedAmount, accountCurrency(t.accountId), 'CNY');
    sum[t.categoryId] = (sum[t.categoryId] || 0) + cny;
  });
  const rows = EXPENSE_CATEGORIES
    .map(c => ({ emo: c[0], name: c[1], fen: sum[c[0]] || 0 }))
    .filter(r => r.fen > 0)
    .sort((a, b) => b.fen - a.fen);
  if (!rows.length){
    $('#barList').innerHTML = '<div class="empty"><span class="big">📊</span>记几笔账后，这里会出现分类占比</div>';
    return;
  }
  const total = rows.reduce((s, r) => s + r.fen, 0);
  const sy = statCur === 'cny' ? '¥' : '฿';
  $('#barList').innerHTML = rows.map(r => {
    const shown = statCur === 'cny' ? r.fen : convertFen(r.fen, 'CNY', 'THB');
    const pct = Math.round(r.fen / total * 100);
    return '<div class="bar-row"><div class="bar-top"><span class="b-name">' + r.emo + ' ' + r.name +
      '</span><span class="b-val">' + sy + fmt(shown) + ' · ' + pct + '%</span></div>' +
      '<div class="bar"><div class="bar-fill" style="width:' + Math.max(pct, 4) + '%;"></div></div></div>';
  }).join('');
}

/* ================= 初始化 ================= */
function renderAll(){ renderHome(); renderStats(); }
function init(){
  const d = new Date();
  $('#greetDate').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + '日一二三四五六'[d.getDay()];
  $('#dateInput').value = todayStr();
  wireNav();

  // 记账页：类型切换（手动切换时退出编辑状态）
  document.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => {
    exitEditMode();
    setAddType(b.dataset.type);
    renderAddPage();
  }));
  // 记账页：键盘
  document.querySelectorAll('#keypad .key').forEach(k => k.addEventListener('click', () => {
    const v = k.dataset.k;
    if (v === 'del'){ amountStr = amountStr.slice(0, -1); }
    else if (v === '.' && amountStr.includes('.')){ return; }
    else if (amountStr.length < 9){ amountStr += v; }
    if (amountStr.startsWith('.')) amountStr = '0' + amountStr;
    updateAmountDisplay();
    updateAddHint();
    if (addType === 'transfer') updateTransferHint();
  }));
  // 换汇面板联动
  ['#trFrom', '#trTo', '#trRate'].forEach(s => $(s).addEventListener('input', () => {
    updateTransferHint();
    updateAmountDisplay();
  }));
  // 记账页：保存
  $('#saveBtn').addEventListener('click', saveRecord);

  // 账户管理
  $('#btnAddAccount').addEventListener('click', () => openAccForm(null));
  $('#btnSaveAccount').addEventListener('click', () => {
    const name = $('#accName').value.trim();
    if (!name){ toast('请填写账户名称'); return; }
    const data = { name: name, emoji: emojiSel, currency: $('#accCurrency').value, initialBalance: toFen($('#accBalance').value) };
    if (editingAccId) updateAccount(editingAccId, data);
    else addAccount(data);
    editingAccId = null;
    renderAll();
    switchPage('sub-accounts');
    toast('账户已保存 ✓');
  });
  $('#btnDeleteAccount').addEventListener('click', () => {
    if (!editingAccId) return;
    if (!removeAccount(editingAccId)){ toast('该账户已有交易记录，暂不能删除'); return; }
    editingAccId = null;
    renderAll();
    switchPage('sub-accounts');
    toast('账户已删除');
  });

  // 汇率管理
  $('#btnSaveRate').addEventListener('click', () => {
    const v = parseFloat($('#rateInput').value);
    if (!v || v <= 0){ toast('请输入正确的汇率'); return; }
    setRate(v);
    renderRates();
    renderHome();
    toast('汇率已保存 ✓');
  });
  $('#btnFetchRate').addEventListener('click', async () => {
    $('#btnFetchRate').textContent = '正在获取…';
    const ok = await autoFetchRate();
    $('#btnFetchRate').textContent = '联网获取最新汇率';
    renderRates();
    renderHome();
    toast(ok ? '已更新为最新汇率 ✓' : '获取失败，请手动输入');
  });

  // 总览：点按总资产卡切换货币
  $('#totalCard').addEventListener('click', () => {
    homeCur = homeCur === 'CNY' ? 'THB' : 'CNY';
    renderHome();
  });

  // 统计页：基准货币切换（所有金额与图表一并折算）
  document.querySelectorAll('.toggle-btn[data-cur]').forEach(b => b.addEventListener('click', () => {
    statCur = b.dataset.cur;
    document.querySelectorAll('.toggle-btn[data-cur]').forEach(x => x.classList.toggle('sel', x === b));
    renderStats();
  }));
  // 统计页：月份切换
  initStatDate();
  $('#statPrev').addEventListener('click', () => shiftStatMonth(-1));
  $('#statNext').addEventListener('click', () => shiftStatMonth(1));
  // 总览页：最近记录筛选
  document.querySelectorAll('.toggle-btn[data-range]').forEach(b => b.addEventListener('click', () => {
    recentRange = b.dataset.range;
    document.querySelectorAll('.toggle-btn[data-range]').forEach(x => x.classList.toggle('sel', x === b));
    renderRecent();
  }));

  // 底部弹出面板：点遮罩关闭
  $('#sheetMask').addEventListener('click', e => {
    if (e.target === $('#sheetMask')) $('#sheetMask').classList.remove('show');
  });

  // 数据备份
  $('#btnExport').addEventListener('click', exportBackup);
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => restoreBackup(String(reader.result));
    reader.readAsText(f);
    e.target.value = '';
  });
  $('#btnClearData').addEventListener('click', clearAllData);

  // PWA：正式部署（HTTPS）后注册离线缓存；本地 file:// 打开时浏览器不允许，不影响使用
  if ('serviceWorker' in navigator && location.protocol === 'https:'){
    navigator.serviceWorker.register('./sw.js');
  }

  renderAll();
}
init();
