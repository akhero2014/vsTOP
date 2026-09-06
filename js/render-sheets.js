/* render-sheets.js — モーダルシートの描画：設定・メニュー・スタッツ・これまでの記録
   （試合ごと/チーム/個人/ランキング/CSV、チーム選択・試合ドリルダウン対応）・
   ゲーム準備（チーム名編集・選手登録の重複防止）・メンバーチェンジ・選手名の統合編集
   すべてprompt()/confirm()/alert()に頼らず、画面内蔵のUIで完結するようにしてある。
   vsTOP アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderActiveSheet(){
  switch(state.activeSheet){
    case 'settings': return renderSettingsSheet();
    case 'menu': return renderMenuSheet();
    case 'stats': return renderStatsSheet();
    case 'records': return renderRecordsSheet();
    case 'gamePrep': return renderGamePrepSheet();
    case 'substitution': return renderSubstitutionSheet();
    case 'backup': return renderBackupSheet();
    default: return '';
  }
}
function sheetShell(title, bodyHtml, widthStyle){
  return `
  <div class="overlay" onclick="if(event.target===this) closeSheet();">
    <div class="sheet" ${widthStyle?`style="${widthStyle}"`:''}>
      <div class="sheet-header"><h2>${esc(title)}</h2><button class="sheet-close" onclick="closeSheet()">閉じる</button></div>
      <div class="sheet-body">${bodyHtml}</div>
    </div>
  </div>`;
}
function toggleRow(label, field){
  return `
  <div class="toggle-row">
    <span>${esc(label)}</span>
    <div class="switch ${state[field]?'on':''}" onclick="state.${field}=!state.${field}; render();"></div>
  </div>`;
}

/* ==================== 設定 ==================== */

function renderSettingsSheet(){
  const body = `
    <h3>チーム名</h3>
    <label class="muted">自チーム名</label>
    <input class="field" value="${esc(state.homeTeamName)}" oninput="state.homeTeamName=this.value; save();" style="margin-bottom:10px;">
    <label class="muted">相手チーム名</label>
    <input class="field" value="${esc(state.awayTeamName)}" oninput="state.awayTeamName=this.value; save();">

    <h3 style="margin-top:18px;">入力設定</h3>
    ${toggleRow('コース選択を表示','showCourseSelector')}
    ${toggleRow('レシーブのタブを表示','showReceiveTab')}
    ${toggleRow('得点時に自動でローテーション','autoRotationEnabled')}
    ${toggleRow('結果をダブルタップして記録','doubleTapToRecordEnabled')}

    <h3 style="margin-top:18px;">カスタム項目</h3>
    ${renderOptionListSection('serveTypeOptions', 'サーブの種類')}
    ${renderOptionListSection('attackComboOptions', 'スパイクのコンビネーション')}
  `;
  return sheetShell('設定', body, 'max-width:600px;');
}

/// promptを使わず、その場で開閉するインライン編集リスト（サーブの種類・コンビネーション用）
function renderOptionListSection(field, title){
  const isOpen = state.editingOptionList===field;
  const items = state[field];
  let html = `
    <div class="row" style="justify-content:space-between;margin-bottom:6px;">
      <strong>${esc(title)}</strong>
      <button class="btn small" onclick="state.editingOptionList=${isOpen?'null':`'${field}'`}; state.newNameDraft=''; render();">
        ${isOpen?'閉じる':'編集'}
      </button>
    </div>`;
  if (isOpen){
    html += `<div class="card" style="margin-bottom:14px;">`;
    html += items.map((item,i)=>`
      <div class="list-item">
        <span class="grow-text">${esc(item)}</span>
        <button class="btn small danger" onclick="removeOptionListItem('${field}', ${i})">削除</button>
      </div>`).join('') || '<p class="muted">まだ登録されていません</p>';
    html += `
      <div class="inline-add" style="margin-top:8px;">
        <input class="field grow" placeholder="新しい項目を入力" value="${esc(state.newNameDraft||'')}"
          oninput="state.newNameDraft=this.value" onkeydown="if(event.key==='Enter'){addOptionListItem('${field}');}">
        <button class="btn primary" onclick="addOptionListItem('${field}')">追加</button>
      </div>`;
    html += `</div>`;
  }
  return html;
}
function addOptionListItem(field){
  const v = (state.newNameDraft||'').trim();
  if (!v){ showToast('項目名を入力してください'); return; }
  if (state[field].includes(v)){ showToast('すでに登録されています'); return; }
  state[field].push(v);
  state.newNameDraft='';
  render();
}
function removeOptionListItem(field, index){
  state[field].splice(index,1);
  render();
}

/* ==================== データのバックアップ（ホーム画面から） ==================== */

function renderBackupSheet(){
  const current = totalEventFingerprint();
  const hasUnsavedData = state.lastBackupFingerprint===undefined || current > state.lastBackupFingerprint;
  const lastText = state.lastBackupAt ? new Date(state.lastBackupAt).toLocaleString('ja-JP') : 'まだバックアップしていません';
  const body = `
    <p>最終バックアップ：<strong>${esc(lastText)}</strong></p>
    ${hasUnsavedData
      ? '<p class="warn-text">⚠️ 前回のバックアップ以降に新しい記録があります。バックアップをおすすめします。</p>'
      : '<p class="muted">最新の状態までバックアップ済みです。</p>'}
    <button class="btn primary" style="width:100%;margin:14px 0 8px;" onclick="exportAllDataAsJSON()">⬇️ 全データをJSONで書き出す</button>
    <button class="btn" style="width:100%;" onclick="triggerImportJSON()">⬆️ JSONファイルから復元する</button>
    <p class="muted" style="margin-top:10px;">復元すると、現在の端末のデータは選択したJSONファイルの内容で上書きされます。他の端末へ移す場合は、書き出したJSONファイルをその端末に転送してから復元してください。</p>
  `;
  return sheetShell('データのバックアップ', body, 'max-width:500px;');
}

/* ==================== メニュー ==================== */

function renderMenuSheet(){
  const body = `
    <button class="btn" style="width:100%;margin-bottom:8px;" onclick="pauseAndReturnHome()">🏠 ホームに戻る（一時停止）</button>
    <p class="muted" style="margin-bottom:16px;">記録はそのまま保持され、ホーム画面の「試合を再開する」から続きを記録できます。</p>

    <div class="row" style="margin-bottom:8px;">${confirmButtonHtml('newGame','🔄 新規ゲームを開始','resetForNewGame();')}</div>
    <div class="row" style="margin-bottom:18px;">${confirmButtonHtml('endGame','🏁 このゲームを終了する','endCurrentGame();')}</div>

    <h3>セット数の手動修正</h3>
    <div class="row" style="justify-content:space-between;margin:8px 0;">
      <span>${esc(state.homeTeamName)}</span>
      <div class="row gap8"><button onclick="adjustSetsWon('home',-1)">➖</button><strong>${state.homeSetsWon}</strong><button onclick="adjustSetsWon('home',1)">➕</button></div>
    </div>
    <div class="row" style="justify-content:space-between;margin-bottom:16px;">
      <span>${esc(state.awayTeamName)}</span>
      <div class="row gap8"><button onclick="adjustSetsWon('away',-1)">➖</button><strong>${state.awaySetsWon}</strong><button onclick="adjustSetsWon('away',1)">➕</button></div>
    </div>

    <h3>オプション機能</h3>
    ${toggleRow('相手チームのスタッツを記録する','trackOpponentStats')}
  `;
  return sheetShell('メニュー', body);
}

/* ==================== 今の試合のスタッツ（チーム＋選手） ==================== */

function statsRowsHtml(rows){
  window.__statsRowsCache = rows;
  return `
  <div class="stats-scroll">
    <table class="stats-table">
      <thead><tr><th>#</th><th class="name-cell">選手名</th><th>出場セット数</th><th>スパイク本数</th><th>スパイク決定率</th>
        <th>サーブ本数</th><th>サーブ効果率</th><th>キャッチ本数</th><th>キャッチAパス率</th><th>ブロック本数</th></tr></thead>
      <tbody>
        ${rows.map((r,i)=>`<tr style="cursor:pointer;" onclick="openPlayerDetail(window.__statsRowsCache[${i}])">
          <td>${r.player.number}</td><td class="name-cell">${esc(r.player.name)}</td><td>${r.setsParticipated}</td>
          <td>${r.spikeOverall.total}</td><td>${pct(r.spikeOverall.decisionRate)}</td>
          <td>${r.serve.total}</td><td>${pct(r.serve.effectiveRate)}</td>
          <td>${r.serveReceiveOverall.total}</td><td>${pct(r.serveReceiveOverall.aPassRate)}</td>
          <td>${r.block.decided}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ==================== 選手の詳細成績（全項目）ドリルダウン ==================== */

function openPlayerDetail(statsObj){ state.viewingPlayerDetail = statsObj; render(); }
function closePlayerDetail(){ state.viewingPlayerDetail = null; render(); }

function statLine(label, value){
  return `<div class="row" style="justify-content:space-between;"><span class="muted" style="font-size:12px;">${esc(label)}</span><strong style="font-size:14px;">${esc(value)}</strong></div>`;
}
function statCard(innerHtml){
  return `<div class="card" style="margin-bottom:8px;">${innerHtml}</div>`;
}
function sectionHeadingHtml(text){
  return `<h3 style="margin:14px 0 6px;">${esc(text)}</h3>`;
}
function spikeRowHtml(row){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('決定本数', row.decided)}
    ${statLine('ミス数', row.miss)}
    ${statLine('決定率', pct(row.decisionRate))}
  `);
}
function receiveRowHtml(row){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('Aパス', row.aPass)}
    ${statLine('Bパス', row.bPass)}
    ${statLine('Cパス', row.cPass)}
    ${statLine('Aパス率', pct(row.aPassRate))}
  `);
}

function renderPlayerDetailOverlay(){
  const s = state.viewingPlayerDetail;
  if (!s) return '';
  let body = `<p class="muted">出場セット数：${s.setsParticipated}</p>`;

  if (s.spikeOverall.total>0){
    body += sectionHeadingHtml('スパイク');
    body += spikeRowHtml(s.spikeOverall);
    if (s.spikeByCombo.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">コンビ別</div>`;
      s.spikeByCombo.forEach(c=>{ body += spikeRowHtml(c); });
    }
  }
  if (s.serve.total>0){
    body += sectionHeadingHtml('サーブ');
    body += statCard(`
      ${statLine('総数', s.serve.total)}
      ${statLine('決定本数', s.serve.decided)}
      ${statLine('効果本数', s.serve.effective)}
      ${statLine('ミス数', s.serve.miss)}
      ${statLine('効果率', pct(s.serve.effectiveRate))}
    `);
  }
  if (s.toss.total>0){
    body += sectionHeadingHtml('トス');
    body += statCard(`
      ${statLine('トス本数', s.toss.total)}
      ${statLine('成功数', s.toss.success)}
      ${statLine('失敗数', s.toss.failure)}
      ${statLine('ミス数', s.toss.miss)}
      ${statLine('成功率', pct(s.toss.successRate))}
    `);
  }
  if (s.serveReceiveOverall.total>0){
    body += sectionHeadingHtml('キャッチ');
    body += receiveRowHtml(s.serveReceiveOverall);
    if (s.serveReceiveByType.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">相手サーブ種類別</div>`;
      s.serveReceiveByType.forEach(t=>{ body += receiveRowHtml(t); });
    }
  }
  if (s.receiveOverall.total>0){
    body += sectionHeadingHtml('レシーブ');
    body += receiveRowHtml(s.receiveOverall);
    if (s.receiveByType.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">相手攻撃種類別</div>`;
      s.receiveByType.forEach(t=>{ body += receiveRowHtml(t); });
    }
  }
  if (s.block.decided>0 || s.block.setsPlayed>0){
    body += sectionHeadingHtml('ブロック');
    body += statCard(`
      ${statLine('決定本数', s.block.decided)}
      ${statLine('セットあたりのブロック数', num(s.block.perSet,2))}
    `);
  }
  if (s.spikeOverall.total===0 && s.serve.total===0 && s.toss.total===0 && s.serveReceiveOverall.total===0 && s.receiveOverall.total===0 && s.block.decided===0){
    body += '<p class="muted">まだ記録がありません</p>';
  }

  return `
  <div class="overlay" style="z-index:200;" onclick="if(event.target===this) closePlayerDetail();">
    <div class="sheet" style="max-width:520px;">
      <div class="sheet-header"><h2>${esc(s.player.name)}</h2><button class="sheet-close" onclick="closePlayerDetail()">閉じる</button></div>
      <div class="sheet-body">${body}</div>
    </div>
  </div>`;
}
function teamAggregateRowsHtml(agg, opponentErrors){
  return `
  <div class="col gap8" style="margin-bottom:16px;">
    <div class="row" style="justify-content:space-between;"><span class="muted">スパイク決定率</span><strong>${pct(agg.spikeRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">サーブ効果率</span><strong>${pct(agg.serveRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチAパス率</span><strong>${pct(agg.catchRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">ブロック</span><strong>${agg.totalBlocks}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">相手ミスによる得点</span><strong>${opponentErrors}</strong></div>
  </div>`;
}

function renderStatsSheet(){
  const team = state.trackOpponentStats ? (state.statsTeam || 'home') : 'home';
  const rows = playerDetailedStatsList(team);
  const agg = aggregateFromPlayerList(rows);
  const opponentErrors = team==='home' ? (state.trackOpponentStats?opponentErrorsBenefiting('home'):state.opponentMistakePoints)
                                        : state.rallyLog.filter(e=>e.team==='home'&&e.outcome==='opponent').length;
  const body = `
    <div class="row gap8" style="margin-bottom:12px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.statsTeam='home'; render();">${esc(state.homeTeamName)}</button>
      ${state.trackOpponentStats ? `<button class="btn ${team==='away'?'primary':''}" onclick="state.statsTeam='away'; render();">${esc(state.awayTeamName)}</button>` : ''}
      <span class="grow"></span>
      <button class="btn small" onclick="simpleStatsCSV(playerDetailedStatsList('${team}'), '選手別スタッツ')">⬆️ CSV</button>
    </div>
    <h3>チームスタッツ</h3>
    ${teamAggregateRowsHtml(agg, opponentErrors)}
    <h3>選手別スタッツ</h3>
    ${rows.length ? statsRowsHtml(rows) : '<p class="muted">まだ記録がありません</p>'}
  `;
  return sheetShell('スタッツ（今の試合）', body, 'max-width:900px;');
}

/* ==================== これまでの記録（チーム「名前」で対象を選ぶ。デフォルトは自チーム） ==================== */

function recordsTeamSwitcherHtml(){
  if (!state.recordsTeamName) state.recordsTeamName = defaultRecordsTeamName();
  const names = allKnownTeamNamesForRecords();
  return `
  <div class="row gap8" style="margin-bottom:12px;align-items:center;">
    <span class="muted">チーム：</span>
    <select class="field" style="max-width:260px;" onchange="state.recordsTeamName=this.value; state.selectedMatchForDetail=null; state.csvSelectedMatchIds=[]; render();">
      ${names.map(n=>`<option value="${esc(n)}" ${n===state.recordsTeamName?'selected':''}>${esc(n)}</option>`).join('')}
    </select>
  </div>`;
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
      <button class="${tab==='csv'?'active':''}" onclick="state.recordsTab='csv'; render();">CSV出力</button>
    </div>`;

  if (tab==='matches') body += renderMatchesTab(teamName);
  else if (tab==='team') body += renderTeamCareerTab(teamName);
  else if (tab==='players') body += renderPlayersCareerTab(teamName);
  else if (tab==='rankings') body += renderRankingsBody(teamName);
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

function renderMatchesTab(teamName){
  if (state.selectedMatchForDetail) return renderMatchDetail(teamName);

  const matches = matchesInvolvingTeamName(teamName);
  const hasCurrent = matches.some(m=>m.id==='current');
  const pastMatches = matches.filter(m=>m.id!=='current');

  let html = '';
  if (hasCurrent){
    html += `<h3 style="margin-bottom:6px;">進行中の試合</h3>`;
    html += matchRowHtml(currentAsMatchRecord(), false);
  }
  html += `<h3 style="margin:14px 0 6px;">過去の試合</h3>`;
  if (pastMatches.length===0){
    html += `<p class="muted">「${esc(teamName)}」が関わった過去の試合記録がありません</p>`;
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
  const errors = careerOpponentErrorsForTeamName(teamName);
  return `
    <h3>${esc(teamName)}　通算${totalRecordedMatchCountForTeamName(teamName)}試合</h3>
    ${teamAggregateRowsHtml(agg, errors)}
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

function renderCsvTab(teamName){
  const matches = matchesInvolvingTeamName(teamName);
  if (!state.csvSelectedMatchIds) state.csvSelectedMatchIds = [];
  let html = `<p class="muted">「${esc(teamName)}」が関わった試合のみ表示しています。出力する試合を選んでください（複数選択可）。選手ごとに1つのCSVファイルが作成されます。</p>`;
  html += matches.map(m=>{
    const label = m.id==='current'
      ? '進行中：'+m.homeTeamName+' vs '+m.awayTeamName
      : new Date(m.date).toLocaleDateString('ja-JP')+' '+m.homeTeamName+' vs '+m.awayTeamName;
    const checked = state.csvSelectedMatchIds.includes(m.id);
    return `
    <label class="row gap8" style="padding:8px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleCsvMatchSelection('${m.id}')"> ${esc(label)}
    </label>`;
  }).join('') || '<p class="muted">まだ試合記録がありません</p>';
  html += `<button class="btn primary" style="width:100%;margin-top:14px;" onclick="runCsvExport('${teamName.replace(/'/g,"\\'")}')">📤 選手ごとのCSVを書き出す</button>`;
  html += `<p class="muted" style="margin-top:8px;">選手が複数いる場合は1つのZIPファイルにまとめて書き出します（保存の確実性を優先しています。ファイルを開くには展開/解凍してください）。iPad/iPhoneでは共有シートから「ファイルに保存」を選べます。</p>`;
  html += `<button class="btn" style="width:100%;margin-top:8px;" onclick="runCsvExportDownloadOnly('${teamName.replace(/'/g,"\\'")}')">常にダウンロードする（共有シートを使わない）</button>`;
  return html;
}
function toggleCsvMatchSelection(id){
  if (!state.csvSelectedMatchIds) state.csvSelectedMatchIds = [];
  const idx = state.csvSelectedMatchIds.indexOf(id);
  if (idx>=0) state.csvSelectedMatchIds.splice(idx,1);
  else state.csvSelectedMatchIds.push(id);
  render();
}
function runCsvExport(teamName){
  const ids = state.csvSelectedMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  exportDetailedCSVSmart(ids, teamName);
}
function runCsvExportDownloadOnly(teamName){
  const ids = state.csvSelectedMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  exportDetailedCSV(ids, teamName);
}

/* ==================== ランキング ==================== */

function rankingRow(name, primaryValue, primaryText, detail){ return {name, primaryValue, primaryText, detail}; }

function renderRankingList(rows, metricLabel){
  const sorted = rows.slice().sort((a,b)=>(b.primaryValue===null?-1:b.primaryValue)-(a.primaryValue===null?-1:a.primaryValue));
  if (sorted.length===0) return '<p class="muted">まだ記録がありません</p>';
  return sorted.map((r,i)=>`
    <div class="row" style="justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--line);">
      <div class="row gap10">
        <strong style="width:24px;color:${i===0?'#f59e0b':'#6b7280'}">${i+1}</strong>
        <div class="col">
          <span style="font-weight:600;">${esc(r.name)}</span>
          <span class="muted" style="font-size:11px;">${esc(r.detail)}</span>
        </div>
      </div>
      <div class="col" style="align-items:flex-end;">
        <strong>${esc(r.primaryText)}</strong>
        <span class="muted" style="font-size:11px;">${esc(metricLabel)}</span>
      </div>
    </div>`).join('');
}
function scopePickerHtml(field, options){
  return `
  <select class="field" style="max-width:220px;margin-bottom:10px;" onchange="state.${field}=this.value; render();">
    ${options.map(o=>`<option value="${esc(o)}" ${state[field]===o?'selected':''}>${esc(o)}</option>`).join('')}
  </select>`;
}

/// 通算ランキング（自チーム/相手チーム、これまでの全試合を対象）
function renderRankingsBody(teamName){
  const all = careerDetailedStatsForTeamName(teamName);
  return renderRankingsBodyForList(all, allUsedCombosForTeamName(teamName), allUsedOpponentServeTypesForTeamName(teamName), allUsedOpponentAttackTypesForTeamName(teamName));
}

/// 通算/単一試合どちらでも使える、ランキング本体のレンダリング。
/// スコープの選択肢自体を引数で渡すため、通算・試合どちらでも同じ状態キーを使い回せる。

function renderRankingsBodyForList(all, combosScope, serveTypesScope, attackTypesScope){
  const rt = state.rankingsTab || 'spike';
  const tabs = [['spike','スパイク'],['serve','サーブ'],['catch','キャッチ'],['receive','レシーブ'],['toss','トス'],['block','ブロック']];
  let html = `<div class="tabbar" style="margin-bottom:12px;">
    ${tabs.map(([k,label])=>`<button class="${rt===k?'active':''}" onclick="state.rankingsTab='${k}'; render();">${label}</button>`).join('')}
  </div>`;

  if (rt==='spike'){
    if (!state.spikeScope) state.spikeScope='総合';
    const scopes = ['総合', ...combosScope];
    html += scopePickerHtml('spikeScope', scopes);
    const rows = all.map(s=>{
      const target = state.spikeScope==='総合' ? s.spikeOverall : s.spikeByCombo.find(c=>c.name===state.spikeScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.decisionRate, pct(target.decisionRate), `総数${target.total}　決定${target.decided}　ミス${target.miss}`);
    }).filter(Boolean);
    html += renderRankingList(rows, '決定率');
  } else if (rt==='serve'){
    const rows = all.filter(s=>s.serve.total>0).map(s=>
      rankingRow(s.player.name, s.serve.effectiveRate, pct(s.serve.effectiveRate), `総数${s.serve.total}　決定${s.serve.decided}　効果${s.serve.effective}　ミス${s.serve.miss}`));
    html += renderRankingList(rows, '効果率');
  } else if (rt==='catch'){
    if (!state.catchScope) state.catchScope='総合';
    const scopes = ['総合', ...serveTypesScope];
    html += scopePickerHtml('catchScope', scopes);
    const rows = all.map(s=>{
      const target = state.catchScope==='総合' ? s.serveReceiveOverall : s.serveReceiveByType.find(c=>c.name===state.catchScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.aPassRate, pct(target.aPassRate), `総数${target.total}　A${target.aPass}　B${target.bPass}　C${target.cPass}`);
    }).filter(Boolean);
    html += renderRankingList(rows, 'Aパス率');
  } else if (rt==='receive'){
    if (!state.receiveScope) state.receiveScope='総合';
    const scopes = ['総合', ...attackTypesScope];
    html += scopePickerHtml('receiveScope', scopes);
    const rows = all.map(s=>{
      const target = state.receiveScope==='総合' ? s.receiveOverall : s.receiveByType.find(c=>c.name===state.receiveScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.aPassRate, pct(target.aPassRate), `総数${target.total}　A${target.aPass}　B${target.bPass}　C${target.cPass}`);
    }).filter(Boolean);
    html += renderRankingList(rows, 'Aパス率');
  } else if (rt==='toss'){
    const rows = all.filter(s=>s.toss.total>0).map(s=>
      rankingRow(s.player.name, s.toss.successRate, pct(s.toss.successRate), `本数${s.toss.total}　成功${s.toss.success}　失敗${s.toss.failure}　ミス${s.toss.miss}`));
    html += renderRankingList(rows, '成功率');
  } else if (rt==='block'){
    const rows = all.filter(s=>s.block.decided>0).map(s=>
      rankingRow(s.player.name, s.block.perSet, num(s.block.perSet,2), `決定本数${s.block.decided}　出場セット${s.block.setsPlayed}`));
    html += renderRankingList(rows, 'セットあたり');
  }
  return html;
}

/* ==================== ゲーム準備 ==================== */

function toggleMyTeam(name){ state.myTeamName = state.myTeamName===name ? null : name; render(); }

function startRenameTeam(name){ state.editingTeamName = name; state.teamNameDraft = name; render(); }
function cancelRenameTeam(){ state.editingTeamName = null; render(); }
function confirmRenameTeam(){
  const oldName = state.editingTeamName;
  const newName = (state.teamNameDraft||'').trim();
  if (!newName){ showToast('チーム名を入力してください'); return; }
  if (newName!==oldName){
    state.knownTeamNames = state.knownTeamNames.map(n=>n===oldName?newName:n);
    if (state.teamRosters[oldName]){ state.teamRosters[newName]=state.teamRosters[oldName]; delete state.teamRosters[oldName]; }
    if (state.myTeamName===oldName) state.myTeamName = newName;
    if (state.homeTeamName===oldName) state.homeTeamName = newName;
    if (state.awayTeamName===oldName) state.awayTeamName = newName;
  }
  state.editingTeamName = null;
  render();
}

function startAddTeamInPrep(){ state.gamePrepAddingTeam = true; state.newNameDraft=''; render(); }
function cancelAddTeamInPrep(){ state.gamePrepAddingTeam = false; render(); }
function confirmAddTeamInPrep(){
  const name = (state.newNameDraft||'').trim();
  if (!name){ showToast('チーム名を入力してください'); return; }
  registerTeamName(name);
  state.gamePrepAddingTeam = false;
  render();
}

function deleteTeamNameConfirmed(name){
  state.knownTeamNames = state.knownTeamNames.filter(n=>n!==name);
  delete state.teamRosters[name];
  if (state.myTeamName===name) state.myTeamName = null;
  render();
}

function toggleRosterEditor(name){
  state.gamePrepExpandedTeam = state.gamePrepExpandedTeam===name ? null : name;
  render();
}
function addRosterPlayer(teamName){
  const roster = state.teamRosters[teamName] || (state.teamRosters[teamName]=[]);
  const used = new Set(roster.map(p=>p.number));
  let n=1; while(used.has(n)) n++;
  roster.push({id:uid(), number:n, name:'新しい選手', position:'OH'});
  render();
}
function updateRosterPlayerName(teamName, id, value){
  const p = (state.teamRosters[teamName]||[]).find(p=>p.id===id);
  if (p){ p.name = value; save(); }
}
function updateRosterPlayerPosition(teamName, id, value){
  const p = (state.teamRosters[teamName]||[]).find(p=>p.id===id);
  if (p){ p.position = value; render(); }
}
/// 背番号は重複を許さない。onchange（入力し終えたタイミング）で検証し、
/// 重複していれば変更を取り消して警告を表示する。
function updateRosterPlayerNumber(teamName, id, value){
  const roster = state.teamRosters[teamName] || [];
  const p = roster.find(p=>p.id===id);
  if (!p) return;
  const newNumber = parseInt(value,10);
  if (!newNumber || newNumber<1){ showToast('背番号は1以上の数字で入力してください'); render(); return; }
  const duplicate = roster.some(other=>other.id!==id && other.number===newNumber);
  if (duplicate){ showToast('その背番号はすでに使われています'); render(); return; }
  p.number = newNumber;
  render();
}

function renderRosterEditor(teamName){
  const roster = state.teamRosters[teamName] || [];
  return `
  <div class="card" style="margin:8px 0;">
    ${roster.map(p=>`
      <div class="row gap8" style="margin-bottom:6px;">
        <input class="field" style="width:64px;" type="number" min="1" value="${p.number}"
          onchange="updateRosterPlayerNumber('${teamName}','${p.id}',this.value)">
        <input class="field grow" value="${esc(p.name)}"
          oninput="updateRosterPlayerName('${teamName}','${p.id}',this.value)">
        <select class="field" style="width:90px;" onchange="updateRosterPlayerPosition('${teamName}','${p.id}',this.value)">
          ${POSITIONS.map(pos=>`<option value="${pos}" ${p.position===pos?'selected':''}>${pos}</option>`).join('')}
        </select>
        ${confirmButtonHtml('delPlayer-'+p.id, '削除', "deleteRosterPlayer('"+teamName+"','"+p.id+"');", 'danger small')}
      </div>`).join('') || '<p class="muted">まだ選手が登録されていません</p>'}
    <button class="btn" style="width:100%;" onclick="addRosterPlayer('${teamName}')">＋ 選手を追加</button>
  </div>`;
}
function deleteRosterPlayer(teamName, id){
  state.teamRosters[teamName] = (state.teamRosters[teamName]||[]).filter(p=>p.id!==id);
  render();
}

function renderGamePrepSheet(){
  let body = `<h3>登録チーム</h3>`;
  body += orderedTeamNames().map(name=>{
    if (state.editingTeamName===name){
      return `
      <div class="card" style="margin-bottom:8px;">
        <div class="inline-add">
          <input class="field grow" value="${esc(state.teamNameDraft||'')}" oninput="state.teamNameDraft=this.value"
            onkeydown="if(event.key==='Enter'){confirmRenameTeam();}">
          <button class="btn primary" onclick="confirmRenameTeam()">保存</button>
          <button class="btn" onclick="cancelRenameTeam()">キャンセル</button>
        </div>
      </div>`;
    }
    return `
      <div class="card" style="margin-bottom:8px;">
        <div class="row gap8">
          <button onclick="toggleMyTeam('${name.replace(/'/g,"\\'")}')" title="自チームに設定">${state.myTeamName===name?'✅':'⚪️'}</button>
          <button class="grow" style="text-align:left;font-weight:600;" onclick="toggleRosterEditor('${name.replace(/'/g,"\\'")}')">
            ${esc(name)} <span class="muted">（選手${(state.teamRosters[name]||[]).length}人）</span>
            ${state.myTeamName===name?'<span style="color:var(--blue);"> 自チーム</span>':''}
          </button>
          <button class="btn small" onclick="startRenameTeam('${name.replace(/'/g,"\\'")}')">✏️</button>
          ${confirmButtonHtml('delTeam-'+name, '🗑️', "deleteTeamNameConfirmed('"+name.replace(/'/g,"\\'")+"');", 'danger small')}
        </div>
        ${state.gamePrepExpandedTeam===name ? renderRosterEditor(name) : ''}
      </div>`;
  }).join('');

  if (state.gamePrepAddingTeam){
    body += `
    <div class="card" style="margin-top:8px;">
      <div class="inline-add">
        <input class="field grow" placeholder="新しいチーム名" value="${esc(state.newNameDraft||'')}"
          oninput="state.newNameDraft=this.value" onkeydown="if(event.key==='Enter'){confirmAddTeamInPrep();}">
        <button class="btn primary" onclick="confirmAddTeamInPrep()">追加</button>
        <button class="btn" onclick="cancelAddTeamInPrep()">キャンセル</button>
      </div>
    </div>`;
  } else {
    body += `<button class="btn primary" style="width:100%;margin-top:8px;" onclick="startAddTeamInPrep()">＋ 新しいチームを登録</button>`;
  }

  body += `<p class="muted" style="margin-top:12px;">チーム名をタップすると選手名簿を編集できます。マークをタップすると自チームの設定を切り替えられます。自チームは試合開始のチーム名選択で常に一番上に表示されます。</p>`;
  return sheetShell('ゲーム準備', body, 'max-width:700px;');
}

/* ==================== メンバーチェンジ ==================== */

function renderSubstitutionSheet(){
  const team = state.subTeam || 'home';
  const front = team==='home' ? HOME_FRONT : AWAY_FRONT;
  const back = team==='home' ? HOME_BACK : AWAY_BACK;
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const players = currentPlayers(team);
  const bench = benchPlayers(team);
  const selIndex = state.subPositionIndex;

  const slot = (i)=>{
    const p = players.find(p=>p.id===rotation[i]);
    return `
      <button class="mini-slot ${p?'filled':''}" style="${selIndex===i?'outline:3px solid #facc15;':''}"
        onclick="state.subPositionIndex=${i}; render();">
        <div class="c">${p?p.number:'-'}</div>
        <div style="font-size:9px;">P${i+1}</div>
        <div style="font-size:10px;">${p?esc(p.name):'空き'}</div>
      </button>`;
  };

  const body = `
    <div class="row gap8" style="margin-bottom:12px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.subTeam='home'; state.subPositionIndex=null; render();">${esc(state.homeTeamName)}</button>
      <button class="btn ${team==='away'?'primary':''}" onclick="state.subTeam='away'; state.subPositionIndex=null; render();">${esc(state.awayTeamName)}</button>
    </div>
    <div class="mini-court">
      <div class="row gap8" style="margin-bottom:8px;">${front.map(slot).join('')}</div>
      <div class="row gap8">${back.map(slot).join('')}</div>
    </div>
    ${selIndex!==null && selIndex!==undefined ? `
      <h3 style="margin-top:16px;">交代で入る選手</h3>
      ${bench.length ? bench.map(p=>`
        <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;" onclick="substitute('${team}',${selIndex},'${p.id}'); state.subPositionIndex=null;">
          #${p.number} ${esc(p.name)} <span class="muted">${esc(p.position)}</span>
        </button>`).join('') : '<p class="muted">交代可能な選手（ベンチ）がいません</p>'}
    ` : ''}
  `;
  return sheetShell('メンバーチェンジ', body, 'max-width:500px;');
}