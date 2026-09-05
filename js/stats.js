/* stats.js — スタッツ集計：スパイク/サーブ/トス/キャッチ/レシーブ/ブロックの詳細成績を計算する
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function spikeStats(events, name){
  const total = events.length;
  const decided = events.filter(e=>e.resultLabel==='決定').length;
  const miss = events.filter(e=>e.outcome==='opponent').length;
  return { name, total, decided, miss, decisionRate: total>0 ? decided/total*100 : null };
}

function receiveStats(events, name){
  const total = events.length;
  const aPass = events.filter(e=>e.resultLabel==='Aパス').length;
  const bPass = events.filter(e=>e.resultLabel==='Bパス').length;
  const cPass = events.filter(e=>e.resultLabel==='Cパス').length;
  return { name, total, aPass, bPass, cPass, aPassRate: total>0 ? aPass/total*100 : null };
}

function computeDetailedStats(events, setsPlayed, player){
  const attacks = events.filter(e=>e.playType==='attack');
  const spikeOverall = spikeStats(attacks, '総合');
  const combos = [...new Set(attacks.map(e=>e.combo).filter(Boolean))].sort();
  const spikeByCombo = combos.map(c=>spikeStats(attacks.filter(e=>e.combo===c), c));

  const serves = events.filter(e=>e.playType==='serve');
  const serveStatsV = {
    total:serves.length,
    decided:serves.filter(e=>e.resultLabel==='エース').length,
    effective:serves.filter(e=>e.resultLabel==='効果あり').length,
    miss:serves.filter(e=>e.resultLabel==='ミス').length,
  };
  serveStatsV.effectiveRate = serveStatsV.total>0
    ? (serveStatsV.decided*100 + serveStatsV.effective*25 - serveStatsV.miss*25) / serveStatsV.total : null;

  const tosses = events.filter(e=>e.playType==='toss');
  const tossStatsV = {
    total:tosses.length,
    success:tosses.filter(e=>e.resultLabel==='成功').length,
    failure:tosses.filter(e=>e.resultLabel==='失敗').length,
    miss:tosses.filter(e=>e.resultLabel==='ミス').length,
  };
  tossStatsV.successRate = tossStatsV.total>0 ? tossStatsV.success/tossStatsV.total*100 : null;

  const srs = events.filter(e=>e.playType==='serveReceive');
  const srOverall = receiveStats(srs, '総合');
  const serveTypes = [...new Set(srs.map(e=>e.opponentServeType).filter(Boolean))].sort();
  const srByType = serveTypes.map(t=>receiveStats(srs.filter(e=>e.opponentServeType===t), t));

  const recs = events.filter(e=>e.playType==='receive');
  const recOverall = receiveStats(recs, '総合');
  const attackTypes = [...new Set(recs.map(e=>e.opponentAttackType).filter(Boolean))].sort();
  const recByType = attackTypes.map(t=>receiveStats(recs.filter(e=>e.opponentAttackType===t), t));

  const blocks = events.filter(e=>e.playType==='block');
  const blockStatsV = { decided: blocks.filter(e=>e.resultLabel==='決定').length, setsPlayed };
  blockStatsV.perSet = setsPlayed>0 ? blockStatsV.decided/setsPlayed : null;

  return { player, setsParticipated:setsPlayed, spikeOverall, spikeByCombo, serve:serveStatsV, toss:tossStatsV,
    serveReceiveOverall:srOverall, serveReceiveByType:srByType, receiveOverall:recOverall, receiveByType:recByType,
    block:blockStatsV };
}

function playerDetailedStats(playerId, team){
  const player = findPlayer(playerId, team);
  const events = state.rallyLog.filter(e=>e.team===team && e.playerId===playerId);
  const setsPlayed = new Set(events.map(e=>e.setNumber)).size;
  return computeDetailedStats(events, setsPlayed, player);
}

function playerDetailedStatsList(team){
  return currentPlayers(team).map(p=>playerDetailedStats(p.id, team)).sort((a,b)=>a.player.number-b.player.number);
}

function teamDetailedStats(team){
  const events = state.rallyLog.filter(e=>e.team===team);
  const placeholder = { number:0, name: team==='home'?state.homeTeamName:state.awayTeamName };
  return computeDetailedStats(events, state.currentSet, placeholder);
}

function allTimeHomeEventsByMatch(){
  const groups = state.matchHistory.map(m=>m.rallyLog.filter(e=>e.team==='home'));
  if (state.rallyLog.length>0) groups.push(state.rallyLog.filter(e=>e.team==='home'));
  return groups;
}

function careerDetailedStatsForAllPlayers(){
  const byName = {}; const sets = {};
  for (const matchEvents of allTimeHomeEventsByMatch()){
    const grouped = {};
    for (const e of matchEvents){
      const name = state.playerNameAliases[e.playerName] || e.playerName;
      (grouped[name] = grouped[name]||[]).push(e);
    }
    for (const name in grouped){
      byName[name] = (byName[name]||[]).concat(grouped[name]);
      sets[name] = (sets[name]||0) + new Set(grouped[name].map(e=>e.setNumber)).size;
    }
  }
  return Object.keys(byName).map(name=>{
    const events = byName[name];
    const last = events[events.length-1];
    const player = { number:last.playerNumber, name, position:'-' };
    const stats = computeDetailedStats(events, sets[name], player);
    return stats;
  }).sort((a,b)=>a.player.name.localeCompare(b.player.name,'ja'));
}

function allTimeHomePlayerNames(){
  const names = new Set();
  allTimeHomeEventsByMatch().forEach(m=>m.forEach(e=>names.add(e.playerName)));
  return [...names].sort((a,b)=>a.localeCompare(b,'ja'));
}

function totalRecordedMatchCount(){ return state.matchHistory.length + (state.rallyLog.length>0?1:0); }

function careerTeamAggregateErrors(){
  const historical = state.matchHistory.reduce((s,m)=>s+m.homeOpponentErrors,0);
  const current = state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints;
  return historical+current;
}

function allTimeHomeEventsFlat(){ return allTimeHomeEventsByMatch().flat(); }

function allUsedCombos(){
  return [...new Set(allTimeHomeEventsFlat().filter(e=>e.playType==='attack').map(e=>e.combo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}

function allUsedOpponentServeTypes(){
  return [...new Set(allTimeHomeEventsFlat().filter(e=>e.playType==='serveReceive').map(e=>e.opponentServeType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}

function allUsedOpponentAttackTypes(){
  return [...new Set(allTimeHomeEventsFlat().filter(e=>e.playType==='receive').map(e=>e.opponentAttackType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}

/* ========================= CSV出力 ========================= */
