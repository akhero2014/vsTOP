/* render-stats-sheet.js — 今の試合のスタッツ画面、選手の詳細成績ドリルダウン、
   スタッツ表示の共通ヘルパー（statsRowsHtml/teamAggregateRowsHtml 等）
   volleyball-stats アプリの一部。index.html からこの順番で読み込まれる想定です。 */

/* ==================== 今の試合のスタッツ（チーム＋選手） ==================== */

function statsRowsHtml(rows){
  window.__statsRowsCache = rows;
  const hasParticipation = rows.some(r=>r.participationType!==undefined && r.participationType!==null);
  const baseCols = hasParticipation ? 4 : 3; // #, 選手名, [出場形態], 出場セット数
  return `
  <div class="stats-scroll">
    <table class="stats-table">
      <thead>
        <tr>
          <th rowspan="2">#</th>
          <th rowspan="2" class="name-cell">選手名</th>
          ${hasParticipation?'<th rowspan="2">出場形態</th>':''}
          <th rowspan="2">出場セット数</th>
          <th colspan="4" class="cat-th cat-border">スパイク</th>
          <th colspan="4" class="cat-th cat-border">サーブ</th>
          <th colspan="3" class="cat-th cat-border">キャッチ</th>
          <th colspan="1" class="cat-th cat-border">ブロック</th>
          <th rowspan="2" class="cat-border">総失点</th>
        </tr>
        <tr>
          <th class="cat-border">本数</th><th>決定率</th><th>ミス</th><th>被ブロック</th>
          <th class="cat-border">本数</th><th>エース</th><th>効果率</th><th>ミス</th>
          <th class="cat-border">本数</th><th>Aパス率</th><th>ミス</th>
          <th class="cat-border">本数</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r,i)=>`<tr style="cursor:pointer;" onclick="openPlayerDetail(window.__statsRowsCache[${i}])">
          <td>${r.player.number}</td><td class="name-cell">${esc(r.player.name)}</td>
          ${hasParticipation?`<td>${esc(r.participationType||'-')}</td>`:''}
          <td>${r.setsParticipated}</td>
          <td class="cat-border">${r.spikeOverall.total}</td><td>${pct(r.spikeOverall.decisionRate)}</td><td>${r.spikeOverall.miss}</td><td>${r.spikeOverall.blocked}</td>
          <td class="cat-border">${r.serve.total}</td><td>${r.serve.decided}</td><td>${pct(r.serve.effectiveRate)}</td><td>${r.serve.miss}</td>
          <td class="cat-border">${r.serveReceiveOverall.total}</td><td>${pct(r.serveReceiveOverall.aPassRate)}</td><td>${r.serveReceiveOverall.miss}</td>
          <td class="cat-border">${r.block.decided}</td>
          <td class="cat-border">${r.lossOfPoint ? r.lossOfPoint.totalLoss : 0}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ${hasParticipation ? '<p class="muted" style="font-size:11px;margin-top:6px;">出場形態：S1〜S6はスタメンの開始ポジション、L1/L2はリベロ、MCは途中出場（メンバーチェンジ）</p>' : ''}
  <p class="muted" style="font-size:11px;margin-top:4px;">総失点：サーブミス・キャッチミス・スパイクミス・失点タブでの記録（反則/レシーブミス/連携ミス/その他）の合計</p>`;
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
function receiveRowHtml(row){
  return statCard(`
    <div style="font-weight:700;margin-bottom:4px;">${esc(row.name)}</div>
    ${statLine('総数', row.total)}
    ${statLine('Aパス', row.aPass)}
    ${statLine('Bパス', row.bPass)}
    ${statLine('Cパス', row.cPass)}
    ${statLine('ミス数', row.miss)}
    ${statLine('Aパス率', pct(row.aPassRate))}
  `);
}

function renderPlayerDetailOverlay(){
  const s = state.viewingPlayerDetail;
  if (!s) return '';
  let body = `<p class="muted">出場セット数：${s.setsParticipated}</p>`;
  if (s.participationType!==undefined && s.participationType!==null){
    body += `<p class="muted">出場形態：${esc(s.participationType)}${s.participationType==='MC'?'（途中出場）':'（スタメン）'}</p>`;
  }

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
  if (s.lossOfPoint && s.lossOfPoint.totalLoss>0){
    body += sectionHeadingHtml('失点');
    body += statCard(`
      ${statLine('失点タブでの記録合計', s.lossOfPoint.total)}
      ${statLine('反則', s.lossOfPoint.反則)}
      ${statLine('レシーブミス', s.lossOfPoint.レシーブミス)}
      ${statLine('連携ミス', s.lossOfPoint.連携ミス)}
      ${statLine('その他', s.lossOfPoint.その他)}
      ${statLine('総失点（サーブ/キャッチ/スパイクミス含む）', s.lossOfPoint.totalLoss)}
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
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチAパス率</span><strong>${pct(agg.catchRate)}</strong></div>
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
    <div class="row" style="justify-content:space-between;"><span class="muted">キャッチAパス率</span><strong>${pct(agg.catchRate)}</strong></div>
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
  html += `<div class="row" style="justify-content:space-between;"><span class="muted">レシーブミス</span><strong>${breakdown.レシーブミス}</strong></div>`;
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