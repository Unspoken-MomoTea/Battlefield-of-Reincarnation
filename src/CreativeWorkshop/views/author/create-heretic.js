import { createHereticAsset } from '../../../opening/character-assets/schema.js';

function currentCharacter(host) {
  const roots=[host,(()=>{try{return host.parent}catch{return null}})(),(()=>{try{return host.top}catch{return null}})()];
  for(const root of roots){
    try{
      const mvu=root?.Mvu;
      if(!mvu?.getMvuData) continue;
      const data=mvu.getMvuData({type:'message',message_id:'latest'});
      const character=data?.stat_data?.角色;
      if(character) return structuredClone(character);
    }catch{}
  }
  throw new Error('未读取到当前 MVU 角色，请先进入有效存档后再上传异端');
}

export function bindHereticPublishFlow({host,overlay,workshopApi,notifyError,refreshMine}) {
  const form=overlay.querySelector('[data-form="create-heretic"]');
  const open=overlay.querySelector('[data-action="create-heretic-open"]');
  const cancels=[...overlay.querySelectorAll('[data-action="create-heretic-cancel"]')];
  const preview=form?.querySelector('[data-role="heretic-build-preview"]');
  const coverInput=form?.querySelector('[data-field="heretic-cover"]');
  const coverDropzone=form?.querySelector('[data-drop-target="heretic-cover"]');
  const coverPreview=form?.querySelector('[data-role="heretic-cover-preview"]');
  const coverState=form?.querySelector('[data-role="heretic-cover-state"]');
  let snapshot=null;
  let attempt=null;
  let coverFile=null;
  let coverUrl='';

  const revokeCoverPreview=()=>{
    if(!coverUrl) return;
    try{host.URL?.revokeObjectURL?.(coverUrl);}catch{}
    coverUrl='';
  };
  const renderCover=()=>{
    revokeCoverPreview();
    const selected=coverFile||coverInput?.files?.[0]||null;
    if(!selected){
      if(coverPreview){
        coverPreview.hidden=true;
        coverPreview.removeAttribute('src');
      }
      if(coverState) coverState.textContent='必需。选择后会立即预览。';
      return;
    }
    coverFile=selected;
    try{
      coverUrl=host.URL?.createObjectURL?.(selected)||'';
      if(coverPreview&&coverUrl){
        coverPreview.src=coverUrl;
        coverPreview.hidden=false;
      }
    }catch{}
    if(coverState) coverState.textContent=`已选择：${selected.name||'封面图片'} · 尚未上传`;
    attempt=null;
  };
  const close=()=>{
    form.hidden=true;
    snapshot=null;
    attempt=null;
    coverFile=null;
    revokeCoverPreview();
    form.reset();
    if(preview)preview.textContent='打开后读取当前 MVU。';
    if(coverPreview){
      coverPreview.hidden=true;
      coverPreview.removeAttribute('src');
    }
    if(coverState) coverState.textContent='必需。选择后会立即预览。';
  };
  open?.addEventListener('click',()=>{
    try{
      snapshot=currentCharacter(host);
      form.hidden=false;
      const name=form.querySelector('[name="name"]');
      if(name&&!name.value) name.value=String(snapshot.姓名||'');
      if(preview){
        const asset=createHereticAsset(snapshot,{});
        const b=asset.build;
        preview.textContent=[
          `种族：${b.种族||'未设定'}　层级：${b.层级||'Ⅰ'}`,
          `身份：${Array.isArray(b.身份)?b.身份.join(' / '):'未设定'}`,
          `血统 ${Object.keys(b.血统||{}).length} · 技能 ${Object.keys(b.技能||{}).length} · 装备 ${Object.keys(b.装备||{}).length}`,
          `状态 ${Object.keys(b.状态||{}).length} · 形态 ${Object.keys(b.形态库||{}).length}`,
          '已排除：道具、最终属性、真属性、HP/EP、货币、凭证、任务、成就与世界状态'
        ].join('\n');
      }
      name?.focus();
    }catch(error){notifyError(error);}
  });
  cancels.forEach(button=>button.addEventListener('click',close));

  coverInput?.addEventListener('change',()=>{
    coverFile=coverInput.files?.[0]||null;
    renderCover();
  });
  coverDropzone?.addEventListener('dragover',event=>{
    event.preventDefault();
    coverDropzone.classList.add('is-dragover');
  });
  coverDropzone?.addEventListener('dragleave',()=>coverDropzone.classList.remove('is-dragover'));
  coverDropzone?.addEventListener('drop',event=>{
    event.preventDefault();
    coverDropzone.classList.remove('is-dragover');
    const file=event.dataTransfer?.files?.[0]||null;
    if(!file) return;
    if(!['image/png','image/jpeg','image/webp'].includes(String(file.type||''))){
      notifyError(new Error('封面只支持 PNG / JPEG / WebP'));
      return;
    }
    coverFile=file;
    renderCover();
  });

  form?.addEventListener('submit',event=>{
    event.preventDefault();
    void (async()=>{
      const submit=form.querySelector('button[type="submit"]');
      try{
        if(!snapshot) snapshot=currentCharacter(host);
        const fd=new FormData(form);
        const name=String(fd.get('name')||'').trim();
        if(!name) throw new Error('请填写异端名称');
        const cover=coverFile||coverInput?.files?.[0]||null;
        if(!cover) throw new Error('请选择封面图片；发布异端也必须提供图片');
        const personality=String(fd.get('personality')||'');
        const likes=String(fd.get('likes')||'');
        const background=String(fd.get('background')||'');
        const summary=String(fd.get('summary')||'');
        const asset=createHereticAsset(snapshot,{name,personality,likes,background});
        const signature=JSON.stringify({
          name,summary,personality,likes,background,
          coverName:cover.name||'',
          coverSize:Number(cover.size||0),
        });
        if(!attempt||attempt.signature!==signature){
          attempt={signature,projectId:null,coverUploaded:false,versionUploaded:false,submitted:false};
        }
        submit.disabled=true; submit.textContent='正在提交…';
        if(!attempt.projectId){
          const created=await workshopApi.createProject({name,summary,category:'character',tags:['异端库'],dependencies:[]});
          attempt.projectId=created?.project?.id||null;
          if(!attempt.projectId) throw new Error('服务器没有返回作品 ID');
        }
        const id=attempt.projectId;
        if(!attempt.coverUploaded){
          await workshopApi.uploadProjectCover(id,cover);
          attempt.coverUploaded=true;
        }
        if(!attempt.versionUploaded){
          await workshopApi.uploadProjectVersion(id,{changelog:'',bundle:{schema_version:1,artifacts:[{kind:'data',name:'异端角色.json',format:'json',content:asset}]}});
          attempt.versionUploaded=true;
        }
        if(!attempt.submitted){
          await workshopApi.submitProject(id);
          attempt.submitted=true;
        }
        try{host.toastr?.success?.('异端角色已提交审核','创意工坊');}catch{}
        close(); await refreshMine();
      }catch(error){notifyError(error);}
      finally{if(submit?.isConnected){submit.disabled=false;submit.textContent='提交异端审核';}}
    })();
  });
  return {destroy(){}};
}
