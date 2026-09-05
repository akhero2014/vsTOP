/* stats.js — スタッツ集計：スパイク/サーブ/トス/キャッチ/レシーブ/ブロックの詳細成績を計算する。
   自チーム・相手チームどちらでも、通算・単一試合どちらでも同じ関数で集計できるようにしてある。
   vsTOP アプリの一部。index.html からこの順番で読み込まれる想定です。 */

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

/* ---- 今の試合：選手・チーム ---- */

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

/* ---- 通算（過去の試合＋進行中の試合）：チーム指定に対応 ---- */

function allTimeEventsByMatch(team){
  const groups = state.matchHistory.map(m=>m.rallyLog.filter(e=>e.team===team));
  if (state.rallyLog.length>0) groups.push(state.rallyLog.filter(e=>e.team===team));
  return groups;
}
function allTimeEventsFlat(team){ return allTimeEventsByMatch(team).flat(); }

/// 試合ごとのイベント配列のリストから、名前で統合した選手別詳細成績を計算する共通処理
function detailedStatsForAllPlayersFromMatches(perMatchEventsList){
  const byName = {}; const sets = {};
  for (const matchEvents of perMatchEventsList){
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
    return computeDetailedStats(events, sets[name], player);
  }).sort((a,b)=>a.player.name.localeCompare(b.player.name,'ja'));
}

function careerDetailedStatsForAllPlayers(team){
  return detailedStatsForAllPlayersFromMatches(allTimeEventsByMatch(team));
}
function allPlayerNamesForTeam(team){
  const names = new Set();
  allTimeEventsByMatch(team).forEach(m=>m.forEach(e=>names.add(e.playerName)));
  return [...names].sort((a,b)=>a.localeCompare(b,'ja'));
}
// 選手名の統合編集は自チームのみ対象（相手チームは名前を細かく追跡する想定がないため）
function allTimeHomePlayerNames(){ return allPlayerNamesForTeam('home'); }

function totalRecordedMatchCount(){ return state.matchHistory.length + (state.rallyLog.length>0?1:0); }

/// 指定チームが「相手のミス」で得た得点の通算。自チームは手動カウンターも考慮する。
function careerOpponentErrorsForTeam(team){
  if (team==='home'){
    const historical = state.matchHistory.reduce((s,m)=>s+(m.homeOpponentErrors||0),0);
    const current = state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints;
    return historical+current;
  }
  const opp = 'home';
  let total = state.matchHistory.reduce((s,m)=>s + m.rallyLog.filter(e=>e.team===opp && e.outcome==='opponent').length, 0);
  total += state.rallyLog.filter(e=>e.team===opp && e.outcome==='opponent').length;
  return total;
}

function allUsedCombos(team){
  return [...new Set(allTimeEventsFlat(team).filter(e=>e.playType==='attack').map(e=>e.combo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function allUsedOpponentServeTypes(team){
  return [...new Set(allTimeEventsFlat(team).filter(e=>e.playType==='serveReceive').map(e=>e.opponentServeType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function allUsedOpponentAttackTypes(team){
  return [...new Set(allTimeEventsFlat(team).filter(e=>e.playType==='receive').map(e=>e.opponentAttackType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}

/* ---- 選手別詳細成績のリストから、チーム全体の集計値を求める（通算タブ・単一試合タブ共通） ---- */

function aggregateFromPlayerList(list){
  const spike = list.reduce((s,p)=>({total:s.total+p.spikeOverall.total, decided:s.decided+p.spikeOverall.decided}), {total:0,decided:0});
  const serve = list.reduce((s,p)=>({total:s.total+p.serve.total, decided:s.decided+p.serve.decided, effective:s.effective+p.serve.effective, miss:s.miss+p.serve.miss}), {total:0,decided:0,effective:0,miss:0});
  const rec = list.reduce((s,p)=>({total:s.total+p.serveReceiveOverall.total, aPass:s.aPass+p.serveReceiveOverall.aPass}), {total:0,aPass:0});
  const totalBlocks = list.reduce((s,p)=>s+p.block.decided, 0);
  return {
    spikeRate: spike.total>0 ? spike.decided/spike.total*100 : null,
    serveRate: serve.total>0 ? (serve.decided*100+serve.effective*25-serve.miss*25)/serve.total : null,
    catchRate: rec.total>0 ? rec.aPass/rec.total*100 : null,
    totalBlocks,
  };
}

/* ---- 単一試合の詳細成績（これまでの記録：試合ごとタブのドリルダウン用） ---- */

function matchHomeEvents(match, team){ return match.rallyLog.filter(e=>e.team===team); }
function matchDetailedStatsForAllPlayers(match, team){
  return detailedStatsForAllPlayersFromMatches([matchHomeEvents(match, team)]);
}
function matchOpponentErrors(match, team){
  const opp = team==='home' ? 'away' : 'home';
  return match.rallyLog.filter(e=>e.team===opp && e.outcome==='opponent').length;
}
function matchUsedCombos(match, team){
  return [...new Set(matchHomeEvents(match,team).filter(e=>e.playType==='attack').map(e=>e.combo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function matchUsedOpponentServeTypes(match, team){
  return [...new Set(matchHomeEvents(match,team).filter(e=>e.playType==='serveReceive').map(e=>e.opponentServeType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function matchUsedOpponentAttackTypes(match, team){
  return [...new Set(matchHomeEvents(match,team).filter(e=>e.playType==='receive').map(e=>e.opponentAttackType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
