/* stats.js — スタッツ集計：スパイク/サーブ/トス/キャッチ/レシーブ/ブロックの詳細成績を計算する。
   自チーム・相手チームどちらでも、通算・単一試合どちらでも同じ関数で集計できるようにしてある。
   vsTOP アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function spikeStats(events, name){
  const total = events.length;
  const decided = events.filter(e=>e.resultLabel==='決定').length;
  const miss = events.filter(e=>e.resultLabel==='ミス').length;
  const blocked = events.filter(e=>e.resultLabel==='相手ブロック').length;
  return { name, total, decided, miss, blocked, decisionRate: total>0 ? decided/total*100 : null };
}

function receiveStats(events, name){
  const total = events.length;
  const aPass = events.filter(e=>e.resultLabel==='Aパス').length;
  const bPass = events.filter(e=>e.resultLabel==='Bパス').length;
  const cPass = events.filter(e=>e.resultLabel==='Cパス').length;
  const miss = events.filter(e=>e.resultLabel==='ミス').length;
  return { name, total, aPass, bPass, cPass, miss, aPassRate: total>0 ? aPass/total*100 : null };
}

/// サーブの種類別（ジャンプ/フローター等）の内訳を計算する
function serveTypeStats(events, name){
  const total = events.length;
  const decided = events.filter(e=>e.resultLabel==='エース').length;
  const effective = events.filter(e=>e.resultLabel==='効果あり').length;
  const miss = events.filter(e=>e.resultLabel==='ミス').length;
  const effectiveRate = total>0 ? (decided*100 + effective*25 - miss*25) / total : null;
  return { name, total, decided, effective, miss, effectiveRate };
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
  const serveTypeNames = [...new Set(serves.map(e=>e.subType).filter(Boolean))].sort();
  const serveByType = serveTypeNames.map(t=>serveTypeStats(serves.filter(e=>e.subType===t), t));

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

  const lossEvents = events.filter(e=>e.playType==='lossOfPoint');
  const lossFouls = lossEvents.filter(e=>e.genre==='反則');
  const lossFoulByDetail = {};
  LOSS_FOUL_DETAILS.forEach(d=>{ lossFoulByDetail[d] = lossFouls.filter(e=>e.detail===d).length; });
  const lossOfPointV = {
    total: lossEvents.length,
    反則: lossFouls.length,
    foulByDetail: lossFoulByDetail,
    レシーブミス: lossEvents.filter(e=>e.genre==='レシーブミス').length,
    連携ミス: lossEvents.filter(e=>e.genre==='連携ミス').length,
  };

  return { player, setsParticipated:setsPlayed, spikeOverall, spikeByCombo, serve:serveStatsV, serveByType, toss:tossStatsV,
    serveReceiveOverall:srOverall, serveReceiveByType:srByType, receiveOverall:recOverall, receiveByType:recByType,
    block:blockStatsV, lossOfPoint:lossOfPointV };
}

/* ---- 今の試合：選手・チーム ---- */

/// 出場形態：スタメンだった場合は開始時のポジション（S1〜S6）、途中出場の場合は「MC」（メンバーチェンジ）
function participationLabel(startingLineup, substitutedIds, playerId){
  const entry = (startingLineup||[]).find(e=>e.playerId===playerId);
  if (entry) return entry.position;
  if ((substitutedIds||[]).includes(playerId)) return 'MC';
  return null;
}

function playerDetailedStats(playerId, team){
  const player = findPlayer(playerId, team);
  const events = state.rallyLog.filter(e=>e.team===team && e.playerId===playerId);
  const setsPlayed = new Set(events.map(e=>e.setNumber)).size;
  const result = computeDetailedStats(events, setsPlayed, player);
  const startingLineup = team==='home' ? state.homeStartingLineup : state.awayStartingLineup;
  result.participationType = participationLabel(startingLineup, state.substitutedPlayerIds, playerId);
  return result;
}
function playerDetailedStatsList(team){
  return currentPlayers(team).map(p=>playerDetailedStats(p.id, team)).sort((a,b)=>a.player.number-b.player.number);
}
function teamDetailedStats(team){
  const events = state.rallyLog.filter(e=>e.team===team);
  const placeholder = { number:0, name: team==='home'?state.homeTeamName:state.awayTeamName };
  return computeDetailedStats(events, state.currentSet, placeholder);
}

/// チーム全体での失点の内訳（ジャンル別・反則は種類別まで、連携ミスは選手名も列挙）
/// events は既に対象チーム側だけに絞り込み済みのものを渡す
function lossOfPointBreakdownFromEvents(lossEvents){
  const fouls = lossEvents.filter(e=>e.genre==='反則');
  const foulByDetail = {};
  LOSS_FOUL_DETAILS.forEach(d=>{ foulByDetail[d] = fouls.filter(e=>e.detail===d).length; });
  return {
    total: lossEvents.length,
    反則: fouls.length,
    foulByDetail,
    レシーブミス: lossEvents.filter(e=>e.genre==='レシーブミス').length,
    連携ミス: lossEvents.filter(e=>e.genre==='連携ミス').map(e=>({ playerNames: e.playerNames||[] })),
  };
}
function lossOfPointBreakdownForTeamEvents(events, team){
  return lossOfPointBreakdownFromEvents(events.filter(e=>e.playType==='lossOfPoint' && e.team===team));
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
    const player = { id:last.playerId, number:last.playerNumber, name, position:'-' };
    return computeDetailedStats(events, sets[name], player);
  }).sort((a,b)=>a.player.name.localeCompare(b.player.name,'ja'));
}

/* ---- 通算（過去の試合＋進行中の試合）：チーム「名前」で対象を絞り込む ----
   同じチームが試合によってhome/awayどちらの側にもなり得るため、team(役割)ではなく
   チーム名で対象の試合を選び、試合ごとに正しい側のイベントを取り出す。 */

function currentAsMatchRecord(){
  if (state.rallyLog.length===0) return null;
  return { id:'current', date:new Date().toISOString(), tournamentName:state.tournamentName,
    homeTeamName:state.homeTeamName, awayTeamName:state.awayTeamName, setScores:state.setScores,
    rallyLog:state.rallyLog, matchFormat:state.matchFormat,
    homeStartingLineup: state.homeStartingLineup||[], awayStartingLineup: state.awayStartingLineup||[],
    substitutedPlayerIds: state.substitutedPlayerIds||[] };
}

/// 指定したチーム名が関わった試合だけを返す（進行中の試合＋過去の試合）
/// 表記ゆれ対策：チーム名にエイリアスが設定されていれば、統合先の名前に変換する
function resolveTeamName(name){
  return (state.teamNameAliases && state.teamNameAliases[name]) || name;
}

function matchesInvolvingTeamName(teamName){
  const list = [];
  const current = currentAsMatchRecord();
  if (current && (resolveTeamName(current.homeTeamName)===teamName || resolveTeamName(current.awayTeamName)===teamName)) list.push(current);
  state.matchHistory.forEach(m=>{ if (resolveTeamName(m.homeTeamName)===teamName || resolveTeamName(m.awayTeamName)===teamName) list.push(m); });
  return list;
}
/// その試合の中で、指定したチーム名（表記ゆれ統合後）がhome/awayどちら側だったか
function sideForTeamInMatch(match, teamName){
  if (resolveTeamName(match.homeTeamName)===teamName) return 'home';
  if (resolveTeamName(match.awayTeamName)===teamName) return 'away';
  return null;
}
function eventsForTeamNameByMatch(teamName){
  return matchesInvolvingTeamName(teamName).map(m=>{
    const side = sideForTeamInMatch(m, teamName);
    return side ? m.rallyLog.filter(e=>e.team===side) : [];
  });
}
function careerDetailedStatsForTeamName(teamName){
  return detailedStatsForAllPlayersFromMatches(eventsForTeamNameByMatch(teamName));
}
/// 指定チーム名の全試合をまたいだ失点の内訳（team名ではなくhome/away側の判定が必要なため専用に集計する）
function careerLossOfPointBreakdownForTeamName(teamName){
  const lossEvents = [];
  matchesInvolvingTeamName(teamName).forEach(m=>{
    const side = sideForTeamInMatch(m, teamName);
    if (!side) return;
    m.rallyLog.forEach(e=>{ if (e.playType==='lossOfPoint' && e.team===side) lossEvents.push(e); });
  });
  return lossOfPointBreakdownFromEvents(lossEvents);
}
function allPlayerNamesForTeamName(teamName){
  const names = new Set();
  eventsForTeamNameByMatch(teamName).forEach(evts=>evts.forEach(e=>names.add(e.playerName)));
  return [...names].sort((a,b)=>a.localeCompare(b,'ja'));
}
function totalRecordedMatchCountForTeamName(teamName){
  return matchesInvolvingTeamName(teamName).length;
}
/// 指定したチーム名が「相手のミス」で得た得点の通算
function careerOpponentErrorsForTeamName(teamName){
  let total = 0;
  matchesInvolvingTeamName(teamName).forEach(m=>{
    const side = sideForTeamInMatch(m, teamName);
    if (!side) return;
    const oppSide = side==='home' ? 'away' : 'home';
    if (m.id==='current'){
      total += state.trackOpponentStats
        ? state.rallyLog.filter(e=>e.team===oppSide && e.outcome==='opponent').length
        : (side==='home' ? state.opponentMistakePoints : 0);
    } else {
      total += side==='home'
        ? (m.homeOpponentErrors||0)
        : m.rallyLog.filter(e=>e.team===oppSide && e.outcome==='opponent').length;
    }
  });
  return total;
}
function allUsedCombosForTeamName(teamName){
  const flat = eventsForTeamNameByMatch(teamName).flat();
  return [...new Set(flat.filter(e=>e.playType==='attack').map(e=>e.combo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function allUsedOpponentServeTypesForTeamName(teamName){
  const flat = eventsForTeamNameByMatch(teamName).flat();
  return [...new Set(flat.filter(e=>e.playType==='serveReceive').map(e=>e.opponentServeType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
function allUsedOpponentAttackTypesForTeamName(teamName){
  const flat = eventsForTeamNameByMatch(teamName).flat();
  return [...new Set(flat.filter(e=>e.playType==='receive').map(e=>e.opponentAttackType).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
}
/// これまでに登場したことのある全チーム名（記録画面のチーム選択用）
function allKnownTeamNamesForRecords(){
  const names = new Set();
  state.knownTeamNames.forEach(n=>names.add(resolveTeamName(n)));
  state.matchHistory.forEach(m=>{ names.add(resolveTeamName(m.homeTeamName)); names.add(resolveTeamName(m.awayTeamName)); });
  const current = currentAsMatchRecord();
  if (current){ names.add(resolveTeamName(current.homeTeamName)); names.add(resolveTeamName(current.awayTeamName)); }
  return [...names].sort((a,b)=>a.localeCompare(b,'ja'));
}
/// 記録画面を開いたときのデフォルト選択（自チーム）
function defaultRecordsTeamName(){
  return resolveTeamName(state.myTeamName || state.homeTeamName);
}

/* ---- 選手別詳細成績のリストから、チーム全体の集計値を求める（通算タブ・単一試合タブ共通） ---- */

function aggregateFromPlayerList(list){
  const spike = list.reduce((s,p)=>({total:s.total+p.spikeOverall.total, decided:s.decided+p.spikeOverall.decided, miss:s.miss+p.spikeOverall.miss, blocked:s.blocked+p.spikeOverall.blocked}), {total:0,decided:0,miss:0,blocked:0});
  const serve = list.reduce((s,p)=>({total:s.total+p.serve.total, decided:s.decided+p.serve.decided, effective:s.effective+p.serve.effective, miss:s.miss+p.serve.miss}), {total:0,decided:0,effective:0,miss:0});
  const rec = list.reduce((s,p)=>({total:s.total+p.serveReceiveOverall.total, aPass:s.aPass+p.serveReceiveOverall.aPass, miss:s.miss+p.serveReceiveOverall.miss}), {total:0,aPass:0,miss:0});
  const totalBlocks = list.reduce((s,p)=>s+p.block.decided, 0);
  return {
    spikeRate: spike.total>0 ? spike.decided/spike.total*100 : null,
    serveRate: serve.total>0 ? (serve.decided*100+serve.effective*25-serve.miss*25)/serve.total : null,
    catchRate: rec.total>0 ? rec.aPass/rec.total*100 : null,
    totalBlocks,
    serveMiss: serve.miss, spikeMiss: spike.miss, spikeBlocked: spike.blocked, catchMiss: rec.miss,
  };
}

/* ---- 単一試合の詳細成績（これまでの記録：試合ごとタブのドリルダウン用） ---- */

function matchHomeEvents(match, team){ return match.rallyLog.filter(e=>e.team===team); }
function matchDetailedStatsForAllPlayers(match, team){
  const results = detailedStatsForAllPlayersFromMatches([matchHomeEvents(match, team)]);
  const startingLineup = team==='home' ? match.homeStartingLineup : match.awayStartingLineup;
  results.forEach(r=>{
    r.participationType = participationLabel(startingLineup, match.substitutedPlayerIds, r.player.id);
  });
  // プレーを一つも記録していない選手でも、スタメンだった場合は0件のまま一覧に加える
  const existingIds = new Set(results.map(r=>r.player.id).filter(Boolean));
  (startingLineup||[]).forEach(entry=>{
    if (!entry.playerId || existingIds.has(entry.playerId)) return;
    const p = findPlayer(entry.playerId, team);
    const placeholder = computeDetailedStats([], 0, p || {id:entry.playerId, number:0, name:'(不明)'});
    placeholder.participationType = entry.position;
    results.push(placeholder);
    existingIds.add(entry.playerId);
  });
  return results.sort((a,b)=>a.player.number-b.player.number);
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