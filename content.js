(() => {
  'use strict';
  if(globalThis.__IMAGE_QUICK_COPY_V020__)return;
  globalThis.__IMAGE_QUICK_COPY_V020__=true;
  const {imageURL,copyKey,editingNode,ImageCache,LatestCopyQueue}=ImageCopyCore;
  const cache=new ImageCache(8),queue=new LatestCopyQueue();
  let point=null,prefetchTimer,lastCheck=0,lastTarget=null,toast,toastTimer,pressId=0;
  const within=(r,p)=>r.width>0&&r.height>0&&p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;
  function imageTarget(image){
    if(image.tagName!=='IMG'||!image.complete||!image.naturalWidth)return null;
    const src=image.currentSrc||image.src;
    if(!src)return null;
    return {kind:'img',element:image,url:src,key:'img:'+src};
  }
  function targetAt(p){
    if(!p || p.x<0||p.y<0||p.x>=innerWidth||p.y>=innerHeight)return null;
    const stack=document.elementsFromPoint(p.x,p.y).filter(el=>el!==toast);
    for(const el of stack){
      if(el.tagName==='IMG'){const t=imageTarget(el);if(t)return t;}
      if(el.tagName==='CANVAS' && el.width && el.height)return {kind:'canvas',element:el,key:null};
      // Find images covered by a link/button layer, including Pinterest cards.
      const card=el.closest?.('a,[data-test-id="pinWrapper"],[data-test-id="pin"],picture,figure');
      if(card){
        const images=[...card.querySelectorAll('img')].slice(0,48).filter(img=>within(img.getBoundingClientRect(),p));
        for(const img of images){const t=imageTarget(img);if(t)return t;}
      }
    }
    // An overlay may sit in a sibling branch above an otherwise visible image.
    const seen=new Set();
    for(const el of stack.slice(0,5)){
      const parent=el.parentElement;
      if(parent && !seen.has(parent) && !['BODY','HTML'].includes(parent.tagName)){
        seen.add(parent);
        for(const img of [...parent.querySelectorAll('img')].slice(0,48)){
          if(within(img.getBoundingClientRect(),p)){const t=imageTarget(img);if(t)return t;}
        }
      }
    }
    for(const el of stack.slice(0,6)){
      const bg=getComputedStyle(el).backgroundImage;
      const match=bg.match(/^url\(["']?(.*?)["']?\)$/);
      if(match && imageURL(match[1]))return {kind:'background',element:el,url:match[1],key:'bg:'+match[1]};
    }
    return null;
  }
  function canvasBlob(source){
    return new Promise((resolve,reject)=>{
      const w=source.naturalWidth||source.width,h=source.naturalHeight||source.height;
      if(!w||!h||w*h>30000000){reject(new Error('图片尺寸不支持'));return;}
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      try{
        canvas.getContext('2d').drawImage(source,0,0,w,h);
        canvas.toBlob(blob=>blob&&blob.size<=15*1024*1024?resolve(blob):reject(new Error('图片过大或无法读取')),'image/png');
      }catch(error){reject(error);}
    });
  }
  async function load(t){
    if(t.kind==='img'||t.kind==='canvas'){
      try{return await canvasBlob(t.element);}catch(error){if(t.kind==='canvas')throw new Error('网页限制了这张画布图片的读取');}
    }
    const url=imageURL(t.url);
    if(!url)throw new Error('这张图片无法直接读取');
    const reply=await chrome.runtime.sendMessage({type:'prepare',url});
    if(!reply?.ok||reply.url!==url)throw new Error(reply?.error||'图片准备失败');
    const binary=atob(reply.base64),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:'image/png'});
  }
  function prepare(t){return t.key?cache.get(t.key,()=>load(t)):load(t);}
  function message(kind,text){
    clearTimeout(toastTimer);
    if(!toast){
      toast=document.createElement('div');toast.id='image-quick-copy-status';
      toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
      toast.style.cssText='all:initial;position:fixed;z-index:2147483647;bottom:22px;left:50%;transform:translateX(-50%);max-width:75vw;padding:10px 15px;border-radius:10px;box-shadow:0 3px 18px #0003;color:white;font:500 13px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none;';
      (document.documentElement||document).appendChild(toast);
    }
    toast.style.display='block';toast.style.background=kind==='error'?'#a51e2c':kind==='success'?'#087344':'#233242';
    toast.dataset.state=kind;toast.textContent=text;
    if(kind!=='copying')toastTimer=setTimeout(()=>{toast.style.display='none';},kind==='error'?3500:1300);
  }
  function nativeCopyWanted(event){
    if(document.designMode==='on' || event.composedPath().some(editingNode))return true;
    let active=document.activeElement;
    while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;
    if(editingNode(active))return true;
    const selection=window.getSelection();
    return Boolean(selection && !selection.isCollapsed);
  }
  function maybePrepare(){
    const t=targetAt(point);
    if(!t || t.kind==='canvas'){lastTarget=null;return;}
    if(lastTarget?.element===t.element&&lastTarget.key===t.key)return;
    lastTarget=t;clearTimeout(prefetchTimer);
    prefetchTimer=setTimeout(()=>prepare(t).catch(()=>{}),85);
  }
  window.addEventListener('pointermove',event=>{
    if(!event.isTrusted)return;
    point={x:event.clientX,y:event.clientY};
    const now=performance.now();if(now-lastCheck<90)return;
    lastCheck=now;maybePrepare();
  },{capture:true,passive:true});
  window.addEventListener('pointerover',event=>{
    if(!event.isTrusted)return;point={x:event.clientX,y:event.clientY};maybePrepare();
  },{capture:true,passive:true});
  document.addEventListener('mouseleave',event=>{if(event.target===document.documentElement){point=null;lastTarget=null;clearTimeout(prefetchTimer);}},true);
  window.addEventListener('scroll',()=>{lastTarget=null;clearTimeout(prefetchTimer);},{passive:true});
  window.addEventListener('keydown',event=>{
    if(!event.isTrusted || !copyKey(event) || event.defaultPrevented || nativeCopyWanted(event))return;
    // Recompute on every shortcut; never reuse a stale hover target.
    const target=targetAt(point);if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    const selected=Object.freeze({...target}),id=++pressId,began=performance.now();
    message('copying','正在复制图片…');
    queue.copy(()=>prepare(selected),blob=>navigator.clipboard.write([new ClipboardItem({'image/png':blob})])).then(result=>{
      if(result.superseded||id!==pressId)return;
      const ms=Math.round(performance.now()-began);
      message('success','✓ 图片已复制');
      toast.dataset.source=selected.url||'canvas';toast.dataset.elapsedMs=String(ms);toast.dataset.error='';
    }).catch(error=>{
      if(id!==pressId)return;
      message('error','未复制，请勿粘贴旧图 · '+(error.message||'请重试'));
      toast.dataset.error=String(error.message||error);
    });
  },true);
})();
