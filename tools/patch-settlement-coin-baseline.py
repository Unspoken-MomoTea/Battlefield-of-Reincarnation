from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'Regular/结算任务美化.html'
MARKER = 'SETTLEMENT_COIN_BALANCE_BASELINE_FIX'

text = PATH.read_text(encoding='utf-8')
if MARKER in text:
    print('settlement coin balance baseline already patched')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'anchor not found: {label}')
    text = text.replace(old, new, 1)
    print(f'[settlement-coin-baseline] patched: {label}')


replace_once(
"""          // SETTLEMENT_COIN_WRITE_GUARD_START
          function settlementCoinWriteTarget(currentCoin, settlement) {
            const current = Number(currentCoin);
            const before = Number(settlement && settlement.balanceBefore);
            const after = Number(settlement && settlement.balanceAfter);
            if (!Number.isFinite(current) || !Number.isFinite(before) || !Number.isFinite(after)) return null;
            // 结算币只允许从“结算前余额”推进到“结算后余额”。
            // 已结算余额以及商城消费后的任意余额都属于后续真实状态，禁止旧结算面板回写覆盖。
            if (current !== before || current === after) return null;
            return after;
          }
          // SETTLEMENT_COIN_WRITE_GUARD_END""",
"""          // SETTLEMENT_COIN_WRITE_GUARD_START
          // SETTLEMENT_COIN_BALANCE_BASELINE_FIX
          function rebaseSettlementCoinBalance(settlement, authoritativeBefore) {
            if (!settlement || typeof settlement !== 'object') return settlement;
            const before = Number(authoritativeBefore);
            const reward = Number(settlement.totalReward);
            if (!Number.isFinite(before) || !Number.isFinite(reward)) return settlement;
            return Object.assign({}, settlement, {
              balanceBefore: before,
              balanceAfter: before + reward
            });
          }

          function settlementCoinWriteTarget(currentCoin, settlement) {
            const current = Number(currentCoin);
            const before = Number(settlement && settlement.balanceBefore);
            const after = Number(settlement && settlement.balanceAfter);
            if (!Number.isFinite(current) || !Number.isFinite(before) || !Number.isFinite(after)) return null;
            // 结算币只允许从“结算前真实余额”推进到“结算后余额”。
            // 已结算余额以及商城消费后的任意余额都属于后续真实状态，禁止旧结算面板回写覆盖。
            if (current !== before || current === after) return null;
            return after;
          }

          function settlementCoinLegacyRepairTarget(currentCoin, rawSettlement, rebasedSettlement) {
            const current = Number(currentCoin);
            const rawBefore = Number(rawSettlement && rawSettlement.balanceBefore);
            const before = Number(rebasedSettlement && rebasedSettlement.balanceBefore);
            const after = Number(rebasedSettlement && rebasedSettlement.balanceAfter);
            if (![current, rawBefore, before, after].every(Number.isFinite)) return null;
            // 只修旧版“任务快照余额 != 真实结算前余额”导致的漏发；其它旧结算状态一律不补发。
            if (rawBefore === before) return null;
            if (current !== before || current === after) return null;
            return after;
          }
          // SETTLEMENT_COIN_WRITE_GUARD_END""",
'write guard and rebasing helpers',
)

replace_once(
"""          function writeSettlementCoinMessageMarker(win, messageId, marker) {
            const host = settlementMessageVarHost(win);
            if (!host) return false;
            try {
              host.setMessageVar(
                SETTLEMENT_COIN_MESSAGE_MARKER_KEY,
                String(marker || ''),
                settlementMessageVarOptions(messageId)
              );
              return true;
            } catch (e) {
              return false;
            }
          }
          // SETTLEMENT_COIN_MESSAGE_MARKER_END""",
"""          function writeSettlementCoinMessageMarker(win, messageId, marker) {
            const host = settlementMessageVarHost(win);
            if (!host) return false;
            try {
              host.setMessageVar(
                SETTLEMENT_COIN_MESSAGE_MARKER_KEY,
                String(marker || ''),
                settlementMessageVarOptions(messageId)
              );
              return true;
            } catch (e) {
              return false;
            }
          }

          function settlementCoinReceiptMarker(marker, settlement) {
            const id = String(marker || '');
            const before = Number(settlement && settlement.balanceBefore);
            const after = Number(settlement && settlement.balanceAfter);
            if (!id || !Number.isFinite(before) || !Number.isFinite(after)) return id;
            return ['v2', id, before, after].join('|');
          }

          function settlementCoinMarkerState(recorded, marker) {
            const value = String(recorded || '');
            const id = String(marker || '');
            if (!value) return 'empty';
            if (value === id) return 'legacy';
            if (id && value.indexOf('v2|' + id + '|') === 0) return 'applied';
            return 'other';
          }
          // SETTLEMENT_COIN_MESSAGE_MARKER_END""",
'message receipt helpers',
)

replace_once(
"""            return chosen || fallback || (ctx && ctx.data);
          }

          function readReincarnatorTier(data) {""",
"""            return chosen || fallback || (ctx && ctx.data);
          }

          function settlementCoinValue(data) {
            const stat = data && (data.stat_data || data);
            const raw = stat && stat.角色 ? Number(stat.角色.空间币) : NaN;
            return Number.isFinite(raw) ? raw : null;
          }

          function readSettlementCoinBalanceBefore() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            const numericId = Number(currentId);

            // 空间币不是任务快照的一部分：优先读取结算消息之前最近的真实账户余额。
            if (mvu && typeof mvu.getMvuData === 'function' && Number.isInteger(numericId) && numericId >= 0) {
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = numericId - step;
                if (id < 0) break;
                try {
                  const coin = settlementCoinValue(mvu.getMvuData({ type:'message', message_id:id }));
                  if (coin !== null) return coin;
                } catch (e) {}
              }
            }

            // 极少数环境拿不到楼层号时，首次渲染发生在程序结算写回前，latest 余额可作为安全兜底。
            return settlementCoinValue(ctx && ctx.data);
          }

          function readReincarnatorTier(data) {""",
'pre-settlement coin baseline reader',
)

replace_once(
"""          // 当正文变量已经清掉任务，仍从结算前快照核验；不以正文“已晋升”代替完成状态。
          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          let spaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);
          // 固定结算前的角色层级，防止旧结算面板为已经普升的层级重复授予资格。
          let settlementBaselineTier = readReincarnatorTier(settlementBaselineData);
          const credentialDecision = resolveCredentialDecision(settlementBaselineData);
          const credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;

          function refreshSettlementBaseline() {
            const candidate=readSettlementBaselineData();
            const preferred=preferSettlementSnapshot(settlementBaselineData,candidate);
            if (preferred) settlementBaselineData=preferred;
            settlementTaskKeys=readSettlementTaskKeys(settlementBaselineData);
            spaceCoinSettlement=calculateSpaceCoinSettlement(settlementBaselineData);
            settlementBaselineTier=readReincarnatorTier(settlementBaselineData);
            const nextTrials=extractTrialTasks(settlementBaselineData);""",
"""          // 当正文变量已经清掉任务，仍从结算前快照核验；不以正文“已晋升”代替完成状态。
          let settlementTaskKeys = readSettlementTaskKeys(settlementBaselineData);
          let rawSpaceCoinSettlement = calculateSpaceCoinSettlement(settlementBaselineData);
          let settlementCoinBalanceBefore = readSettlementCoinBalanceBefore();
          let spaceCoinSettlement = rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);
          // 固定结算前的角色层级，防止旧结算面板为已经普升的层级重复授予资格。
          let settlementBaselineTier = readReincarnatorTier(settlementBaselineData);
          const credentialDecision = resolveCredentialDecision(settlementBaselineData);
          const credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;

          function refreshSettlementBaseline() {
            const candidate=readSettlementBaselineData();
            const preferred=preferSettlementSnapshot(settlementBaselineData,candidate);
            if (preferred) settlementBaselineData=preferred;
            settlementTaskKeys=readSettlementTaskKeys(settlementBaselineData);
            rawSpaceCoinSettlement=calculateSpaceCoinSettlement(settlementBaselineData);
            if (settlementCoinBalanceBefore === null) settlementCoinBalanceBefore=readSettlementCoinBalanceBefore();
            spaceCoinSettlement=rebaseSettlementCoinBalance(rawSpaceCoinSettlement, settlementCoinBalanceBefore);
            settlementBaselineTier=readReincarnatorTier(settlementBaselineData);
            const nextTrials=extractTrialTasks(settlementBaselineData);""",
'freeze authoritative coin baseline',
)

replace_once(
"""              if (!settlementCoinWriteDone && isLatestPanel && isFullSettlement(rawText) && settlementStat.角色) {
                const settlementMarker = String(settlementTarget.marker || targetMessageId);
                const recordedMarker = readSettlementCoinMessageMarker(win, targetMessageId);
                settlementCoinWriteDone = true;
                if (recordedMarker !== settlementMarker) {
                  const currentCoin = Number(settlementStat.角色.空间币);
                  const nextCoin = settlementCoinWriteTarget(currentCoin, spaceCoinSettlement);
                  if (nextCoin !== null) {
                    settlementStat.角色.空间币 = nextCoin;
                    changed = true;
                  }
                  // 标记保存在当前结算消息自己的 message variable 中，不进入 stat_data。
                  // 即使旧档已经结算或已经商城消费，也补记该消息，避免极端余额碰撞导致二次结算。
                  settlementCoinMarkerPending = settlementMarker;
                }
              }""",
"""              if (!settlementCoinWriteDone && isLatestPanel && isFullSettlement(rawText) && settlementStat.角色) {
                const settlementMarker = String(settlementTarget.marker || targetMessageId);
                const recordedMarker = readSettlementCoinMessageMarker(win, targetMessageId);
                const markerState = settlementCoinMarkerState(recordedMarker, settlementMarker);
                const currentCoin = Number(settlementStat.角色.空间币);
                let nextCoin = null;
                settlementCoinWriteDone = true;

                if (markerState === 'legacy') {
                  // 旧版可能已写“一次性标记”却因历史任务快照余额过旧而漏发空间币。
                  nextCoin = settlementCoinLegacyRepairTarget(currentCoin, rawSpaceCoinSettlement, spaceCoinSettlement);
                  settlementCoinMarkerPending = settlementCoinReceiptMarker(settlementMarker, spaceCoinSettlement);
                } else if (markerState !== 'applied') {
                  nextCoin = settlementCoinWriteTarget(currentCoin, spaceCoinSettlement);
                  settlementCoinMarkerPending = settlementCoinReceiptMarker(settlementMarker, spaceCoinSettlement);
                }

                if (nextCoin !== null) {
                  settlementStat.角色.空间币 = nextCoin;
                  changed = true;
                }
              }""",
'coin write and legacy missed-credit recovery',
)

PATH.write_text(text, encoding='utf-8')
print('settlement coin balance baseline patch complete')
