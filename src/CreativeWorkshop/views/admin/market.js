const coin = value => Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('zh-CN');

function when(value) {
  const date = new Date(Number(value) || 0);
  return Number.isFinite(date.getTime()) && date.getTime() > 0
    ? date.toLocaleString('zh-CN', { hour12: false })
    : '—';
}

export function createAdminMarketView({
  nodes,
  element,
  button,
  empty,
  workshopApi,
  host,
  confirmDialog,
}) {
  const userActions = (user, { allowRestore = false } = {}) => {
    const actions = [];
    if (!user?.id) return actions;
    if (allowRestore || user.market_suspended) {
      actions.push(button('恢复市场权限', 'good', async () => {
        await workshopApi.setAdminMarketUserState(user.id, false, '');
        await refresh();
      }));
    } else {
      actions.push(button('冻结市场权限', 'danger', async () => {
        const note = host.prompt?.('请输入冻结原因（必填）', '') ?? '';
        if (!note.trim()) throw new Error('冻结市场权限必须填写原因');
        const ok = await confirmDialog({
          title: '冻结该玩家的空间集市交易权限？',
          message: (user.display_name || '玩家') + ' 将无法继续上架、购买、发布订单或提交报价；仍可领取和撤回已有资产。',
          confirmText: '冻结',
          danger: true,
        });
        if (!ok) return;
        await workshopApi.setAdminMarketUserState(user.id, true, note.trim());
        await refresh();
      }));
    }
    return actions;
  };

  const statusName = status => ({
    active: '在售', sold: '已售罄', cancelled: '已取消',
    filled: '已完成', expired: '已到期', completed: '已成交',
  })[status] || String(status || '—');
  const kindName = kind => ({
    item: '道具', equipment: '装备', skill: '技能',
    bloodline: '血统', form: '形态', teammate: '角色',
  })[kind] || String(kind || '资产');

  const cell = (primary, secondary = '', className = '') => {
    const node = element('div', 'rw-admin-market-cell ' + className);
    node.append(element('span', 'rw-admin-market-primary', String(primary || '—')));
    if (secondary) node.append(element('small', 'rw-admin-market-secondary', String(secondary)));
    return node;
  };

  const header = () => {
    const head = element('div', 'rw-admin-market-row rw-admin-market-header');
    const titles=(nodes.adminMarketView?.value==='deals')
      ? ['订单 / 需求','发布者提供','状态 / 报价','发布者','创建 / 到期','管理操作']
      : ['商品 / 类型','单价 / 数量','状态','卖家','创建 / 到期','管理操作'];
    for (const title of titles) {
      head.append(element('span', '', title));
    }
    return head;
  };

  const row = item => {
    const view = nodes.adminMarketView?.value || 'listings';
    const node = element('div', 'rw-admin-market-row');
    const actions = element('div', 'rw-admin-market-actions');

    if(view === 'deals') {
      const assets=(item.offer?.assets||[]).map(asset=>
        kindName(asset.kind)+' · '+asset.name+' ×'+(asset.quantity||1));
      if(Number(item.offer?.coins)>0)assets.push(coin(item.offer.coins)+' 空间币');
      node.append(
        cell(item.title,item.wanted,'rw-admin-market-item'),
        cell(assets.join(' + ')||'未提供筹码','托管资产及空间币'),
        cell(item.status==='active'?'进行中':statusName(item.status),'收到 '+Number(item.bid_count||0)+' 份待审报价'),
        cell(item.owner?.display_name||'—'),
        cell(when(item.created_at),'到期 '+when(item.expires_at)),
      );
      if(item.status==='active') {
        actions.append(button('强制撤销并退款','danger',async()=>{
          const ok=await confirmDialog({
            title:'强制撤销此自由订单？',
            message:'发布者和所有报价者托管的资产、空间币会分别转入原存档待领取队列，不会直接销毁。',
            confirmText:'撤销并退款',
            danger:true,
          });
          if(!ok)return;
          await workshopApi.cancelAdminMarketDeal(item.id);
          await refresh();
        }));
      }
      actions.append(...userActions(item.owner,{allowRestore:Boolean(item.owner?.market_suspended)}));
    } else {
      const flags = [
        item.risk?.suspicious ? '异常价格' : '',
        item.seller?.market_suspended ? '已冻结' : '',
      ].filter(Boolean).join(' · ');
      node.append(
        cell(item.asset?.name || '资产', kindName(item.asset?.kind), 'rw-admin-market-item'),
        cell(coin(item.unit_price) + ' 空间币/件', '剩余 ' + item.remaining_quantity),
        cell(statusName(item.status), flags),
        cell(item.seller?.display_name || '—'),
        cell(when(item.created_at), '到期 ' + when(item.expires_at)),
      );
      if (item.status === 'active' && Number(item.remaining_quantity || 0) > 0) {
        actions.append(button('强制下架', 'danger', async () => {
          const ok = await confirmDialog({
            title: '强制下架该挂单？',
            message: '剩余资产会进入卖家的待返还队列，不会直接销毁。',
            confirmText: '强制下架',
            danger: true,
          });
          if (!ok) return;
          await workshopApi.cancelAdminMarketListing(item.id);
          await refresh();
        }));
      }
      actions.append(...userActions(item.seller, { allowRestore: Boolean(item.seller?.market_suspended) }));
    }

    if (!actions.children.length) actions.append(element('span', 'rw-admin-market-secondary', '—'));
    node.append(actions);
    return node;
  };

  async function refresh() {
    try {
      const view=nodes.adminMarketView?.value||'listings';
      if(nodes.adminMarketRisk?.parentElement)
        nodes.adminMarketRisk.parentElement.hidden=view==='deals';
      const result = await workshopApi.listAdminMarket({
        view,
        query: nodes.adminMarketSearch?.value || '',
        status: nodes.adminMarketStatus?.value || '',
        risk: view==='listings' && Boolean(nodes.adminMarketRisk?.checked),
      });
      const items = result?.items || [];
      if (!items.length) {
        empty(nodes.adminMarketList, '没有符合条件的市场记录');
        return;
      }
      nodes.adminMarketList.replaceChildren(header(), ...items.map(row));
    } catch (error) {
      empty(nodes.adminMarketList, '市场管理加载失败：' + error.message);
    }
  }

  return { refresh };
}
