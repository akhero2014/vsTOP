/* render-gameprep.js — ゲーム準備（チーム名編集・選手登録）・メンバーチェンジ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

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
  roster.push({id:uid(), number:n, name:'新しい選手', position:'OH', isServeReceiver:false});
  syncLiveRosterIfActive(teamName);
  render();
}
function updateRosterPlayerName(teamName, id, value){
  const p = (state.teamRosters[teamName]||[]).find(p=>p.id===id);
  if (p){ p.name = value; syncLiveRosterIfActive(teamName); save(); }
}
/// ポジションは一人につき最大2つまで選べる（slotIndex: 0か1）
function updateRosterPlayerPosition(teamName, id, slotIndex, value){
  const p = (state.teamRosters[teamName]||[]).find(p=>p.id===id);
  if (!p) return;
  const positions = playerPositions(p).slice(0,2);
  while (positions.length<2) positions.push('');
  positions[slotIndex] = value;
  p.positions = positions.filter(Boolean);
  delete p.position;
  syncLiveRosterIfActive(teamName);
  render();
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
  syncLiveRosterIfActive(teamName);
  render();
}
/// サーブレシーブ担当のオン/オフを切り替える（コート図で黄緑表示するかどうかに使う）
function toggleRosterServeReceiver(teamName, id){
  const p = (state.teamRosters[teamName]||[]).find(p=>p.id===id);
  if (p){ p.isServeReceiver = !p.isServeReceiver; syncLiveRosterIfActive(teamName); render(); }
}

function renderRosterEditor(teamName){
  const roster = state.teamRosters[teamName] || [];
  return `
  <div class="card" style="margin:8px 0;">
    <p class="muted" style="font-size:11px;margin-bottom:6px;">ポジションは一人につき最大2つまで選べます。「サーブレシーブ担当」をオンにすると、コート図でその選手が黄緑色で表示されます。</p>
    ${roster.map(p=>{
      const positions = playerPositions(p);
      const pos1 = positions[0]||'';
      const pos2 = positions[1]||'';
      return `
      <div class="row gap8" style="margin-bottom:6px;flex-wrap:wrap;">
        <input class="field" style="width:64px;" type="number" min="1" value="${p.number}"
          onchange="updateRosterPlayerNumber('${teamName}','${p.id}',this.value)">
        <input class="field grow" value="${esc(p.name)}"
          oninput="updateRosterPlayerName('${teamName}','${p.id}',this.value)">
        <select class="field" style="width:80px;" onchange="updateRosterPlayerPosition('${teamName}','${p.id}',0,this.value)">
          ${POSITIONS.map(pos=>`<option value="${pos}" ${pos1===pos?'selected':''}>${pos}</option>`).join('')}
        </select>
        <select class="field" style="width:90px;" onchange="updateRosterPlayerPosition('${teamName}','${p.id}',1,this.value)">
          <option value="" ${pos2===''?'selected':''}>（なし）</option>
          ${POSITIONS.map(pos=>`<option value="${pos}" ${pos2===pos?'selected':''}>${pos}</option>`).join('')}
        </select>
        <button class="btn small ${p.isServeReceiver?'primary':''}" style="${p.isServeReceiver?'background:#ec4899;border-color:#ec4899;':''}"
          onclick="toggleRosterServeReceiver('${teamName}','${p.id}')">レシーブ担当</button>
        ${confirmButtonHtml('delPlayer-'+p.id, '削除', "deleteRosterPlayer('"+teamName+"','"+p.id+"');", 'danger small')}
      </div>`;
    }).join('') || '<p class="muted">まだ選手が登録されていません</p>'}
    <button class="btn" style="width:100%;" onclick="addRosterPlayer('${teamName}')">＋ 選手を追加</button>
  </div>`;
}
function deleteRosterPlayer(teamName, id){
  state.teamRosters[teamName] = (state.teamRosters[teamName]||[]).filter(p=>p.id!==id);
  syncLiveRosterIfActive(teamName);
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
  const substitutedIds = state.substitutedPlayerIds || [];

  const slot = (i)=>{
    const p = players.find(p=>p.id===rotation[i]);
    const colorStyle = p ? positionColorStyle(p) : 'background:rgba(255,255,255,.25);';
    return `
      <button class="mini-slot ${p?'filled':''}" style="${selIndex===i?'outline:3px solid #facc15;':''}"
        onclick="state.subPositionIndex=${i}; render();">
        <div class="c" style="${colorStyle}">${p?p.number:'-'}</div>
        <div style="font-size:9px;">S${i+1}</div>
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
      <p class="muted" style="font-size:11px;margin-bottom:6px;">オレンジ色の選手は、この試合で一度交代したことがあります。リベロ（L1/L2）に設定されている選手はここには表示されません。</p>
      ${bench.length ? bench.map(p=>{
        const wasSubstituted = substitutedIds.includes(p.id);
        return `
        <button class="btn" style="width:100%;text-align:left;margin-bottom:6px;${wasSubstituted?'background:rgba(249,115,22,.15);border-color:#f97316;':''}"
          onclick="substitute('${team}',${selIndex},'${p.id}'); state.subPositionIndex=null;">
          #${p.number} ${esc(p.name)} <span class="muted">${esc(positionsDisplayText(p))}</span>${wasSubstituted?' <span style="color:#f97316;">（交代済み）</span>':''}
        </button>`;
      }).join('') : '<p class="muted">交代可能な選手（ベンチ）がいません</p>'}
    ` : ''}
  `;
  return sheetShell('メンバーチェンジ', body, 'max-width:500px;');
}
