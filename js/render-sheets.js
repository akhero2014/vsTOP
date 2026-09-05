/* render-sheets.js — モーダルシートの描画：設定・メニュー・スタッツ・これまでの記録（試合/チーム/個人/ランキング/CSV）・ゲーム準備・メンバーチェンジ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderActiveSheet(){
  switch(state.activeSheet){
    case 'settings': return renderSettingsSheet();
    case 'menu': return renderMenuSheet();
    case 'stats': return renderStatsSheet();
    case 'records': return renderRecordsSheet();
    case 'gamePrep': return renderGamePrepSheet();
    case 'substitution': return renderSubstitutionSheet();
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

/* ---- 設定 ---- */

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
    <button class="btn" style="width:100%;margin-bottom:8px;" onclick="editOptionList('serveTypeOptions','サーブの種類')">サーブの種類を編集</button>
    <button class="btn" style="width:100%;" onclick="editOptionList('attackComboOptions','アタックのコンビネーション')">スパイクのコンビネーションを編集</button>
  `;
  return sheetShell('設定', body);
}

function editOptionList(field, title){
  const current = state[field].join(', ');
  const input = window.prompt(title+'をカンマ区切りで編集してください', current);
  if (input===null) return;
  state[field] = input.split(',').map(s=>s.trim()).filter(Boolean);
  render();
}

/* ---- メニュー ---- */

function renderMenuSheet(){
  const body = `
    <button class="btn" style="width:100%;margin-bottom:8px;" onclick="pauseAndReturnHome()">🏠 ホームに戻る（一時停止）</button>
    <p class="muted" style="margin-bottom:16px;">記録はそのまま保持され、ホーム画面の「試合を再開する」から続きを記録できます。</p>

    <button class="btn danger" style="width:100%;margin-bottom:8px;" onclick="if(confirm('新規ゲームを開始しますか？現在の記録は保存されます。')) resetForNewGame();">🔄 新規ゲームを開始</button>
    <button class="btn danger" style="width:100%;margin-bottom:18px;" onclick="endCurrentGame()">🏁 このゲームを終了する</button>

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

/* ---- 今の試合のスタッツ ---- */

function statsRowsHtml(rows){
  return `
  <div class="stats-scroll">
    <table class="stats-table">
      <thead><tr><th>#</th><th class="name-cell">選手名</th><th>出場セット数</th><th>スパイク本数</th><th>スパイク決定率</th>
        <th>サーブ本数</th><th>サーブ効果率</th><th>キャッチ本数</th><th>キャッチAパス率</th><th>ブロック本数</th></tr></thead>
      <tbody>
        ${rows.map(r=>`<tr>
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

function renderStatsSheet(){
  const team = state.statsTeam || 'home';
  const rows = playerDetailedStatsList(team);
  const body = `
    <div class="row gap8" style="margin-bottom:12px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.statsTeam='home'; render();">${esc(state.homeTeamName)}</button>
      <button class="btn ${team==='away'?'primary':''}" onclick="state.statsTeam='away'; render();">${esc(state.awayTeamName)}</button>
      <span class="grow"></span>
      <button class="btn small" onclick="simpleStatsCSV(playerDetailedStatsList('${team}'), '選手別スタッツ')">⬆️ CSV</button>
    </div>
    ${rows.length ? statsRowsHtml(rows) : '<p class="muted">まだ記録がありません</p>'}
  `;
  return sheetShell('選手別スタッツ（今の試合）', body, 'max-width:900px;');
}

/* ---- これまでの記録 ---- */

function renderRecordsSheet(){
  const tab = state.recordsTab || 'matches';
  let body = `
    <div class="tabbar" style="margin-bottom:14px;">
      <button class="${tab==='matches'?'active':''}" onclick="state.recordsTab='matches'; render();">試合ごと</button>
      <button class="${tab==='team'?'active':''}" onclick="state.recordsTab='team'; render();">チーム通算</button>
      <button class="${tab==='players'?'active':''}" onclick="state.recordsTab='players'; render();">個人通算</button>
      <button class="${tab==='rankings'?'active':''}" onclick="state.recordsTab='rankings'; render();">ランキング</button>
      <button class="${tab==='csv'?'active':''}" onclick="state.recordsTab='csv'; render();">CSV出力</button>
    </div>`;

  if (tab==='matches'){
    const cur = state.rallyLog.length ? [`<div class="history-row"><strong>進行中：${esc(state.homeTeamName)} vs ${esc(state.awayTeamName)}</strong></div>`] : [];
    const rows = state.matchHistory.map(m=>`
      <div class="history-row col" style="align-items:flex-start;">
        <div class="row" style="justify-content:space-between;width:100%;">
          <span class="muted">${new Date(m.date).toLocaleString('ja-JP')}</span>
          <button class="btn small danger" onclick="if(confirm('この試合記録を削除しますか？')){state.matchHistory=state.matchHistory.filter(x=>x.id!=='${m.id}'); render();}">削除</button>
        </div>
        <div>${esc(m.homeTeamName)} ${m.setScores.map(s=>s.home+'-'+s.away).join(' / ')} ${esc(m.awayTeamName)}</div>
      </div>`).join('');
    body += cur.join('') + (rows || '<p class="muted">まだ保存された試合記録がありません</p>');
  } else if (tab==='team'){
    const historicalErrors = state.matchHistory.reduce((s,m)=>s+m.homeOpponentErrors,0);
    const currentErrors = state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints;
    const all = careerDetailedStatsForAllPlayers();
    const totalSpike = all.reduce((s,p)=>({total:s.total+p.spikeOverall.total, decided:s.decided+p.spikeOverall.decided}), {total:0,decided:0});
    const totalServe = all.reduce((s,p)=>({total:s.total+p.serve.total, decided:s.decided+p.serve.decided, effective:s.effective+p.serve.effective, miss:s.miss+p.serve.miss}), {total:0,decided:0,effective:0,miss:0});
    const totalRec = all.reduce((s,p)=>({total:s.total+p.serveReceiveOverall.total, aPass:s.aPass+p.serveReceiveOverall.aPass}), {total:0,aPass:0});
    const totalBlock = all.reduce((s,p)=>s+p.block.decided, 0);
    const spikeRate = totalSpike.total>0 ? totalSpike.decided/totalSpike.total*100 : null;
    const serveRate = totalServe.total>0 ? (totalServe.decided*100+totalServe.effective*25-totalServe.miss*25)/totalServe.total : null;
    const catchRate = totalRec.total>0 ? totalRec.aPass/totalRec.total*100 : null;
    body += `
      <h3>${esc(state.homeTeamName)}　通算${totalRecordedMatchCount()}試合</h3>
      <div class="col gap8" style="margin-top:10px;">
        <div class="row" style="justify-content:space-between;"><span class="muted">スパイク決定率</span><strong>${pct(spikeRate)}</strong></div>
        <div class="row" style="justify-content:space-between;"><span class="muted">サーブ効果率</span><strong>${pct(serveRate)}</strong></div>
        <div class="row" style="justify-content:space-between;"><span class="muted">キャッチAパス率</span><strong>${pct(catchRate)}</strong></div>
        <div class="row" style="justify-content:space-between;"><span class="muted">ブロック</span><strong>${totalBlock}</strong></div>
        <div class="row" style="justify-content:space-between;"><span class="muted">相手ミスによる得点</span><strong>${historicalErrors+currentErrors}</strong></div>
      </div>`;
  } else if (tab==='players'){
    const all = careerDetailedStatsForAllPlayers();
    body += `<div class="row" style="justify-content:space-between;margin-bottom:8px;">
      <button class="btn small" onclick="toggleNameMerge()">${state.showingNameMerge?'選手名の編集を閉じる':'選手名を編集'}</button>
      <button class="btn small" onclick="simpleStatsCSV(careerDetailedStatsForAllPlayers(), '個人通算成績')">⬆️ CSV</button>
    </div>`;
    if (state.showingNameMerge){
      body += `<div class="card" style="margin-bottom:12px;">
        <p class="muted" style="margin-bottom:8px;">表記ゆれや同一選手の重複登録は、名前を編集して統合できます。</p>
        ${renderNameMergeList()}
      </div>`;
    }
    body += all.length ? statsRowsHtml(all) : '<p class="muted">まだ記録がありません</p>';
  } else if (tab==='rankings'){
    body += renderRankingsBody();
  } else if (tab==='csv'){
    const matches = [];
    if (state.rallyLog.length) matches.push({id:'current', label:'進行中：'+state.homeTeamName+' vs '+state.awayTeamName});
    state.matchHistory.forEach(m=>matches.push({id:m.id, label:new Date(m.date).toLocaleDateString('ja-JP')+' '+m.homeTeamName+' vs '+m.awayTeamName}));
    body += `<p class="muted">出力する試合を選んでください（複数選択可）。選手ごとに1つのCSVファイルが作成されます。</p>`;
    body += matches.map(m=>`
      <label class="row gap8" style="padding:8px 0;border-bottom:1px solid var(--line);">
        <input type="checkbox" value="${m.id}" class="csv-match-check"> ${esc(m.label)}
      </label>`).join('') || '<p class="muted">まだ試合記録がありません</p>';
    body += `<button class="btn primary" style="width:100%;margin-top:14px;" onclick="runCsvExport(true)">📁 フォルダに保存する</button>`;
    body += `<button class="btn" style="width:100%;margin-top:8px;" onclick="runCsvExport(false)">個別にダウンロードする</button>`;
    body += `<p class="muted" style="margin-top:8px;">「フォルダに保存する」はChrome/Edgeなど対応ブラウザで実際のフォルダに選手ごとのCSVをまとめて書き出せます。非対応の場合は自動的に個別ダウンロードになります。</p>`;
  }
  return sheetShell('これまでの記録', body, 'max-width:900px;');
}

function runCsvExport(toFolder){
  const ids = Array.from(document.querySelectorAll('.csv-match-check:checked')).map(el=>el.value);
  if (ids.length===0){ alert('試合を選択してください'); return; }
  if (toFolder) exportDetailedCSVToFolder(ids);
  else exportDetailedCSV(ids);
}

/* ---- ゲーム準備 ---- */

function toggleMyTeam(name){ state.myTeamName = state.myTeamName===name ? null : name; render(); }

function renameTeam(oldName){
  const newName = window.prompt('新しいチーム名', oldName);
  if (!newName || !newName.trim() || newName.trim()===oldName) return;
  const trimmed = newName.trim();
  state.knownTeamNames = state.knownTeamNames.map(n=>n===oldName?trimmed:n);
  if (state.teamRosters[oldName]){ state.teamRosters[trimmed] = state.teamRosters[oldName]; delete state.teamRosters[oldName]; }
  if (state.myTeamName===oldName) state.myTeamName = trimmed;
  if (state.homeTeamName===oldName) state.homeTeamName = trimmed;
  if (state.awayTeamName===oldName) state.awayTeamName = trimmed;
  render();
}

function deleteTeamName(name){
  if (!confirm('「'+name+'」を削除しますか？')) return;
  state.knownTeamNames = state.knownTeamNames.filter(n=>n!==name);
  delete state.teamRosters[name];
  if (state.myTeamName===name) state.myTeamName = null;
  render();
}

function addNewTeamName(){
  const name = window.prompt('新しいチーム名を入力してください');
  if (name && name.trim()) registerTeamName(name.trim());
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

function updateRosterPlayer(teamName, id, field, value){
  const roster = state.teamRosters[teamName]||[];
  const p = roster.find(p=>p.id===id);
  if (!p) return;
  if (field==='number') p.number = parseInt(value,10)||0; else p[field]=value;
  save();
}

function deleteRosterPlayer(teamName, id){
  state.teamRosters[teamName] = (state.teamRosters[teamName]||[]).filter(p=>p.id!==id);
  render();
}

function renderRosterEditor(teamName){
  const roster = state.teamRosters[teamName] || [];
  return `
  <div class="card" style="margin:8px 0;">
    ${roster.map(p=>`
      <div class="row gap8" style="margin-bottom:6px;">
        <input class="field" style="width:50px;" type="number" value="${p.number}"
          oninput="updateRosterPlayer('${teamName}','${p.id}','number',this.value)">
        <input class="field grow" value="${esc(p.name)}"
          oninput="updateRosterPlayer('${teamName}','${p.id}','name',this.value)">
        <select class="field" style="width:90px;" onchange="updateRosterPlayer('${teamName}','${p.id}','position',this.value); render();">
          ${POSITIONS.map(pos=>`<option value="${pos}" ${p.position===pos?'selected':''}>${pos}</option>`).join('')}
        </select>
        <button class="btn small danger" onclick="deleteRosterPlayer('${teamName}','${p.id}')">削除</button>
      </div>`).join('') || '<p class="muted">まだ選手が登録されていません</p>'}
    <button class="btn" style="width:100%;" onclick="addRosterPlayer('${teamName}')">＋ 選手を追加</button>
  </div>`;
}

function renderGamePrepSheet(){
  const body = `
    <h3>登録チーム</h3>
    ${state.knownTeamNames.map(name=>`
      <div class="card" style="margin-bottom:8px;">
        <div class="row gap8">
          <button onclick="toggleMyTeam('${name}')" title="自チームに設定">${state.myTeamName===name?'✅':'⚪️'}</button>
          <button class="grow" style="text-align:left;font-weight:600;" onclick="toggleRosterEditor('${name}')">
            ${esc(name)} <span class="muted">（選手${(state.teamRosters[name]||[]).length}人）</span>
            ${state.myTeamName===name?'<span style="color:var(--blue);"> 自チーム</span>':''}
          </button>
          <button class="btn small" onclick="renameTeam('${name}')">✏️</button>
          <button class="btn small danger" onclick="deleteTeamName('${name}')">🗑️</button>
        </div>
        ${state.gamePrepExpandedTeam===name ? renderRosterEditor(name) : ''}
      </div>`).join('')}
    <button class="btn primary" style="width:100%;margin-top:8px;" onclick="addNewTeamName()">＋ 新しいチームを登録</button>
    <p class="muted" style="margin-top:12px;">チーム名をタップすると選手名簿を編集できます。マークをタップすると自チームの設定を切り替えられます。自チームは試合開始のチーム名選択で常に一番上に表示されます。</p>
  `;
  return sheetShell('ゲーム準備', body, 'max-width:700px;');
}

/* ---- メンバーチェンジ ---- */

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
      <button class="mini-slot ${p?'filled':''} ${selIndex===i?'':''}" style="${selIndex===i?'outline:3px solid #facc15;':''}"
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

/* ========================= 起動 ========================= */

/* ========================= 選手名の統合・編集 ========================= */

function toggleNameMerge(){ state.showingNameMerge = !state.showingNameMerge; render(); }

function editAlias(name){
  const current = state.playerNameAliases[name] || name;
  const newName = window.prompt('「'+name+'」として記録された成績を、どの名前に統合しますか？\n既存の選手名と同じにすると成績が合算されます。', current);
  if (newName===null) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed===name) delete state.playerNameAliases[name];
  else state.playerNameAliases[name] = trimmed;
  render();
}

function renderNameMergeList(){
  const names = allTimeHomePlayerNames();
  if (names.length===0) return '<p class="muted">まだ記録がありません</p>';
  return names.map(n=>`
    <div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);">
      <span>${esc(n)}${state.playerNameAliases[n] ? ' → <strong style="color:var(--blue)">'+esc(state.playerNameAliases[n])+'</strong>' : ''}</span>
      <button class="btn small" onclick="editAlias('${n.replace(/'/g,"\\'")}')">編集</button>
    </div>`).join('');
}

/* ========================= ランキング ========================= */

function rankingRow(name, primaryValue, primaryText, detail){
  return {name, primaryValue, primaryText, detail};
}

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

function renderRankingsBody(){
  const rt = state.rankingsTab || 'spike';
  const tabs = [['spike','スパイク'],['serve','サーブ'],['catch','キャッチ'],['receive','レシーブ'],['toss','トス'],['block','ブロック']];
  let html = `<div class="tabbar" style="margin-bottom:12px;">
    ${tabs.map(([k,label])=>`<button class="${rt===k?'active':''}" onclick="state.rankingsTab='${k}'; render();">${label}</button>`).join('')}
  </div>`;
  const all = careerDetailedStatsForAllPlayers();

  if (rt==='spike'){
    if (!state.spikeScope) state.spikeScope='総合';
    const scopes = ['総合', ...allUsedCombos()];
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
    const scopes = ['総合', ...allUsedOpponentServeTypes()];
    html += scopePickerHtml('catchScope', scopes);
    const rows = all.map(s=>{
      const target = state.catchScope==='総合' ? s.serveReceiveOverall : s.serveReceiveByType.find(c=>c.name===state.catchScope);
      if (!target || target.total===0) return null;
      return rankingRow(s.player.name, target.aPassRate, pct(target.aPassRate), `総数${target.total}　A${target.aPass}　B${target.bPass}　C${target.cPass}`);
    }).filter(Boolean);
    html += renderRankingList(rows, 'Aパス率');
  } else if (rt==='receive'){
    if (!state.receiveScope) state.receiveScope='総合';
    const scopes = ['総合', ...allUsedOpponentAttackTypes()];
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
