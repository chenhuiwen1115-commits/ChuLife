// 预设数据（对照 docs/设计规范.md 第 6 节：分类与图标）

// 支出分类
const EXPENSE_CATEGORIES = [
  ['🍜','餐饮'],['🚕','交通'],['🏠','房租'],['💡','水电'],['📱','话费'],
  ['🛒','购物'],['🎓','学费'],['🎮','娱乐'],['💊','医疗'],['📦','其他'],
];

// 收入分类
const INCOME_CATEGORIES = [
  ['💰','零花钱'],['🧧','红包'],['💸','退款'],['🏦','利息'],['📦','其他'],
];

// 账户预设模板
const ACCOUNT_TEMPLATES = [
  { name:'支付宝', emoji:'💙', currency:'CNY' },
  { name:'微信', emoji:'💬', currency:'CNY' },
  { name:'人民币现金', emoji:'💴', currency:'CNY' },
  { name:'泰铢现金', emoji:'💵', currency:'THB' },
  { name:'开泰银行', emoji:'🏦', currency:'THB' },
  { name:'TrueMoney', emoji:'📱', currency:'THB' },
];

// 可选账户图标
const EMOJI_OPTIONS = ['💙','💬','💴','💵','🏦','📱','💳','💰'];
