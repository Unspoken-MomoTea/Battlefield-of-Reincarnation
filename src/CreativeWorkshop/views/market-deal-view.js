import { marketAssetDetailEntries } from './market-model.js';
import { MARKET_KIND_LABELS } from '../services/market-service.js';

// The only interactive entry point for unified negotiated orders. No automatic
// name/quality matching: a bid is merely an escrowed offer until owner accepts.
export function createMarketDealView({nodes,element,button,empty,notifyError,confirmDialog,marketService,getAuth}) {
  let mode='all';
  let selected='';
  let compose=false;
  let selectedDeal=null;
  let pageOffset=0;
  const PAGE_SIZE=50;
  const coin=value=>Math.max(0,Number(value)||0).toLocaleString('zh-CN');
  const act=fn=>async()=>{try{await fn()}catch(error){notifyError(error)}};
  const userId=()=>Number(getAuth()?.user?.id||0);
  const assetKindLabel=asset=>
    String(asset?.name||'').includes('权限凭证') && asset?.kind==='item'
      ? '凭证'
      : (MARKET_KIND_LABELS[asset?.kind] || '资产');
  const group=(title,description='')=>{
    const el=element('label','rw-ah-order-field');
    el.append(element('span','',title));
    if(description)el.append(element('small','rw-ah-order-help',description));
    return el;
  };
  const info=(assets,coins)=>{
    const names=(assets||[]).map(a=>assetKindLabel(a)+' · '+(a.name||'资产')+' ×'+(a.quantity||1));
    if(Number(coins)>0)names.push(coin(coins)+' 空间币');
    return names.join(' + ')||'未提供';
  };
  const input=(type='text',value='',placeholder='')=>{
    const el=element('input','rw-input rw-ah-deal-control');
    el.type=type;el.value=String(value);el.placeholder=placeholder;
    if(type==='number'){el.min='0';el.step='1';}
    return el;
  };
  const section=(title)=>element('div','rw-ah-order-detail-section',title);
  const descriptionInput=(placeholder='')=>{
    const el=element('textarea','rw-input rw-ah-deal-control rw-ah-deal-description');
    el.value='';el.placeholder=placeholder;el.maxLength=300;el.rows=3;
    return el;
  };
  const statusLabel=status=>({
    active:'进行中',completed:'已成交',cancelled:'已撤销',
    expired:'已到期',pending:'待审核',accepted:'已接受',
    rejected:'未选中',withdrawn:'已撤回',
  })[status]||'已结束';
  const makeAssetPicker=(inventory)=>{
    const block=element('section','rw-ah-deal-asset-picks');
    const rows=element('div','rw-ah-deal-asset-rows');
    const picks=[];
    const createRow=()=>{
      const picker=element('select','rw-input rw-ah-deal-control');
      picker.append(element('option','','请选择要托管的资产'));
      for(const [index,asset] of inventory.assets.entries()){
        const option=element('option','',assetKindLabel(asset)+' · '+asset.name+' · '+(asset.quality||'无品质')+' · 剩余 '+asset.quantity);
        option.value=String(index);picker.append(option);
      }
      picker.value='';
      const qty=input('number','1');
      qty.min='1';qty.max='9999';
      const row=element('div','rw-ah-deal-asset-row');
      const pickField=group('选择资产');
      pickField.append(picker);
      const quantityField=group('数量');
      quantityField.append(qty);
      const remove=button('移除','rw-ah-deal-remove',()=>{const pos=picks.indexOf(item);if(pos>=0)picks.splice(pos,1);row.remove()});
      const preview=element('div','rw-ah-deal-picker-preview');
      picker.addEventListener('change',()=>{
        const asset=inventory.assets[Number(picker.value)];
        preview.replaceChildren(...(picker.value!=='' && asset
          ? [offerDetails('资产预览',{assets:[asset],coins:0})]
          : []));
        qty.max=asset?.quantity||1;
        if(asset?.kind!=='item'){qty.value='1';qty.disabled=true;}
        else qty.disabled=false;
      });
      row.append(pickField,quantityField,remove,preview);
      const item={picker,qty};
      picks.push(item);rows.append(row);
    };
    block.append(
      element('strong','rw-ah-deal-field-heading','托管资产'),
      element('p','rw-ah-order-help','可以组合多种资产与空间币；权限凭证也在资产选择列表中。'),
      rows,
    );
    if(inventory.assets.length) block.append(button('+ 添加一种资产','rw-ah-deal-add',createRow));
    else block.append(element('p','rw-ah-order-help','当前存档暂无可交易资产，可以仅提供空间币。'));
    const extract=()=>{
      const selections=[];
      for(const {picker,qty} of picks){
        if(picker.value==='')continue;
        const asset=inventory.assets[Number(picker.value)];
        if(!asset)throw new Error('请重新选择有效资产');
        const count=asset.kind==='item'?Number(qty.value):1;
        if(!Number.isSafeInteger(count)||count<1||count>asset.quantity)
          throw new Error(asset.name+' 数量不足');
        selections.push({...asset,quantity:count});
      }
      return selections;
    };
    return {block,extract};
  };
  const qualityRank = value => {
    const raw=String(value??'').trim().toUpperCase();
    return /^(F|E|D|C|B|A|S|SS|SSS)$/u.test(raw) ? raw : '';
  };
  const gradeText = value => {
    const node=element('span','rw-ah-deal-value',String(value));
    const rank=qualityRank(value);
    if(rank){
      node.classList.add('rw-ah-quality-name');
      node.dataset.quality=rank;
    }
    return node;
  };
  // marketAssetDetailEntries recursively strips computed/private values,
  // including 真属性/最终属性, while keeping real 原始属性.
  const detailValue=(value, key='', depth=0) => {
    if(value==null)return element('span','rw-ah-deal-value muted','—');
    if(Array.isArray(value)){
      const list=element('div','rw-ah-deal-chips');
      for(const item of value){
        const chip=element('span','rw-ah-deal-chip');
        chip.append(detailValue(item,key,depth+1));
        list.append(chip);
      }
      return list;
    }
    if(typeof value==='object'){
      const grid=element('div','rw-ah-deal-attrs'+(depth?' is-nested':''));
      for(const [name,item] of Object.entries(value)){
        const row=element('div','rw-ah-deal-attr-row');
        row.append(element('span','rw-ah-deal-attr-key',name),detailValue(item,name,depth+1));
        grid.append(row);
      }
      return grid;
    }
    return (key==='品质' || key==='层级' || key==='原始属性' || depth>0)
      ? gradeText(value) : element('span','rw-ah-deal-value',String(value));
  };
  const offerDetails=(title,offer)=>{
    const wrapper=element('section','rw-ah-deal-offer');
    wrapper.append(element('strong','rw-ah-deal-offer-title',title));
    if(offer?.coins>0){
      const coinLine=element('div','rw-ah-deal-coin-line');
      coinLine.append(element('span','','空间币'),element('strong','',coin(offer.coins)));
      wrapper.append(coinLine);
    }
    for(const asset of offer?.assets||[]){
      const card=element('details','rw-ah-deal-asset-detail');
      const summary=element('summary','rw-ah-deal-asset-summary');
      const titleEl=element('strong','rw-ah-deal-asset-name',asset.name||'资产');
      const meta=element('span','rw-ah-deal-asset-meta');
      meta.append(
        element('span','rw-ah-deal-kind',assetKindLabel(asset)),
        element('span','', '×'+(asset.quantity||1)),
      );
      const quality=asset.data?.品质 || asset.data?.层级 || asset.quality;
      if(quality)meta.append(gradeText(quality));
      summary.append(titleEl,meta);
      const body=element('div','rw-ah-deal-asset-body');
      const entries=marketAssetDetailEntries(asset)
        .filter(([key])=>key!=='数量');
      if(entries.length) {
        for(const [key,value] of entries){
          const field=element('div','rw-ah-deal-attr-row');
          field.append(element('span','rw-ah-deal-attr-key',key),detailValue(value,key));
          body.append(field);
        }
      } else body.append(element('span','rw-ah-order-help','这项资产没有额外资料'));
      card.append(summary,body);
      wrapper.append(card);
    }
    return wrapper;
  };
  async function renderCreate(deal=null){
    const inventory=await marketService.inventory();
    if(!inventory.canTrade)throw new Error('普通模式需回主神空间、单一世界需处于非战斗状态才能发布或报价');
    const editor=element('div','rw-ah-order-form');
    const isBid=Boolean(deal);
    editor.append(element('h3','',isBid?'向订单提出报价':'发布自由交易订单'),
      element('p','rw-ah-order-help',isBid
        ?'报价会先托管你的资产；发布者亲自选择接受或拒绝，未成交则完整退回。'
        :'自由描述希望获得的东西，无需准确商品名称。你提供的资产和空间币会先进入托管。'));
    let title,wanted,duration;
    if(!isBid){
      title=input('text','','例如：寻找会治疗的伙伴');
      wanted=descriptionInput('自由描述需求、能力与条件，无需精确名称');
      duration=element('select','rw-input');
      for(const hour of [24,48,72]){
        const opt=element('option','',hour+'小时');opt.value=String(hour);duration.append(opt);
      }
      for(const [name,node] of [['标题',title],['我希望获得',wanted],['有效期',duration]]){
        const fld=group(name);fld.append(node);editor.append(fld);
      }
    } else {
      editor.append(section('订单需求：'+deal.wanted),offerDetails('发布者提供',deal.offer));
    }
    const picks=makeAssetPicker(inventory);
    const coinBox=input('number','0');
    const amount=group('另外提供空间币');amount.append(coinBox);
    editor.append(picks.block,amount);
    const note=isBid?descriptionInput('简述这项资产的效果，以及为什么符合订单需求'):null;
    if(note){const field=group('报价说明');field.append(note);editor.append(field);}
    const submit=button(isBid?'托管并提交报价':'托管并发布订单','primary',act(async()=>{
      const selections=picks.extract(),coins=Number(coinBox.value);
      if(!Number.isSafeInteger(coins)||coins<0||(!coins&&!selections.length))
        throw new Error('请提供至少一件资产或空间币');
      if(!isBid&&(!title.value.trim()||!wanted.value.trim()))
        throw new Error('标题与希望获得的描述不能为空');
      const confirmation=await confirmDialog({
        title:isBid?'确认提交报价':'确认发布订单',
        message:'将从当前存档托管 '+info(selections,coins)+'。未成交时将以待领取凭证退还。',
        confirmText:isBid?'提交报价':'发布订单',
      });
      if(!confirmation)return;
      if(isBid)await marketService.submitDealBid(deal.id,{selections,coins,note:note.value});
      else await marketService.createDeal({title:title.value,wanted:wanted.value,
        selections,coins,durationHours:Number(duration.value)||24});
      compose=false;selected='';
      await render(true);
    }));
    editor.append(submit);
    nodes.marketOrdersEditor.replaceChildren(editor);
  }
  async function display(dealId){
    const result=await marketService.getDeal(dealId);
    selectedDeal=result.deal;
    const deal=result.deal;
    const editor=element('div','rw-ah-order-detail');
    const heading=element('header','rw-ah-deal-detail-head');
    heading.append(
      element('h3','',deal.title),
      element('span','rw-ah-deal-status',statusLabel(deal.status)),
    );
    const wanted=element('section','rw-ah-deal-wanted');
    wanted.append(section('希望获得'),element('p','rw-ah-order-help',deal.wanted));
    editor.append(
      heading,
      wanted,
      offerDetails('发布者提供',deal.offer),
      element('p','rw-ah-deal-count','已收到 '+deal.bid_count+' 份待处理报价'),
    );
    if(deal.status==='active'){
      if(result.owner){
        editor.append(button('取消订单并退还全部托管','danger',act(async()=>{
          if(!await confirmDialog({title:'取消订单',message:'全部报价也将退回各自存档。',confirmText:'确认取消'}))return;
          await marketService.cancelDeal(deal.id);await render(true);
        })));
      }else if(userId()){
        editor.append(button('用我的资产提出报价','primary',act(async()=>renderCreate(deal))));
      }
    }
    if(result.owner&&result.bids.length)editor.append(section('收到的报价（接受一份后自动退还其他人）'));
    for(const bid of result.bids||[]){
      const box=element('div','rw-ah-deal-bid');
      const bidder=element('div','rw-ah-deal-bid-head');
      bidder.append(
        element('strong','',bid.bidder.display_name),
        element('span','rw-ah-deal-status',statusLabel(bid.status)),
      );
      box.append(bidder,offerDetails('报价资产',bid.offer));
      if(bid.note)box.append(element('p','rw-ah-order-help',bid.note));
      if(result.owner&&deal.status==='active'&&bid.status==='pending'){
        box.append(button('同意此报价','primary',act(async()=>{
          if(!await confirmDialog({title:'确认成交',message:'将只接受这一份报价，其余报价托管将全部退回。',
             confirmText:'同意成交'}))return;
          await marketService.decideDealBid(deal.id,bid.id,true);await render(true);
        })),button('拒绝','',act(async()=>{
          await marketService.decideDealBid(deal.id,bid.id,false);await display(deal.id);
        })));
      }else if(!result.owner&&bid.bidder.id===userId()&&bid.status==='pending'){
        box.append(button('撤回我的报价','danger',act(async()=>{
          await marketService.withdrawDealBid(bid.id);await render(true);
        })));
      }
      editor.append(box);
    }
    nodes.marketOrdersEditor.replaceChildren(editor);
  }
  async function render(force=false){
    const mine=mode==='mine';
    const state=mine?await marketService.myDeals():await marketService.listDeals('',pageOffset,PAGE_SIZE);
    const deals=mine
      ? (state.deals||[]).filter(deal=>deal.status==='active' && Number(deal.expires_at||0)>Date.now())
      : state.items||[];
    for(const tab of nodes.marketOrderViews||[])
      tab.classList.toggle('is-active',tab.dataset.marketOrderView===mode);
    if(nodes.marketOrderCreate)nodes.marketOrderCreate.hidden=false;
    if(nodes.marketSwapCreate)nodes.marketSwapCreate.hidden=true;
    if(nodes.marketOrderExamples)nodes.marketOrderExamples.hidden=true;
    if(nodes.marketOrderRefresh)nodes.marketOrderRefresh.hidden=false;
    const list=element('div','rw-ah-orders-cards');
    if(mine){
      const transfers=state.pending_deal_transfers||[];
      const claim=element('div','rw-ah-deal-claims');
      if(transfers.length)claim.append(section('待领取或退回资产 · '+transfers.length));
      for(const transfer of transfers){
        const row=element('div','rw-ah-deal-claim');
        row.append(element('span','',info(transfer.offer?.assets,transfer.offer?.coins)),
          button('领取至当前存档','primary',act(async()=>{
            await marketService.receiveDealTransfer(transfer);await render(true);
          })));
        claim.append(row);
      }
      list.append(claim,section('我发布的订单'));
    }
    if(!deals.length)list.append(element('div','rw-ah-muted-line',mine?'暂无进行中的订单':'暂无公开订单'));
    for(const deal of deals){
      const row=button('','rw-ah-order-row',act(async()=>{
        selected=deal.id;compose=false;await display(deal.id);
      }));
      row.append(
        element('strong','rw-ah-deal-row-title',deal.title),
        element('span','rw-ah-deal-row-wanted',deal.wanted),
        element('small','rw-ah-deal-row-terms',
          '提供 '+info(deal.offer.assets,deal.offer.coins)+' · '+deal.bid_count+'份报价'),
      );
      if(deal.id===selected)row.classList.add('is-selected');
      list.append(row);
    }
    if(mine){
      list.append(section('我参与的报价'));
      for(const bid of state.my_bids||[]){
        if(bid.status!=='pending')continue;
        const row=button('','rw-ah-order-row',act(async()=>display(bid.deal_id)));
        row.append(
          element('strong','', '已参与报价'),
          element('span','rw-ah-deal-row-wanted',info(bid.offer.assets,bid.offer.coins)),
          element('small','',statusLabel(bid.status)),
        );
        list.append(row);
      }
    }
    if(!mine && (pageOffset>0 || state.next_offset!=null)){
      const pager=element('div','rw-ah-deal-pager');
      if(pageOffset>0)pager.append(button('← 上一页','rw-button',act(async()=>{
        pageOffset=Math.max(0,pageOffset-PAGE_SIZE);selected='';await render(true);
      })));
      pager.append(element('span','rw-ah-deal-page','第 '+(Math.floor(pageOffset/PAGE_SIZE)+1)+' 页 · 每页最多 50 条'));
      if(state.next_offset!=null)pager.append(button('下一页 →','rw-button',act(async()=>{
        pageOffset=Number(state.next_offset);selected='';await render(true);
      })));
      list.append(pager);
    }
    nodes.marketOrdersList.replaceChildren(list);
    if(!compose){
      const target=deals.find(x=>x.id===selected)||deals[0];
      if(target)await display(target.id);
      else empty(nodes.marketOrdersEditor,'点击「发布订单」或选择左侧订单');
    }
  }
  function bind(){
    nodes.marketOrderCreate?.addEventListener('click',act(async()=>{
      compose=true;await renderCreate();
    }));
    nodes.marketOrderRefresh?.addEventListener('click',act(async()=>render(true)));
    for(const tab of nodes.marketOrderViews||[]){
      tab.addEventListener('click',act(async()=>{
        mode=tab.dataset.marketOrderView==='mine'?'mine':'all';
        selected='';compose=false;pageOffset=0;await render(true);
      }));
    }
  }
  return {render,bind};
}
