/* render-settings.js — 設定画面（入力設定・カスタム項目編集）・シートの共通処理・データバックアップ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function renderActiveSheet(){
  switch(state.activeSheet){
    case 'settings': return renderSettingsSheet();
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

/// 設定項目をカテゴリごとにまとめ、タップで開閉できるドロップダウン形式にする
function renderSettingsCategory(key, title, rowsHtmlArray){
  if (!state.openSettingsCategory) state.openSettingsCategory = {};
  const isOpen = !!state.openSettingsCategory[key];
  return `
  <div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;">
    <button style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center;padding:12px;"
      onclick="state.openSettingsCategory['${key}']=!state.openSettingsCategory['${key}']; render();">
      <strong>${esc(title)}</strong>
      <span class="muted">${isOpen?'▲':'▼'}</span>
    </button>
    ${isOpen ? `<div style="padding:0 12px 8px;">${rowsHtmlArray.join('')}</div>` : ''}
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
    ${renderSettingsCategory('tabs', 'タブの表示', [
      toggleRow('コース選択を表示','showCourseSelector'),
      toggleRow('レシーブのタブを表示','showReceiveTab'),
      toggleRow('トスのタブを表示','showTossTab'),
    ])}
    ${renderSettingsCategory('options', 'プレー結果の選択肢', [
      toggleRow('攻撃方法（スパイク/フェイント/ロール）を表示','showAttackSubType'),
      toggleRow('スパイクの「効果あり」を選択肢に追加','showAttackEffective'),
      toggleRow('ブロックの「タッチ」を選択肢に追加','showBlockTouch'),
    ])}
    ${renderSettingsCategory('operation', '操作性', [
      toggleRow('得点時に自動でローテーション','autoRotationEnabled'),
      toggleRow('結果をダブルタップして記録','doubleTapToRecordEnabled'),
    ])}

    <h3 style="margin-top:18px;">カスタム項目</h3>
    ${renderOptionListSection('serveTypeOptions', 'サーブの種類')}
    ${renderComboOptionListSection()}

    <h3 style="margin-top:18px;">試合の操作</h3>
    <div class="row" style="margin-bottom:18px;">${confirmButtonHtml('endGame','🏁 このゲームを終了する','endCurrentGame();')}</div>
    <div class="muted" style="margin-bottom:6px;">セット数の手動修正</div>
    <div class="row" style="justify-content:space-between;margin:8px 0;">
      <span>${esc(state.homeTeamName)}</span>
      <div class="row gap8"><button onclick="adjustSetsWon('home',-1)">➖</button><strong>${state.homeSetsWon}</strong><button onclick="adjustSetsWon('home',1)">➕</button></div>
    </div>
    <div class="row" style="justify-content:space-between;margin-bottom:16px;">
      <span>${esc(state.awayTeamName)}</span>
      <div class="row gap8"><button onclick="adjustSetsWon('away',-1)">➖</button><strong>${state.awaySetsWon}</strong><button onclick="adjustSetsWon('away',1)">➕</button></div>
    </div>
    ${toggleRow('相手チームのスタッツを記録する','trackOpponentStats')}
  `;
  return sheetShell('設定', body, 'max-width:600px;');
}

/// promptを使わず、その場で開閉するインライン編集リスト（サーブの種類用。並び替えにも対応）
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
        <button class="btn small" onclick="moveOptionListItem('${field}',${i},-1)" ${i===0?'disabled':''}>▲</button>
        <button class="btn small" onclick="moveOptionListItem('${field}',${i},1)" ${i===items.length-1?'disabled':''}>▼</button>
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
function moveOptionListItem(field, index, direction){
  const arr = state[field];
  const newIndex = index+direction;
  if (newIndex<0 || newIndex>=arr.length) return;
  const tmp = arr[index]; arr[index]=arr[newIndex]; arr[newIndex]=tmp;
  render();
}

/// スパイクのコンビネーション専用の編集リスト（カテゴリ：レフト/クイック/ライト/バック の指定つき）
function renderComboOptionListSection(){
  const isOpen = state.editingOptionList==='attackComboOptions';
  const categories = ['レフト','クイック','ライト','バック'];
  let html = `
    <div class="row" style="justify-content:space-between;margin-bottom:6px;">
      <strong>スパイクのコンビネーション</strong>
      <button class="btn small" onclick="state.editingOptionList=${isOpen?'null':"'attackComboOptions'"}; state.newNameDraft=''; state.newComboCategory=state.newComboCategory||'レフト'; render();">
        ${isOpen?'閉じる':'編集'}
      </button>
    </div>`;
  if (isOpen){
    html += `<div class="card" style="margin-bottom:14px;">`;
    categories.forEach(category=>{
      const itemsInCategory = state.attackComboOptions
        .map((o,i)=>({o,i}))
        .filter(x=>x.o.category===category);
      html += `<div class="muted" style="font-size:12px;font-weight:700;margin:8px 0 4px;">${esc(category)}</div>`;
      html += itemsInCategory.map((x,catIdx)=>`
        <div class="list-item">
          <span class="grow-text">${esc(x.o.name)}</span>
          <button class="btn small" onclick="moveComboItemInCategory('${category}',${catIdx},-1)" ${catIdx===0?'disabled':''}>▲</button>
          <button class="btn small" onclick="moveComboItemInCategory('${category}',${catIdx},1)" ${catIdx===itemsInCategory.length-1?'disabled':''}>▼</button>
          <button class="btn small danger" onclick="removeComboItem(${x.i})">削除</button>
        </div>`).join('') || '<p class="muted" style="font-size:12px;">まだありません</p>';
    });
    html += `
      <div class="col gap8" style="margin-top:12px;">
        <label class="muted">分類（表示位置：レフト/クイック/ライトは上段、バックは下段）</label>
        <select class="field" onchange="state.newComboCategory=this.value;">
          ${categories.map(c=>`<option value="${c}" ${((state.newComboCategory||'レフト')===c)?'selected':''}>${c}</option>`).join('')}
        </select>
        <div class="inline-add">
          <input class="field grow" placeholder="新しいコンビ名" value="${esc(state.newNameDraft||'')}"
            oninput="state.newNameDraft=this.value" onkeydown="if(event.key==='Enter'){addComboItem();}">
          <button class="btn primary" onclick="addComboItem()">追加</button>
        </div>
      </div>`;
    html += `</div>`;
  }
  return html;
}
function addComboItem(){
  const v = (state.newNameDraft||'').trim();
  if (!v){ showToast('コンビ名を入力してください'); return; }
  if (state.attackComboOptions.some(o=>o.name===v)){ showToast('すでに登録されています'); return; }
  state.attackComboOptions.push({ name:v, category: state.newComboCategory||'レフト' });
  state.newNameDraft='';
  render();
}
function removeComboItem(index){
  state.attackComboOptions.splice(index,1);
  render();
}
/// 同じジャンル（カテゴリ）内だけで順番を入れ替える
function moveComboItemInCategory(category, categoryIndex, direction){
  const arr = state.attackComboOptions;
  const indices = arr.map((o,i)=>({o,i})).filter(x=>x.o.category===category).map(x=>x.i);
  const newCategoryIndex = categoryIndex + direction;
  if (newCategoryIndex<0 || newCategoryIndex>=indices.length) return;
  const idxA = indices[categoryIndex];
  const idxB = indices[newCategoryIndex];
  const tmp = arr[idxA]; arr[idxA]=arr[idxB]; arr[idxB]=tmp;
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



