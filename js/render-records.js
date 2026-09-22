/* render-records.js — これまでの記録：試合ごと/チーム通算/個人通算タブ、
   チーム名・選手名の表記ゆれ統合
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

/* ==================== これまでの記録（チーム「名前」で対象を選ぶ。デフォルトは自チーム） ==================== */

function recordsTeamSwitcherHtml(){
  if (!state.recordsTeamName) state.recordsTeamName = defaultRecordsTeamName();
  const names = allKnownTeamNamesForRecords();
  let html = `
  <div class="row gap8" style="margin-bottom:8px;align-items:center;">
    <span class="muted">チーム：</span>
    <select class="field" style="max-width:260px;" onchange="state.recordsTeamName=this.value; state.selectedMatchForDetail=null; state.csvSelectedMatchIds=[]; render();">
      ${names.map(n=>`<option value="${esc(n)}" ${n===state.recordsTeamName?'selected':''}>${esc(n)}</option>`).join('')}
    </select>
    <button class="btn small" onclick="toggleTeamNameMerge()">${state.showingTeamNameMerge?'閉じる':'チーム名を編集'}</button>
  </div>`;
  if (state.showingTeamNameMerge){
    html += `<div class="card" style="margin-bottom:12px;">
      <p class="muted" style="margin-bottom:8px;">表記ゆれのあるチーム名（例：「広島東」と「広島東高校」）を1つにまとめて、通算成績を正しく集計できるようにします。</p>
      ${renderTeamNameMergeList()}
    </div>`;
  }
  return html;
}

/* ---- チーム名の統合・編集（表記ゆれ対策、promptは使わずインライン編集） ---- */

function toggleTeamNameMerge(){ state.showingTeamNameMerge = !state.showingTeamNameMerge; render(); }
function startEditTeamAlias(name){ state.editingTeamAliasFor = name; state.teamAliasDraft = state.teamNameAliases[name] || name; render(); }
function cancelEditTeamAlias(){ state.editingTeamAliasFor = null; render(); }
function confirmEditTeamAlias(){
  const name = state.editingTeamAliasFor;
  const trimmed = (state.teamAliasDraft||'').trim();
  if (!trimmed || trimmed===name) delete state.teamNameAliases[name];
  else state.teamNameAliases[name] = trimmed;
  state.editingTeamAliasFor = null;
  // 統合した結果、今選んでいるチーム名がもう存在しなくなる場合はデフォルトに戻す
  if (!allKnownTeamNamesForRecords().includes(state.recordsTeamName)) state.recordsTeamName = defaultRecordsTeamName();
  render();
}
function allRawTeamNames(){
  const names = new Set();
  state.knownTeamNames.forEach(n=>names.add(n));
  state.matchHistory.forEach(m=>{ names.add(m.homeTeamName); names.add(m.awayTeamName); });
  const current = currentAsMatchRecord();
  if (current){ names.add(current.homeTeamName); names.add(current.awayTeamName); }
  return [...names].sort((a,b)=>a.localeCompare(b,'ja'));
}
function renderTeamNameMergeList(){
  const names = allRawTeamNames();
  if (names.length===0) return '<p class="muted">まだチーム名がありません</p>';
  return names.map(n=>{
    if (state.editingTeamAliasFor===n){
      return `
      <div class="list-item">
        <input class="field grow-text" value="${esc(state.teamAliasDraft||'')}" oninput="state.teamAliasDraft=this.value"
          onkeydown="if(event.key==='Enter'){confirmEditTeamAlias();}">
        <button class="btn small primary" onclick="confirmEditTeamAlias()">保存</button>
        <button class="btn small" onclick="cancelEditTeamAlias()">取消</button>
      </div>`;
    }
    return `
    <div class="list-item">
      <span class="grow-text">${esc(n)}${state.teamNameAliases[n] ? ' → <strong style="color:var(--blue)">'+esc(state.teamNameAliases[n])+'</strong>' : ''}</span>
      <button class="btn small" onclick="startEditTeamAlias('${n.replace(/'/g,"\\'")}')">編集</button>
    </div>`;
  }).join('');
}

function renderRecordsSheet(){
  const tab = state.recordsTab || 'matches';
  if (!state.recordsTeamName) state.recordsTeamName = defaultRecordsTeamName();
  const teamName = state.recordsTeamName;
  let body = recordsTeamSwitcherHtml();
  body += `
    <div class="tabbar" style="margin-bottom:14px;">
      <button class="${tab==='matches'?'active':''}" onclick="state.recordsTab='matches'; state.selectedMatchForDetail=null; render();">試合ごと</button>
      <button class="${tab==='team'?'active':''}" onclick="state.recordsTab='team'; render();">チーム通算</button>
      <button class="${tab==='players'?'active':''}" onclick="state.recordsTab='players'; render();">個人通算</button>
      <button class="${tab==='rankings'?'active':''}" onclick="state.recordsTab='rankings'; render();">ランキング</button>
      <button class="${tab==='selected'?'active':''}" onclick="state.recordsTab='selected'; render();">選択集計</button>
      <button class="${tab==='csv'?'active':''}" onclick="state.recordsTab='csv'; render();">CSV出力</button>
    </div>`;

  if (tab==='matches') body += renderMatchesTab(teamName);
  else if (tab==='team') body += renderTeamCareerTab(teamName);
  else if (tab==='players') body += renderPlayersCareerTab(teamName);
  else if (tab==='rankings') body += renderRankingsBody(teamName);
  else if (tab==='selected') body += renderSelectedAggregateTab(teamName);
  else if (tab==='csv') body += renderCsvTab(teamName);

  return sheetShell('これまでの記録', body, 'max-width:900px;');
}

/* ---- 試合ごと（そのチーム名が関わった試合だけを表示。一覧＋ドリルダウン） ---- */

function findMatchById(id){
  if (id==='current') return currentAsMatchRecord();
  return state.matchHistory.find(m=>m.id===id) || null;
}
function selectMatchForDetail(id){ state.selectedMatchForDetail=id; state.matchDetailTab='team'; render(); }
function backToMatchList(){ state.selectedMatchForDetail=null; render(); }

/// 過去の試合の絞り込み：相手チームを複数選択できるようにする
function toggleMatchesOpponentFilter(name){
  if (!state.matchesOpponentFilterIds) state.matchesOpponentFilterIds = [];
  const idx = state.matchesOpponentFilterIds.indexOf(name);
  if (idx>=0) state.matchesOpponentFilterIds.splice(idx,1);
  else state.matchesOpponentFilterIds.push(name);
  render();
}

function renderMatchesTab(teamName){
  if (state.selectedMatchForDetail) return renderMatchDetail(teamName);

  const matches = matchesInvolvingTeamName(teamName);
  const hasCurrent = matches.some(m=>m.id==='current');
  let pastMatches = matches.filter(m=>m.id!=='current');

  // 実際に対戦したことがある相手チーム名の一覧（表記ゆれは統合済みの名前で）
  const opponentNameFor = (m) => resolveTeamName(m.homeTeamName)===teamName
    ? resolveTeamName(m.awayTeamName) : resolveTeamName(m.homeTeamName);
  const knownOpponents = [...new Set(matches.filter(m=>m.id!=='current').map(opponentNameFor))].sort((a,b)=>a.localeCompare(b,'ja'));

  const dateFrom = state.matchesDateFrom || '';
  const dateTo = state.matchesDateTo || '';
  const opponentFilterIds = state.matchesOpponentFilterIds || [];
  pastMatches = pastMatches.filter(m=>{
    const d = new Date(m.date).toISOString().slice(0,10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (opponentFilterIds.length && !opponentFilterIds.includes(opponentNameFor(m))) return false;
    return true;
  });

  let html = '';
  if (hasCurrent){
    html += `<h3 style="margin-bottom:6px;">進行中の試合</h3>`;
    html += matchRowHtml(currentAsMatchRecord(), false);
  }
  html += `<h3 style="margin:14px 0 6px;">過去の試合</h3>`;
  html += `
    <div class="row gap8" style="margin-bottom:8px;align-items:center;flex-wrap:wrap;">
      <span class="muted">期間：</span>
      <input type="date" class="field" value="${esc(dateFrom)}" onchange="state.matchesDateFrom=this.value; render();" style="max-width:150px;">
      <span class="muted">〜</span>
      <input type="date" class="field" value="${esc(dateTo)}" onchange="state.matchesDateTo=this.value; render();" style="max-width:150px;">
      ${(dateFrom||dateTo||opponentFilterIds.length) ? `<button class="btn small" onclick="state.matchesDateFrom=''; state.matchesDateTo=''; state.matchesOpponentFilterIds=[]; render();">絞り込みをクリア</button>` : ''}
    </div>
    <div class="muted" style="margin-bottom:4px;">相手チームで絞り込み（複数選択可）</div>
    <div class="choice-grid" style="margin-bottom:10px;">
      ${knownOpponents.length ? knownOpponents.map(name=>`
        <button class="choice-btn ${opponentFilterIds.includes(name)?'active':''}" onclick="toggleMatchesOpponentFilter('${esc(name).replace(/'/g,"\\'")}')">${esc(name)}</button>
      `).join('') : '<p class="muted">対戦したことのある相手チームがまだありません</p>'}
    </div>`;
  if (pastMatches.length===0){
    html += `<p class="muted">条件に一致する過去の試合記録がありません</p>`;
  } else {
    html += pastMatches.map(m=>matchRowHtml(m, true)).join('');
  }
  return html;
}
function matchRowHtml(match, deletable){
  const setSummary = match.setScores.map(s=>s.home+'-'+s.away).join(' / ');
  return `
  <div class="card" style="margin-bottom:8px;">
    <button style="width:100%;text-align:left;" onclick="selectMatchForDetail('${match.id}')">
      <div class="muted" style="font-size:12px;">${new Date(match.date).toLocaleString('ja-JP')}${match.tournamentName?'　'+esc(match.tournamentName):''}</div>
      <div>${esc(match.homeTeamName)}　${esc(setSummary)}　${esc(match.awayTeamName)}</div>
    </button>
    ${deletable ? `<div style="margin-top:6px;">${confirmButtonHtml('delMatch-'+match.id, '削除', "state.matchHistory=state.matchHistory.filter(x=>x.id!=='"+match.id+"'); render();")}</div>` : ''}
  </div>`;
}

function renderMatchDetail(teamName){
  const match = findMatchById(state.selectedMatchForDetail);
  if (!match){ state.selectedMatchForDetail=null; return renderMatchesTab(teamName); }
  const side = sideForTeamInMatch(match, teamName);
  if (!side){ state.selectedMatchForDetail=null; return renderMatchesTab(teamName); }
  const tab = state.matchDetailTab || 'team';
  const list = matchDetailedStatsForAllPlayers(match, side);

  let html = `<button class="btn small" style="margin-bottom:10px;" onclick="backToMatchList()">← 試合一覧に戻る</button>`;
  html += `<h3 style="margin-bottom:4px;">${esc(match.homeTeamName)} vs ${esc(match.awayTeamName)}</h3>`;
  html += `<p class="muted" style="margin-bottom:10px;">${new Date(match.date).toLocaleString('ja-JP')}　${match.setScores.map(s=>s.home+'-'+s.away).join(' / ')}</p>`;
  html += `<div class="tabbar" style="margin-bottom:12px;">
    <button class="${tab==='team'?'active':''}" onclick="state.matchDetailTab='team'; render();">チームスタッツ</button>
    <button class="${tab==='players'?'active':''}" onclick="state.matchDetailTab='players'; render();">個人スタッツ</button>
    <button class="${tab==='rankings'?'active':''}" onclick="state.matchDetailTab='rankings'; render();">ランキング</button>
  </div>`;

  if (tab==='team'){
    const agg = aggregateFromPlayerList(list);
    html += teamAggregateRowsHtml(agg, matchOpponentErrors(match, side));
    html += lossOfPointBreakdownHtml(lossOfPointBreakdownForTeamEvents(match.rallyLog, side));
  } else if (tab==='players'){
    html += list.length ? statsRowsHtml(list) : '<p class="muted">この試合の記録がありません</p>';
  } else if (tab==='rankings'){
    html += renderRankingsBodyForList(list, matchUsedCombos(match,side), matchUsedOpponentServeTypes(match,side), matchUsedOpponentAttackTypes(match,side));
  }
  return html;
}

/* ---- チーム通算 ---- */

function renderTeamCareerTab(teamName){
  const list = careerDetailedStatsForTeamName(teamName);
  const agg = aggregateFromPlayerList(list);
  return `
    <h3>${esc(teamName)}　通算${totalRecordedMatchCountForTeamName(teamName)}試合</h3>
    ${teamRatesOnlyHtml(agg)}
  `;
}

/* ---- 個人通算 ---- */

function renderPlayersCareerTab(teamName){
  const all = careerDetailedStatsForTeamName(teamName);
  const isMyTeam = teamName === (state.myTeamName || state.homeTeamName);
  let html = `<div class="row" style="justify-content:space-between;margin-bottom:8px;">`;
  html += isMyTeam
    ? `<button class="btn small" onclick="toggleNameMerge()">${state.showingNameMerge?'選手名の編集を閉じる':'選手名を編集'}</button>`
    : `<span></span>`;
  html += `<button class="btn small" onclick="simpleStatsCSV(careerDetailedStatsForTeamName('${teamName.replace(/'/g,"\\'")}'), '個人通算成績')">⬆️ CSV</button></div>`;

  if (isMyTeam && state.showingNameMerge){
    html += `<div class="card" style="margin-bottom:12px;">
      <p class="muted" style="margin-bottom:8px;">表記ゆれや同一選手の重複登録は、名前を編集して統合できます。</p>
      ${renderNameMergeList(teamName)}
    </div>`;
  }
  html += all.length ? statsRowsHtml(all) : '<p class="muted">まだ記録がありません</p>';
  return html;
}

/* ---- 選手名の統合・編集（自チームのみ、promptは使わずインライン編集） ---- */

function toggleNameMerge(){ state.showingNameMerge = !state.showingNameMerge; render(); }
function startEditAlias(name){ state.editingAliasFor = name; state.aliasDraft = state.playerNameAliases[name] || name; render(); }
function cancelEditAlias(){ state.editingAliasFor = null; render(); }
function confirmEditAlias(){
  const name = state.editingAliasFor;
  const trimmed = (state.aliasDraft||'').trim();
  if (!trimmed || trimmed===name) delete state.playerNameAliases[name];
  else state.playerNameAliases[name] = trimmed;
  state.editingAliasFor = null;
  render();
}
function renderNameMergeList(teamName){
  const names = allPlayerNamesForTeamName(teamName);
  if (names.length===0) return '<p class="muted">まだ記録がありません</p>';
  return names.map(n=>{
    if (state.editingAliasFor===n){
      return `
      <div class="list-item">
        <input class="field grow-text" value="${esc(state.aliasDraft||'')}" oninput="state.aliasDraft=this.value"
          onkeydown="if(event.key==='Enter'){confirmEditAlias();}">
        <button class="btn small primary" onclick="confirmEditAlias()">保存</button>
        <button class="btn small" onclick="cancelEditAlias()">取消</button>
      </div>`;
    }
    return `
    <div class="list-item">
      <span class="grow-text">${esc(n)}${state.playerNameAliases[n] ? ' → <strong style="color:var(--blue)">'+esc(state.playerNameAliases[n])+'</strong>' : ''}</span>
      <button class="btn small" onclick="startEditAlias('${n.replace(/'/g,"\\'")}')">編集</button>
    </div>`;
  }).join('');
}

/* ---- CSV出力（そのチーム名が関わった試合のみが対象） ---- */

/* ---- 選択集計：自由に選んだ試合だけで通算成績を見る（今日の試合だけ、など） ---- */