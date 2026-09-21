/* render-records-extra.js — これまでの記録：選択集計（PDF出力含む）・CSV出力・ランキングタブ
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

function statsForSelectedMatches(teamName, matchIds){
  const matches = matchesInvolvingTeamName(teamName).filter(m=>matchIds.includes(m.id));
  const eventGroups = matches.map(m=>{
    const side = sideForTeamInMatch(m, teamName);
    return side ? m.rallyLog.filter(e=>e.team===side) : [];
  });
  return { matches, players: detailedStatsForAllPlayersFromMatches(eventGroups) };
}

function toggleSelectedAggregateMatch(id){
  if (!state.selectedAggregateMatchIds) state.selectedAggregateMatchIds = [];
  const idx = state.selectedAggregateMatchIds.indexOf(id);
  if (idx>=0) state.selectedAggregateMatchIds.splice(idx,1);
  else state.selectedAggregateMatchIds.push(id);
  render();
}

/// 期間で絞り込んだ結果、現在表示されている試合をまとめて選択状態にする
function selectAllVisibleAggregateMatches(){
  const teamName = state.recordsTeamName;
  const dateFrom = state.aggregateDateFrom || '';
  const dateTo = state.aggregateDateTo || '';
  const visible = matchesInvolvingTeamName(teamName).filter(m=>{
    const d = new Date(m.date).toISOString().slice(0,10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });
  state.selectedAggregateMatchIds = visible.map(m=>m.id);
  render();
}

function renderSelectedAggregateTab(teamName){
  if (!state.selectedAggregateMatchIds) state.selectedAggregateMatchIds = [];
  const matches = matchesInvolvingTeamName(teamName);
  const ids = state.selectedAggregateMatchIds;
  const dateFrom = state.aggregateDateFrom || '';
  const dateTo = state.aggregateDateTo || '';

  const visibleMatches = matches.filter(m=>{
    const d = new Date(m.date).toISOString().slice(0,10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  let html = `<p class="muted">集計したい試合を自由に選んでください（例：今日の試合だけ、特定の大会だけ、など）。</p>`;
  html += `
    <div class="row gap8" style="margin-bottom:8px;align-items:center;">
      <span class="muted">期間で絞り込み：</span>
      <input type="date" class="field" value="${esc(dateFrom)}" onchange="state.aggregateDateFrom=this.value; render();" style="max-width:150px;">
      <span class="muted">〜</span>
      <input type="date" class="field" value="${esc(dateTo)}" onchange="state.aggregateDateTo=this.value; render();" style="max-width:150px;">
      ${(dateFrom||dateTo) ? `<button class="btn small" onclick="state.aggregateDateFrom=''; state.aggregateDateTo=''; render();">期間をクリア</button>` : ''}
    </div>
    <div class="row gap8" style="margin-bottom:12px;">
      <button class="btn small" onclick="selectAllVisibleAggregateMatches()">表示中をすべて選択</button>
      <button class="btn small danger" onclick="state.selectedAggregateMatchIds=[]; render();">選択をリセット</button>
    </div>`;
  html += visibleMatches.map(m=>{
    const label = m.id==='current' ? '進行中：'+m.homeTeamName+' vs '+m.awayTeamName
      : new Date(m.date).toLocaleDateString('ja-JP')+' '+m.homeTeamName+' vs '+m.awayTeamName;
    const checked = ids.includes(m.id);
    return `
    <label class="row gap8" style="padding:8px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleSelectedAggregateMatch('${m.id}')"> ${esc(label)}
    </label>`;
  }).join('') || '<p class="muted">この期間に該当する試合記録がありません</p>';

  if (ids.length>0){
    const { matches:selMatches, players } = statsForSelectedMatches(teamName, ids);
    const agg = aggregateFromPlayerList(players);
    let opponentErrors = 0;
    selMatches.forEach(m=>{
      const side = sideForTeamInMatch(m, teamName);
      if (side==='home'){
        opponentErrors += (m.id==='current')
          ? (state.trackOpponentStats ? opponentErrorsBenefiting('home') : state.opponentMistakePoints)
          : (m.homeOpponentErrors||0);
      }
    });
    html += `<h3 style="margin-top:16px;">選択した${ids.length}試合の集計（${esc(teamName)}）</h3>`;
    html += teamAggregateRowsHtml(agg, opponentErrors);
    html += `<p class="muted" style="font-size:12px;background:rgba(59,130,246,.08);padding:8px;border-radius:8px;">ℹ️ 印刷機能を使ってPDFを作成します。印刷ダイアログで「用紙の向き：横」を選んでください。ヘッダー/フッター（URLなど）が入る場合は「詳細設定」でオフにできます（Safariの場合は元々表示されません）。</p>
    <button class="btn" style="width:100%;margin-bottom:12px;" onclick="printSelectedAggregate('${teamName.replace(/'/g,"\\'")}')">🖨️ PDFを出力する</button>`;
    html += players.length ? statsRowsHtml(players) : '<p class="muted">選手の記録がありません</p>';
  } else {
    html += '<p class="muted" style="margin-top:12px;">試合を選択すると、ここに集計結果が表示されます。</p>';
  }
  return html;
}

/// 選択した試合の集計を印刷（→「PDFとして保存」）できる形式で出力する。
/// URLやヘッダー/フッターの非表示、横向き・余白の指定は端末の印刷設定に依存する。
function printSelectedAggregate(teamName){
  const ids = state.selectedAggregateMatchIds || [];
  if (ids.length===0){ showToast('試合を選択してください'); return; }
  const { matches, players } = statsForSelectedMatches(teamName, ids);
  const agg = aggregateFromPlayerList(players);

  const pages = [];

  const spikePlayers = players.filter(p=>p.spikeOverall.total>0)
    .sort((a,b)=>(b.spikeOverall.decisionRate??-1)-(a.spikeOverall.decisionRate??-1));
  const servePlayers = players.filter(p=>p.serve.total>0)
    .sort((a,b)=>(b.serve.effectiveRate??-1)-(a.serve.effectiveRate??-1));
  const catchPlayers = players.filter(p=>p.serveReceiveOverall.total>0)
    .sort((a,b)=>(b.serveReceiveOverall.aPassRate??-1)-(a.serveReceiveOverall.aPassRate??-1));

  pages.push(`
    <h1>${esc(teamName)}　選択試合の集計</h1>
    <p>対象試合数：${ids.length}件　出力日時：${new Date().toLocaleString('ja-JP')}</p>
    <h2>チーム全体成績</h2>
    <table>
      <tr><td>スパイク決定率</td><td>${pct(agg.spikeRate)}</td></tr>
      <tr><td>サーブ効果率</td><td>${pct(agg.serveRate)}</td></tr>
      <tr><td>キャッチAパス率</td><td>${pct(agg.catchRate)}</td></tr>
      <tr><td>ブロック</td><td>${agg.totalBlocks}</td></tr>
      <tr><td>サーブミス</td><td>${agg.serveMiss}</td></tr>
      <tr><td>スパイクミス</td><td>${agg.spikeMiss}</td></tr>
      <tr><td>被ブロック数</td><td>${agg.spikeBlocked}</td></tr>
      <tr><td>キャッチミス</td><td>${agg.catchMiss}</td></tr>
    </table>
  `);
  if (spikePlayers.length){
    pages.push(`
    <h2>スパイク（総合・決定率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
      ${spikePlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.spikeOverall.total}</td><td>${p.spikeOverall.decided}</td><td>${p.spikeOverall.miss}</td><td>${p.spikeOverall.blocked}</td><td>${pct(p.spikeOverall.decisionRate)}</td></tr>`).join('')}
    </table>`);
  }
  if (servePlayers.length){
    pages.push(`
    <h2>サーブ（総合・効果率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
      ${servePlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.serve.total}</td><td>${p.serve.decided}</td><td>${p.serve.effective}</td><td>${p.serve.miss}</td><td>${pct(p.serve.effectiveRate)}</td></tr>`).join('')}
    </table>`);
  }
  if (catchPlayers.length){
    pages.push(`
    <h2>キャッチ（総合・Aパス率順）</h2>
    <table>
      <tr><th>#</th><th>選手名</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
      ${catchPlayers.map(p=>`<tr><td>${p.player.number}</td><td>${esc(p.player.name)}</td>
        <td>${p.serveReceiveOverall.total}</td><td>${p.serveReceiveOverall.aPass}</td><td>${p.serveReceiveOverall.bPass}</td><td>${p.serveReceiveOverall.cPass}</td><td>${p.serveReceiveOverall.miss}</td><td>${pct(p.serveReceiveOverall.aPassRate)}</td></tr>`).join('')}
    </table>`);
  }

  const validMatches = matches.filter(m=>sideForTeamInMatch(m, teamName));
  for (let i=0; i<validMatches.length; i+=5){
    const chunk = validMatches.slice(i, i+5);
    let matchesPage = i===0 ? `<h2>試合ごとの記録</h2>` : `<h2>試合ごとの記録（続き）</h2>`;
    chunk.forEach((m, idx)=>{
      const side = sideForTeamInMatch(m, teamName);
      const startingLineup = side==='home' ? m.homeStartingLineup : m.awayStartingLineup;
      const startingIds = new Set((startingLineup||[]).map(e=>e.playerId));
      const nameForIdInMatch = (id) => {
        const ev = m.rallyLog.find(e=>e.playerId===id);
        if (ev) return ev.playerName;
        const p = findPlayer(id, side);
        return p ? p.name : '(不明)';
      };
      const scoreText = m.setScores.map(s=>s.home+'-'+s.away).join(' / ');
      // メンバーチェンジで出場した選手：スタメンだった選手（出た側）は除き、実際に途中から入った選手だけを表示する
      const subInIds = (m.substitutedPlayerIds||[]).filter(id=>!startingIds.has(id));
      if (idx>0) matchesPage += `<hr style="border:none;border-top:1px solid #999;margin:10px 0;">`;
      matchesPage += `<h3>${esc(m.homeTeamName)} vs ${esc(m.awayTeamName)}　${new Date(m.date).toLocaleDateString('ja-JP')}</h3>`;
      matchesPage += `<p>スコア：${esc(scoreText)}</p>`;
      matchesPage += `<p><strong>スタメン：</strong>${(startingLineup||[]).map(e=>`${e.position}:${esc(nameForIdInMatch(e.playerId))}`).join('　') || '記録なし'}</p>`;
      matchesPage += subInIds.length
        ? `<p><strong>メンバーチェンジで出場した選手：</strong>${subInIds.map(id=>esc(nameForIdInMatch(id))).join('　')}</p>`
        : `<p class="muted">メンバーチェンジなし</p>`;
    });
    pages.push(matchesPage);
  }

  const playersByNumber = players.slice().sort((a,b)=>a.player.number-b.player.number);
  playersByNumber.forEach(p=>{
    let ph = `<h2>${esc(p.player.name)}（#${p.player.number}）</h2>`;
    ph += p.participationType
      ? `<p>出場形態：${esc(p.participationType)}${p.participationType==='MC'?'（途中出場）':''}　出場セット数：${p.setsParticipated}</p>`
      : `<p>出場セット数：${p.setsParticipated}</p>`;

    if (p.spikeOverall.total>0){
      ph += `<h3>スパイク（総合）</h3><table>
        <tr><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
        <tr><td>${p.spikeOverall.total}</td><td>${p.spikeOverall.decided}</td><td>${p.spikeOverall.miss}</td><td>${p.spikeOverall.blocked}</td><td>${pct(p.spikeOverall.decisionRate)}</td></tr>
      </table>`;
      if (p.spikeByCombo && p.spikeByCombo.length){
        ph += `<h3>スパイク（コンビ別）</h3><table>
          <tr><th>コンビ</th><th>総数</th><th>決定</th><th>ミス</th><th>被ブロック</th><th>決定率</th></tr>
          ${p.spikeByCombo.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.total}</td><td>${c.decided}</td><td>${c.miss}</td><td>${c.blocked}</td><td>${pct(c.decisionRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.serve.total>0){
      ph += `<h3>サーブ（総合）</h3><table>
        <tr><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
        <tr><td>${p.serve.total}</td><td>${p.serve.decided}</td><td>${p.serve.effective}</td><td>${p.serve.miss}</td><td>${pct(p.serve.effectiveRate)}</td></tr>
      </table>`;
      if (p.serveByType && p.serveByType.length){
        ph += `<h3>サーブ（種類別）</h3><table>
          <tr><th>種類</th><th>総数</th><th>決定</th><th>効果</th><th>ミス</th><th>効果率</th></tr>
          ${p.serveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.decided}</td><td>${t.effective}</td><td>${t.miss}</td><td>${pct(t.effectiveRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.serveReceiveOverall.total>0){
      ph += `<h3>キャッチ（総合）</h3><table>
        <tr><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
        <tr><td>${p.serveReceiveOverall.total}</td><td>${p.serveReceiveOverall.aPass}</td><td>${p.serveReceiveOverall.bPass}</td><td>${p.serveReceiveOverall.cPass}</td><td>${p.serveReceiveOverall.miss}</td><td>${pct(p.serveReceiveOverall.aPassRate)}</td></tr>
      </table>`;
      if (p.serveReceiveByType && p.serveReceiveByType.length){
        ph += `<h3>キャッチ（相手サーブ種類別）</h3><table>
          <tr><th>相手サーブ種類</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
          ${p.serveReceiveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.aPass}</td><td>${t.bPass}</td><td>${t.cPass}</td><td>${t.miss}</td><td>${pct(t.aPassRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.receiveOverall.total>0){
      ph += `<h3>レシーブ（総合）</h3><table>
        <tr><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
        <tr><td>${p.receiveOverall.total}</td><td>${p.receiveOverall.aPass}</td><td>${p.receiveOverall.bPass}</td><td>${p.receiveOverall.cPass}</td><td>${p.receiveOverall.miss}</td><td>${pct(p.receiveOverall.aPassRate)}</td></tr>
      </table>`;
      if (p.receiveByType && p.receiveByType.length){
        ph += `<h3>レシーブ（相手攻撃種類別）</h3><table>
          <tr><th>相手攻撃種類</th><th>総数</th><th>Aパス</th><th>Bパス</th><th>Cパス</th><th>ミス</th><th>Aパス率</th></tr>
          ${p.receiveByType.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.total}</td><td>${t.aPass}</td><td>${t.bPass}</td><td>${t.cPass}</td><td>${t.miss}</td><td>${pct(t.aPassRate)}</td></tr>`).join('')}
        </table>`;
      }
    }
    if (p.toss.total>0){
      ph += `<h3>トス</h3><table>
        <tr><th>本数</th><th>成功</th><th>失敗</th><th>ミス</th><th>成功率</th></tr>
        <tr><td>${p.toss.total}</td><td>${p.toss.success}</td><td>${p.toss.failure}</td><td>${p.toss.miss}</td><td>${pct(p.toss.successRate)}</td></tr>
      </table>`;
    }
    if (p.block.decided>0){
      ph += `<h3>ブロック</h3><table>
        <tr><th>決定本数</th><th>出場セット数</th><th>セットあたり</th></tr>
        <tr><td>${p.block.decided}</td><td>${p.block.setsPlayed}</td><td>${num(p.block.perSet,2)}</td></tr>
      </table>`;
    }
    pages.push(ph);
  });

  const html = pages.map((p,i)=>`<div style="${i===pages.length-1?'':'page-break-after:always;'}">${p}</div>`).join('');
  const printArea = document.getElementById('print-area');
  if (!printArea){ showToast('印刷用の領域が見つかりませんでした'); return; }
  printArea.innerHTML = html;
  showToast('印刷ダイアログで「用紙の向き：横」を選んでください（URLを消すには「ヘッダーとフッター」もオフに）');
  window.print();
}


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