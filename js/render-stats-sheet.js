/* render-stats-sheet.js — 今の試合のスタッツ画面、選手の詳細成績ドリルダウン、
   スタッツ表示の共通ヘルパー（statsRowsHtml/teamAggregateRowsHtml 等）
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

/* ==================== 今の試合のスタッツ（チーム＋選手） ==================== */

function statsRowsHtml(rows, opts){
  opts = opts || {};
  // career=true（個人通算・選択集計）のときは、スパイク欄に「決定数」「セット平均」を加える
  const career = !!opts.career;
  window.__statsRowsCache = rows;
  const hasParticipation = rows.some(r=>r.participationType!==undefined && r.participationType!==null);
  return `
  <div class="stats-scroll">
    <table class="stats-table">
      <thead>
        <tr>
          <th rowspan="2">#</th>
          <th rowspan="2" class="name-cell">選手名</th>
          ${hasParticipation?'<th rowspan="2">出場形態</th>':''}
          <th rowspan="2">セット数</th>
          <th colspan="${career?6:5}" class="cat-th cat-border">スパイク</th>
          <th colspan="4" class="cat-th cat-border">サーブ</th>
          <th colspan="3" class="cat-th cat-border">キャッチ</th>
          <th colspan="4" class="cat-th cat-border">レシーブ</th>
          <th colspan="3" class="cat-th cat-border">ブロック</th>
          <th rowspan="2" class="cat-border">総得点</th>
          <th rowspan="2">総失点</th>
        </tr>
        <tr>
          <th class="cat-border">本数</th><th>決定数</th><th>決定率</th>${career?'<th>セット平均</th>':''}<th>ミス</th><th>被ブロック</th>
          <th class="cat-border">本数</th><th>エース</th><th>効果率</th><th>ミス</th>
          <th class="cat-border">本数</th><th>成功率</th><th>ミス</th>
          <th class="cat-border">本数</th><th>強打数</th><th>返球率</th><th>ミス</th>
          <th class="cat-border">決定本数</th><th>タッチ数</th><th>BO数</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r,i)=>`<tr style="cursor:pointer;" onclick="openPlayerDetail(window.__statsRowsCache[${i}])">
          <td>${r.player.number}</td><td class="name-cell">${esc(r.player.name)}</td>
          ${hasParticipation?`<td>${esc(r.participationType||'-')}</td>`:''}
          <td>${r.setsParticipated}</td>
          <td class="cat-border">${r.spikeOverall.total}</td><td>${r.spikeOverall.decided}</td><td>${pct(r.spikeOverall.decisionRate)}</td>${career?`<td>${num(r.spikeOverall.perSet,2)}</td>`:''}<td>${r.spikeOverall.miss}</td><td>${r.spikeOverall.blocked}</td>
          <td class="cat-border">${r.serve.total}</td><td>${r.serve.decided}</td><td>${pct(r.serve.effectiveRate)}</td><td>${r.serve.miss}</td>
          <td class="cat-border">${r.serveReceiveOverall.total}</td><td>${pct(r.serveReceiveOverall.successRate)}</td><td>${r.serveReceiveOverall.miss}</td>
          <td class="cat-border">${r.receiveOverall.total}</td><td>${r.receiveOverall.hardHit.total}</td><td>${pct(r.receiveOverall.hardHit.returnRate)}</td><td>${r.receiveOverall.miss}</td>
          <td class="cat-border">${r.block.decided}</td><td>${r.block.touch}</td><td>${r.block.blockOut}</td>
          <td class="cat-border">${r.totalPoints||0}</td>
          <td>${r.lossOfPoint ? r.lossOfPoint.totalLoss : 0}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${hasParticipation ? '<p class="muted" style="font-size:11px;margin-top:6px;">出場形態：S1〜S6はスタメンの開始ポジション、L1/L2はリベロ、MCは途中出場（メンバーチェンジ）</p>' : ''}
  <p class="muted" style="font-size:11px;margin-top:4px;">レシーブの返球率＝（強打のA×100＋B×50＋C×25－ミス×100）÷強打の受数　BO数＝ブロックアウト本数　総得点＝スパイク決定・サーブエース・ブロック決定の合計　総失点＝サーブミス・キャッチミス・レシーブミス・スパイクミス・トスミス・ブロックアウト・失点タブ（反則/つなぎミス/連携ミス/その他）の合計</p>`;
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
function serveRowHtml(row){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('決定本数', row.decided)}
    ${statLine('効果本数', row.effective)}
    ${statLine('ミス数', row.miss)}
    ${statLine('効果率', pct(row.effectiveRate))}
  `);
}
function spikeRowHtml(row){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('決定本数', row.decided)}
    ${statLine('ミス数', row.miss)}
    ${statLine('被ブロック数', row.blocked)}
    ${statLine('決定率', pct(row.decisionRate))}
  `);
}
function receiveRowHtml(row, isCatch){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('Aパス', row.aPass)}
    ${statLine('Bパス', row.bPass)}
    ${statLine('Cパス', row.cPass)}
    ${statLine('ミス数', row.miss)}
    ${isCatch ? statLine('成功率', pct(row.successRate)) : statLine('Aパス率', pct(row.aPassRate))}
  `);
}

function renderPlayerDetailOverlay(){
  const s = state.viewingPlayerDetail;
  if (!s) return '';
  let body = `<p class="muted">セット数：${s.setsParticipated}</p>`;
  if (s.participationType!==undefined && s.participationType!==null){
    body += `<p class="muted">出場形態：${esc(s.participationType)}${s.participationType==='MC'?'（途中出場）':'（スタメン）'}</p>`;
  }

  if (s.spikeOverall.total>0){
    body += sectionHeadingHtml('スパイク');
    body += spikeRowHtml(s.spikeOverall);
    body += statCard(statLine('セットあたりのアタック決定本数', num(s.spikeOverall.perSet,2)));
    if (s.spikeByCombo.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">コンビ別</div>`;
      s.spikeByCombo.forEach(c=>{ body += spikeRowHtml(c); });
    }
  }
  if (s.serve.total>0){
    body += sectionHeadingHtml('サーブ');
    body += serveRowHtml({name:'総合', ...s.serve});
    if (s.serveByType && s.serveByType.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">サーブの種類別</div>`;
      s.serveByType.forEach(t=>{ body += serveRowHtml(t); });
    }
  }
  if (s.toss.total>0){
    body += sectionHeadingHtml('トス');
    body += statCard(`
      ${statLine('トス本数', s.toss.total)}
      ${statLine('成功数', s.toss.success)}
      ${statLine('失敗数', s.toss.failure)}
      ${statLine('ミス数', s.toss.miss)}
      ${statLine('成功率', pct(s.toss.successRate))}
      ${statLine('コンビ', s.toss.combo)}
      ${statLine('2段トス', s.toss.nidan)}
      ${statLine('相手コートへ返球', s.toss.returned)}
    `);
    if (s.toss.byDest && s.toss.byDest.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">あげ先別（コンビ / 2段トス）</div>`;
      s.toss.byDest.forEach(d=>{ body += statCard(`<div style="font-weight:700;">${esc(d.name)}</div>${statLine('コンビ', d.combo)}${statLine('2段トス', d.nidan)}`); });
    }
  }
  if (s.serveReceiveOverall.total>0){
    body += sectionHeadingHtml('キャッチ');
    body += receiveRowHtml(s.serveReceiveOverall, true);
    if (s.serveReceiveByType.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">相手サーブ種類別</div>`;
      s.serveReceiveByType.forEach(t=>{ body += receiveRowHtml(t, true); });
    }
  }
  if (s.receiveOverall.total>0){
    body += sectionHeadingHtml('レシーブ');
    body += receiveRowHtml(s.receiveOverall);
    if (s.receiveOverall.hardHit && s.receiveOverall.hardHit.total>0){
      const h = s.receiveOverall.hardHit;
      body += statCard(`<div style="font-weight:700;margin-bottom:4px;">強打</div>${statLine('強打の受数', h.total)}${statLine('Aパス', h.aPass)}${statLine('Bパス', h.bPass)}${statLine('Cパス', h.cPass)}${statLine('ミス数', h.miss)}${statLine('強打返球率', pct(h.returnRate))}`);
    }
    if (s.receiveByType.length){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">相手攻撃種類別</div>`;
      s.receiveByType.forEach(t=>{ body += receiveRowHtml(t); });
    }
  }
  if (s.block.decided>0 || s.block.touch>0 || s.block.blockOut>0 || s.block.setsPlayed>0){
    body += sectionHeadingHtml('ブロック');
    body += statCard(`
      ${statLine('決定本数', s.block.decided)}
      ${statLine('セットあたりのブロック数', num(s.block.perSet,2))}
      ${statLine('タッチ', s.block.touch)}
      ${statLine('ブロックアウト（失点）', s.block.blockOut)}
    `);
  }
  if (s.lossOfPoint && s.lossOfPoint.totalLoss>0){
    body += sectionHeadingHtml('失点');
    body += statCard(`
      ${statLine('失点タブでの記録合計', s.lossOfPoint.total)}
      ${statLine('反則', s.lossOfPoint.反則)}
      ${statLine('つなぎミス', s.lossOfPoint.つなぎミス)}
      ${statLine('連携ミス', s.lossOfPoint.連携ミス)}
      ${statLine('その他', s.lossOfPoint.その他)}
      ${statLine('総失点（サーブ・キャッチ・レシーブ・スパイク・トスのミス、ブロックアウト含む）', s.lossOfPoint.totalLoss)}
    `);
    if (s.lossOfPoint.反則>0){
      body += `<div class="muted" style="font-size:12px;margin-bottom:4px;">反則の内訳</div>`;
      LOSS_FOUL_DETAILS.forEach(d=>{
        if (s.lossOfPoint.foulByDetail[d]>0){
          body += statCard(statLine(d, s.lossOfPoint.foulByDetail[d]));
        }
      });
    }
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
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチ成功率</span><strong>${pct(agg.catchRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">レシーブ（強打）返球率</span><strong>${pct(agg.receiveRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">ブロック</span><strong>${agg.totalBlocks}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">サーブミス</span><strong>${agg.serveMiss}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">スパイクミス</span><strong>${agg.spikeMiss}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">被ブロック数</span><strong>${agg.spikeBlocked}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチミス</span><strong>${agg.catchMiss}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">相手ミスによる得点</span><strong>${opponentErrors}</strong></div>
  </div>`;
}

/// チーム通算（複数試合の集計）用：率で表示されるものだけに絞った簡易版
function teamRatesOnlyHtml(agg){
  return `
  <div class="col gap8" style="margin-bottom:16px;">
    <div class="row" style="justify-content:space-between;"><span class="muted">スパイク決定率</span><strong>${pct(agg.spikeRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">サーブ効果率</span><strong>${pct(agg.serveRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチ成功率</span><strong>${pct(agg.catchRate)}</strong></div>
    <div class="row" style="justify-content:space-between;"><span class="muted">レシーブ（強打）返球率</span><strong>${pct(agg.receiveRate)}</strong></div>
  </div>`;
}

/// 失点の内訳（ジャンル別・反則は種類別まで、連携ミスは選手名も列挙）を表示する
function lossOfPointBreakdownHtml(breakdown){
  if (!breakdown || breakdown.total===0) return '';
  let html = `<h3>失点の内訳（${breakdown.total}回）</h3><div class="col gap8" style="margin-bottom:16px;">`;
  html += `<div class="row" style="justify-content:space-between;"><span class="muted">反則</span><strong>${breakdown.反則}</strong></div>`;
  LOSS_FOUL_DETAILS.forEach(d=>{
    if (breakdown.foulByDetail[d]>0){
      html += `<div class="row" style="justify-content:space-between;padding-left:16px;"><span class="muted">　└ ${esc(d)}</span><strong>${breakdown.foulByDetail[d]}</strong></div>`;
    }
  });
  html += `<div class="row" style="justify-content:space-between;"><span class="muted">つなぎミス</span><strong>${breakdown.つなぎミス}</strong></div>`;
  html += `<div class="row" style="justify-content:space-between;"><span class="muted">連携ミス</span><strong>${breakdown.連携ミス.length}</strong></div>`;
  breakdown.連携ミス.forEach(m=>{
    html += `<div class="row" style="justify-content:space-between;padding-left:16px;"><span class="muted">　└ ${esc(m.playerNames.join('・')||'選手未選択')}</span></div>`;
  });
  if (breakdown.その他>0){
    html += `<div class="row" style="justify-content:space-between;"><span class="muted">その他</span><strong>${breakdown.その他}</strong></div>`;
  }
  html += `</div>`;
  return html;
}

function renderStatsSheet(){
  const team = state.trackOpponentStats ? (state.statsTeam || 'home') : 'home';
  const rows = playerDetailedStatsList(team);
  const agg = aggregateFromPlayerList(rows);
  const opponentErrors = team==='home' ? (state.trackOpponentStats?opponentErrorsBenefiting('home'):state.opponentMistakePoints)
                                        : state.rallyLog.filter(e=>e.team==='home'&&e.outcome==='opponent').length;
  const lossBreakdown = lossOfPointBreakdownForTeamEvents(state.rallyLog, team);
  const body = `
    <div class="row gap8" style="margin-bottom:12px;">
      <button class="btn ${team==='home'?'primary':''}" onclick="state.statsTeam='home'; render();">${esc(state.homeTeamName)}</button>
      ${state.trackOpponentStats ? `<button class="btn ${team==='away'?'primary':''}" onclick="state.statsTeam='away'; render();">${esc(state.awayTeamName)}</button>` : ''}
      <span class="grow"></span>
      <button class="btn small" onclick="simpleStatsCSV(playerDetailedStatsList('${team}'), '選手別スタッツ')">⬆️ CSV</button>
    </div>
    <h3>チームスタッツ</h3>
    ${teamAggregateRowsHtml(agg, opponentErrors)}
    ${lossOfPointBreakdownHtml(lossBreakdown)}
    <h3>選手別スタッツ</h3>
    ${rows.length ? statsRowsHtml(rows) : '<p class="muted">まだ記録がありません</p>'}
  `;
  return sheetShell('スタッツ（今の試合）', body, 'max-width:900px;');
}

