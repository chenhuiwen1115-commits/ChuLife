// 汇率自动获取（对照 docs/技术方案.md 第 4 节）
// 来源：open.er-api.com 免费公共接口，无需 key、支持浏览器跨域

async function autoFetchRate(){
  try{
    const res = await fetch('https://open.er-api.com/v6/latest/CNY');
    const j = await res.json();
    if (j && j.rates && j.rates.THB){
      setRate(j.rates.THB);
      return true;
    }
  }catch(e){ /* 联网失败静默降级为手动值 */ }
  return false;
}
