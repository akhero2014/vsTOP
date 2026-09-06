/* render-match.js — 試合中の画面の描画：ヘッダー・コート図・プレー入力・ラリー履歴・選手一覧タブ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderHeader(){
  const cur = state.setScores[state.setScores.length-1];
  return `
  <div class="header">
    <button class="back" onclick="pauseAndReturnHome()">← ホームへ</button>
    <div class="score-block">
      <div class="team-label"><span class="dot"></span>${esc(state.homeTeamName)}</div>
      ${renderScoreStepper('home', cur.home)}
      ${state.matchFormat==='official' ? `
        <div class="set-pill">${state.currentSet}セット目<br>(${state.homeSetsWon}-${state.awaySetsWon})</div>
      ` : ''}
      ${renderScoreStepper('away', cur.away)}
      <div class="team-label"><span class="dot outline"></span>${esc(state.awayTeamName)}</div>
    </div>
    <div class="header-icons">
      <button onclick="openSheet('settings')"><span class="ic">⚙️</span>設定</button>
      <button onclick="openSheet('stats')"><span class="ic">📊</span>スタッツ</button>
      <button onclick="openSheet('menu')"><span class="ic">☰</span>メニュー</button>
    </div>
  </div>`;
}

function renderScoreStepper(team, value){
  return `
  <div class="score-stepper">
    <div class="score-num">${value}</div>
    <div class="score-btns">
      <button onclick="adjustScore('${team}',-1)">➖</button>
      <button onclick="adjustScore('${team}',1)">➕</button>
    </div>
  </div>`;
}

/* ========================= 試合中：コート ========================= */

function positionCircleHtml(team, index){
  const rotation = team==='home' ? state.homeRotation : state.awayRotation;
  const players = currentPlayers(team);
  const player = players.find(p=>p.id===rotation[index]);
  const isSelected = state.selectedTeam===team && player && state.selectedPlayerId===player.id;
  const disabled = !player || (team==='away' && !state.trackOpponentStats);
  const setterCls = player && player.position==='S' ? 'setter' : '';
  return `
    <button class="pos-circle ${team==='away'?'away':''} ${setterCls} ${isSelected?'selected':''} ${!player?'empty':''}"
      ${disabled?'disabled style="opacity:.5"':''} onclick="selectCourtPlayer('${team}','${player?player.id:''}')">
      <div class="circ">
        ${player ? `<span class="circ-num">${player.number}</span><span class="circ-name">${esc(player.name.slice(0,2))}</span>` : '-'}
      </div>
      <div class="lab">P${index+1}</div>
    </button>`;
}

function liberoBadgeHtml(team, index, label){
  const l = liberos(team);
  const player = l[index];
  const isSelected = state.selectedTeam===team && player && state.selectedPlayerId===player.id;
  const disabled = !player || (team==='away' && !state.trackOpponentStats);
  return `
    <button class="pos-circle ${team==='away'?'away':''} ${isSelected?'selected':''} ${!player?'empty':''}"
      style="width:44px" ${disabled?'disabled style="opacity:.5"':''} onclick="selectCourtPlayer('${team}','${player?player.id:''}')">
      <div class="circ" style="width:40px;height:40px;background:${player?'#f59e0b':'rgba(255,255,255,.25)'}">
        ${player ? `<span class="circ-num">${player.number}</span><span class="circ-name">${esc(player.name.slice(0,2))}</span>` : '-'}
      </div>
      <div class="lab">${label}</div>
    </button>`;
}

function selectCourtPlayer(team, playerId){
  if (!playerId) return;
  if (team==='away' && !state.trackOpponentStats) return;
  state.selectedTeam = team; state.selectedPlayerId = playerId;
  render();
}

function renderTeamBlock(team, nearNetFirst){
  const front = team==='home' ? HOME_FRONT : AWAY_FRONT;
  const back = team==='home' ? HOME_BACK : AWAY_BACK;
  const firstRow = nearNetFirst ? front : back;
  const secondRow = nearNetFirst ? back : front;
  const l1 = liberoBadgeHtml(team, 0, 'L1');
  const l2 = liberoBadgeHtml(team, 1, 'L2');
  const liberoCol = team==='home'
    ? `<div class="libero-col">${nearNetFirst? l2+l1 : l1+l2}</div>`
    : `<div class="libero-col">${nearNetFirst? l2+l1 : l1+l2}</div>`;
  const grid = `
    <div class="court-grid">
      <div class="court-row">${firstRow.map(i=>positionCircleHtml(team,i)).join('')}</div>
      <div class="court-row">${secondRow.map(i=>positionCircleHtml(team,i)).join('')}</div>
    </div>`;
  return `<div class="team-block">${team==='home' ? liberoCol+grid : grid+liberoCol}</div>`;
}

function renderCourt(){
  return `
  <div class="col gap10">
    <div class="court-box">
      <div class="team-header dim">${esc(state.awayTeamName)} ${state.servingTeam==='away'?'<span class=\"serve-dot\"></span> サーブ権':''}</div>
      ${renderTeamBlock('away', false)}
      <div class="net-divider"><span>ネット</span></div>
      ${renderTeamBlock('home', true)}
      <div class="team-header">${esc(state.homeTeamName)} ${state.servingTeam==='home'?'<span class=\"serve-dot\"></span> サーブ権':''}</div>
    </div>

    <div class="serve-toggle-row">
      <span class="muted">サーブ権</span>
      <button class="pill-btn ${state.servingTeam==='home'?'active':''}" onclick="setServingTeam('home')">${esc(state.homeTeamName)}</button>
      <button class="pill-btn ${state.servingTeam==='away'?'active':''}" onclick="setServingTeam('away')">${esc(state.awayTeamName)}</button>
    </div>

    <div class="row gap8">
      <button class="btn grow" onclick="manualRotate('home')">🔄 ${esc(state.homeTeamName)}</button>
      <button class="btn grow" ${state.trackOpponentStats?'':'disabled'} onclick="manualRotate('away')">🔄 ${esc(state.awayTeamName)}</button>
    </div>
    <button class="btn" onclick="openSheet('substitution')">🔁 メンバーチェンジ</button>
    <button class="btn" ${state.rallyLog.length?'':'disabled'} onclick="undoLast()">↩️ 1つ戻る</button>

    ${!state.trackOpponentStats ? `
      <div class="opp-mistake-row">
        <span class="grow">相手のミス：${state.opponentMistakePoints} 回</span>
        <button onclick="adjustOpponentMistakePoints(-1)">➖</button>
        <button onclick="adjustOpponentMistakePoints(1)">➕</button>
      </div>` : ''}
    <div class="opp-mistake-row own" style="background:rgba(239,68,68,.12);">
      <span class="grow">自チームのミス：${state.ownMistakePoints} 回</span>
      <button onclick="adjustOwnMistakePoints(-1)">➖</button>
      <button onclick="adjustOwnMistakePoints(1)">➕</button>
    </div>
  </div>`;
}

/* ========================= 試合中：プレー入力 ========================= */

function renderMatchTabs(){
  return `
  <div class="tabbar">
    <button class="${state.matchTab==='roster'?'active':''}" onclick="state.matchTab='roster'; render();">選手一覧</button>
    <button class="${state.matchTab==='entry'?'active':''}" onclick="state.matchTab='entry'; render();">プレー入力</button>
    <button class="${state.matchTab==='history'?'active':''}" onclick="state.matchTab='history'; render();">ラリー履歴</button>
  </div>`;
}

function renderRosterTab(){
  const team = state.rosterTeam || 'home';
  const disabledAway = !state.trackOpponentStats;
  const players = currentPlayers(team);
  return `
  <div class="card scroll">
    <div class="row gap8" style="margin-bottom:10px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.rosterTeam='home'; render();">${esc(state.homeTeamName)}</button>
      <button class="btn ${team==='away'?'primary':''}" onclick="state.rosterTeam='away'; render();">${esc(state.awayTeamName)}</button>
    </div>
    ${(team==='away' && disabledAway) ? '<p class="muted">相手チームのスタッツ記録がオフのため選択できません（メニューから変更できます）</p>' : players.map(p=>`
      <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;display:flex;justify-content:space-between;
        ${(state.selectedPlayerId===p.id && state.selectedTeam===team) ? 'background:var(--blue);color:#fff;' : ''}"
        onclick="selectCourtPlayer('${team}','${p.id}')">
        <span>#${p.number} ${esc(p.name)}</span>
        <span class="${(state.selectedPlayerId===p.id && state.selectedTeam===team)?'':'muted'}">${esc(p.position)}</span>
      </button>`).join('')}
  </div>`;
}

/// 直前2件のプレーをプレー入力パネルの上部に表示する（すばやく確認できるように）
function renderRecentPlaysStrip(){
  const recent = state.rallyLog.slice(0,2);
  if (recent.length===0) return '';
  return `
  <div class="row gap8" style="flex-wrap:wrap;">
    <span class="muted" style="font-size:11px;align-self:center;">直近：</span>
    ${recent.map(e=>`
      <span class="history-badge" style="background:${resultColorFor(e)}22;color:${resultColorFor(e)};font-size:11px;">
        ${e.team==='home'?'自':'相'}#${e.playerNumber} ${esc(PLAY_TYPES[e.playType].label)}・${esc(e.resultLabel)}
      </span>`).join('')}
  </div>`;
}

function choiceSectionHtml(title, options, selected, onPick){
  return `
  <div class="col gap8">
    <div class="choice-title">${esc(title)}</div>
    <div class="choice-grid">
      ${options.map(o=>`<button class="choice-btn ${selected===o?'active':''}" onclick="${onPick}('${esc(o).replace(/'/g,"\\'")}')">${esc(o)}</button>`).join('')}
    </div>
    ${options.length===0?'<div class="muted">設定から追加できます</div>':''}
  </div>`;
}

function pickCourse(v){ state.selectedCourse = state.selectedCourse===v ? null : v; render(); }

function pickSubType(v){ state.selectedSubType = state.selectedSubType===v ? null : v; render(); }

function pickCombo(v){ state.selectedCombo = state.selectedCombo===v ? null : v; render(); }

function pickOppServe(v){
  state.selectedOpponentServeType = state.selectedOpponentServeType===v ? null : v;
  if (state.selectedOpponentServeType) state.lastManualOpponentServeType = state.selectedOpponentServeType;
  render();
}

function pickOppAttack(v){ state.selectedOpponentAttackType = state.selectedOpponentAttackType===v ? null : v; render(); }

function renderPlayEntry(){
  const visible = visiblePlayTypes();
  const pt = PLAY_TYPES[state.selectedPlayType];
  const player = state.selectedPlayerId ? findPlayer(state.selectedPlayerId, state.selectedTeam) : null;

  let extra = '';
  if (pt.hasCourse && state.showCourseSelector){
    extra += choiceSectionHtml('コースを選択', COURSES, state.selectedCourse, 'pickCourse');
  }
  if (state.selectedPlayType==='serveReceive'){
    extra += state.trackOpponentStats
      ? `<div class="col gap8"><div class="choice-title">相手のサーブ種類（自動取得）</div><div class="auto-fetch">${esc(state.selectedOpponentServeType||'記録なし')}</div></div>`
      : choiceSectionHtml('相手のサーブ種類', state.serveTypeOptions, state.selectedOpponentServeType, 'pickOppServe');
  }
  if (state.selectedPlayType==='receive'){
    extra += state.trackOpponentStats
      ? `<div class="col gap8"><div class="choice-title">相手の攻撃種類（自動取得）</div><div class="auto-fetch">${esc(state.selectedOpponentAttackType||'記録なし')}</div></div>`
      : choiceSectionHtml('相手の攻撃種類', ATTACK_TYPES, state.selectedOpponentAttackType, 'pickOppAttack');
  }
  if (state.selectedPlayType==='attack'){
    extra += choiceSectionHtml('コンビネーション', state.attackComboOptions, state.selectedCombo, 'pickCombo');
  }
  if (state.selectedPlayType==='serve'){
    extra += choiceSectionHtml('サーブの種類', state.serveTypeOptions, state.selectedSubType, 'pickSubType');
  } else if (pt.subTypes){
    extra += choiceSectionHtml('攻撃方法', pt.subTypes, state.selectedSubType, 'pickSubType');
  }

  const can = canRecord();

  return `
  <div class="card col gap16 scroll">
    ${renderRecentPlaysStrip()}
    <div class="play-tabs">
      ${visible.map(t=>`
        <button class="play-tab ${state.selectedPlayType===t?'active':''}" onclick="selectPlayType('${t}'); render();">
          <span class="ic">${PLAY_TYPES[t].icon}</span>${esc(PLAY_TYPES[t].label)}
        </button>`).join('')}
    </div>

    <div class="selected-player-row">
      ${player ? `<div class="num">${player.number}</div><strong>${esc(player.name)}</strong><span class="muted">${esc(player.position)}</span>`
                : '<span class="muted">選手を選択してください（コート図・選手一覧から）</span>'}
      <span class="grow"></span>
    </div>

    ${extra}

    <div class="col gap8">
      <div class="choice-title">${esc(pt.label)}の結果を選択</div>
      <div class="result-grid">
        ${pt.results.map(r=>`
          <button class="result-btn" style="background:${state.selectedResult===r.label?r.color:r.color+'33'};
            color:${state.selectedResult===r.label?'#fff':r.color};"
            onclick="handleResultTap('${r.label}')">${esc(r.label)}</button>`).join('')}
      </div>
      ${state.doubleTapToRecordEnabled ? '<div class="muted">結果をすばやく2回タップすると即座に記録されます</div>' : ''}
    </div>

    <button class="record-btn" ${can?'':'disabled'} onclick="recordPlay()">このプレーを記録する</button>
    ${(state.selectedResult && !can) ? '<div class="warn-text">結果以外の選択項目もすべて選んでください</div>' : ''}
  </div>`;
}

/* ========================= 試合中：ラリー履歴 ========================= */

function renderHistory(){
  const rows = state.rallyLog.map((e,idx)=>`
    <div class="history-row">
      <span class="team-chip" style="background:${e.team==='home'?'#3b82f6':'#9aa1ab'}"></span>
      <span style="width:22px;">${e.playerNumber}</span>
      <span style="width:64px;">${esc(PLAY_TYPES[e.playType].label)}</span>
      <span class="grow"></span>
      <span class="history-badge" style="background:${resultColorFor(e)}22;color:${resultColorFor(e)}">${esc(e.resultLabel)}</span>
      <button class="btn small" onclick="startEditRallyEntry(${idx})">編集</button>
      ${idx>0 ? confirmButtonHtml('returnToEntry-'+e.id, 'この時点に戻る', 'returnToRallyPoint('+idx+');', 'small') : ''}
    </div>`).join('');
  return `
  <div class="card scroll">
    <h3 style="margin-bottom:8px;">ラリー履歴</h3>
    <p class="muted" style="font-size:11px;margin-bottom:6px;">「編集」でそのプレーの内容を修正、「この時点に戻る」でそのプレーを残したままそれより後だけ取り消せます。</p>
    ${rows || '<p class="muted">まだ記録がありません</p>'}
  </div>`;
}

function resultColorFor(e){
  const r = PLAY_TYPES[e.playType].results.find(r=>r.label===e.resultLabel);
  return r ? r.color : '#9aa1ab';
}

/* ========================= 試合中：ラリーの修正 ========================= */

function outcomeForResult(playType, label){
  const r = PLAY_TYPES[playType].results.find(r=>r.label===label);
  return r ? r.outcome : null;
}

function startEditRallyEntry(idx){
  const e = state.rallyLog[idx];
  if (!e) return;
  state.editingRallyIndex = idx;
  state.editDraft = {
    team: e.team, playerId: e.playerId, result: e.resultLabel,
    course: e.course, subType: e.subType, combo: e.combo,
    opponentServeType: e.opponentServeType, opponentAttackType: e.opponentAttackType,
  };
  render();
}
function cancelEditRallyEntry(){ state.editingRallyIndex=null; state.editDraft=null; render(); }
function pickEditTeam(team){ state.editDraft.team=team; state.editDraft.playerId=null; render(); }
function pickEditPlayer(playerId){ state.editDraft.playerId = playerId; render(); }
function pickEditResult(label){ state.editDraft.result = label; render(); }
function pickEditCourse(v){ state.editDraft.course = state.editDraft.course===v?null:v; render(); }
function pickEditSubType(v){ state.editDraft.subType = state.editDraft.subType===v?null:v; render(); }
function pickEditCombo(v){ state.editDraft.combo = state.editDraft.combo===v?null:v; render(); }
function pickEditOppServe(v){ state.editDraft.opponentServeType = state.editDraft.opponentServeType===v?null:v; render(); }
function pickEditOppAttack(v){ state.editDraft.opponentAttackType = state.editDraft.opponentAttackType===v?null:v; render(); }

function saveEditedRallyEntry(){
  const idx = state.editingRallyIndex;
  const e = state.rallyLog[idx];
  const draft = state.editDraft;
  if (!e || !draft || !draft.playerId || !draft.result){ showToast('選手と結果を選んでください'); return; }

  if (idx===0){
    // 一番新しいプレーは、一旦取り消してから通常の記録操作と同じ流れでもう一度記録し直す
    const savedPlayType = e.playType;
    undoLastSilent();
    state.selectedTeam = draft.team;
    state.selectedPlayerId = draft.playerId;
    state.selectedPlayType = savedPlayType;
    state.selectedResult = draft.result;
    state.selectedCourse = draft.course;
    state.selectedSubType = draft.subType;
    state.selectedCombo = draft.combo;
    state.selectedOpponentServeType = draft.opponentServeType;
    state.selectedOpponentAttackType = draft.opponentAttackType;
    state.editingRallyIndex = null; state.editDraft = null;
    if (canRecord()){
      recordPlay(); // 内部でrender()される
    } else {
      showToast('入力内容が不足しているため記録し直せませんでした');
      render();
    }
    return;
  }

  const newOutcome = outcomeForResult(e.playType, draft.result);
  if (newOutcome !== e.outcome){
    showToast('得点結果が変わる修正は、このプレーより後を先に「取消」してからやり直してください。');
    return;
  }

  // 得点・ローテーションに影響しない範囲の修正なので、その場で書き換える
  const player = findPlayer(draft.playerId, draft.team);
  e.team = draft.team;
  e.playerId = draft.playerId;
  if (player){ e.playerNumber = player.number; e.playerName = player.name; }
  e.resultLabel = draft.result;
  e.course = draft.course;
  e.subType = draft.subType;
  e.combo = draft.combo;
  e.opponentServeType = draft.opponentServeType;
  e.opponentAttackType = draft.opponentAttackType;

  state.editingRallyIndex = null; state.editDraft = null;
  showToast('プレーを修正しました');
  render();
}

function renderEditRallySheet(){
  const idx = state.editingRallyIndex;
  const e = state.rallyLog[idx];
  if (!e) return '';
  const draft = state.editDraft;
  const pt = PLAY_TYPES[e.playType];
  const players = currentPlayers(draft.team);

  let extra = '';
  if (pt.hasCourse && state.showCourseSelector){
    extra += choiceSectionHtml('コース', COURSES, draft.course, 'pickEditCourse');
  }
  if (e.playType==='serveReceive'){
    extra += choiceSectionHtml('相手のサーブ種類', state.serveTypeOptions, draft.opponentServeType, 'pickEditOppServe');
  }
  if (e.playType==='receive'){
    extra += choiceSectionHtml('相手の攻撃種類', ATTACK_TYPES, draft.opponentAttackType, 'pickEditOppAttack');
  }
  if (e.playType==='attack'){
    extra += choiceSectionHtml('コンビネーション', state.attackComboOptions, draft.combo, 'pickEditCombo');
  }
  if (e.playType==='serve'){
    extra += choiceSectionHtml('サーブの種類', state.serveTypeOptions, draft.subType, 'pickEditSubType');
  } else if (pt.subTypes){
    extra += choiceSectionHtml('攻撃方法', pt.subTypes, draft.subType, 'pickEditSubType');
  }

  const body = `
    <p class="muted" style="margin-bottom:10px;">${esc(PLAY_TYPES[e.playType].label)}のプレーを修正します。</p>
    <div class="row gap8" style="margin-bottom:10px;">
      <button class="btn ${draft.team==='home'?'primary':''}" onclick="pickEditTeam('home')">${esc(state.homeTeamName)}</button>
      <button class="btn ${draft.team==='away'?'primary':''}" onclick="pickEditTeam('away')">${esc(state.awayTeamName)}</button>
    </div>
    <div class="choice-title">選手</div>
    <div class="choice-grid" style="margin-bottom:12px;">
      ${players.map(p=>`<button class="choice-btn ${draft.playerId===p.id?'active':''}" onclick="pickEditPlayer('${p.id}')">#${p.number} ${esc(p.name)}</button>`).join('')}
    </div>
    ${extra}
    <div class="choice-title" style="margin-top:8px;">結果</div>
    <div class="result-grid" style="margin-bottom:12px;">
      ${pt.results.map(r=>`
        <button class="result-btn" style="background:${draft.result===r.label?r.color:r.color+'33'};color:${draft.result===r.label?'#fff':r.color};"
          onclick="pickEditResult('${r.label}')">${esc(r.label)}</button>`).join('')}
    </div>
    <button class="btn primary" style="width:100%;" onclick="saveEditedRallyEntry()">保存する</button>
    <button class="btn" style="width:100%;margin-top:8px;" onclick="cancelEditRallyEntry()">キャンセル</button>
    ${idx>0 ? '<p class="muted" style="margin-top:8px;">得点結果が変わるような結果への変更は、このプレーより後を先に「ラリー履歴」の「取消」で戻してからやり直してください。</p>' : ''}
  `;
  return sheetShell('プレーを修正', body, 'max-width:600px;');
}

/* ========================= 試合中：画面全体 ========================= */

function renderMatch(){
  if (state.showingStartingLineup) return renderLineup();
  let html = '<div class="screen">';
  html += renderHeader();
  html += '<div class="match-body">';
  html += '<div class="col-court">'+renderCourt()+'</div>';
  html += '<div class="col-main">'+renderMatchTabs()+matchTabContent()+'</div>';
  html += '</div></div>';
  if (state.pendingSetResult) html += renderSetCompletionOverlay();
  return html;
}

function matchTabContent(){
  if (state.matchTab==='roster') return renderRosterTab();
  if (state.matchTab==='history') return renderHistory();
  return renderPlayEntry();
}

function renderSetCompletionOverlay(){
  const winner = state.pendingSetResult;
  const winnerName = winner==='home' ? state.homeTeamName : state.awayTeamName;
  return `
  <div class="overlay">
    <div class="sheet" style="max-width:380px;">
      <div class="sheet-body col gap16" style="text-align:center;">
        <h2>セット終了</h2>
        <p>${esc(winnerName)}が第${state.currentSet}セットを獲得しました。</p>
        <div class="col gap10">
          ${state.matchFormat==='official' ? `<button class="btn primary" onclick="continueToNextSet()">次のセットを記録する</button>` : ''}
          <button class="btn danger" onclick="returnToHomeScreenReset()">ホーム画面に戻る</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ========================= シート（設定・メニュー・スタッツ・記録・準備・交代） ========================= */