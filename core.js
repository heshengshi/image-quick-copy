(() => {
  'use strict';
  function imageURL(raw) {
    try {
      if(typeof raw!=='string' || raw.length>8192) return null;
      const u=new URL(raw);
      if(!['http:','https:'].includes(u.protocol) || u.username || u.password) return null;
      const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
      // The network worker is for public image URLs, not a private-network proxy.
      if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||!h.includes('.')||h.includes(':')) return null;
      if(/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
        const [a,b]=h.split('.').map(Number);
        if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127) return null;
      }
      u.hash=''; return u.href;
    } catch {return null;}
  }
  function webURL(raw) {try{return ['http:','https:'].includes(new URL(raw).protocol);}catch{return false;}}
  function copyKey(event) {
    return event.key?.toLowerCase()==='c' && Boolean(event.metaKey||event.ctrlKey) && !event.altKey && !event.shiftKey && !event.repeat;
  }
  function editingNode(node) {
    if(!node || node.nodeType!==1) return false;
    return Boolean(node.isContentEditable || node.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="searchbox"],.monaco-editor,.CodeMirror,.cm-editor'));
  }
  class ImageCache {
    constructor(limit=8,ttl=120000){this.limit=limit;this.ttl=ttl;this.entries=new Map();}
    get(key,load){
      const old=this.entries.get(key);
      if(old && Date.now()-old.at<this.ttl){this.entries.delete(key);this.entries.set(key,old);return old.promise;}
      const entry={at:Date.now(),promise:null};
      entry.promise=Promise.resolve().then(load).catch(error=>{if(this.entries.get(key)===entry)this.entries.delete(key);throw error;});
      this.entries.set(key,entry);
      while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);
      return entry.promise;
    }
  }
  class LatestCopyQueue {
    constructor(){this.latest=0;this.tail=Promise.resolve();this.cancel=null;}
    copy(prepare,write){
      const id=++this.latest;
      this.cancel?.();
      const cancelled=new Promise(resolve=>{this.cancel=()=>resolve({cancelled:true});});
      const ready=Promise.resolve().then(prepare);
      ready.catch(()=>{});
      const result=this.tail.catch(()=>{}).then(async()=>{
        if(id!==this.latest)return {superseded:true};
        const result=await Promise.race([ready.then(blob=>({blob})),cancelled]);
        if(result.cancelled)return {superseded:true};
        const blob=result.blob;
        if(id!==this.latest)return {superseded:true};
        await write(blob);
        return {superseded:id!==this.latest};
      });
      this.tail=result.catch(()=>{}); return result;
    }
  }
  const api=Object.freeze({imageURL,webURL,copyKey,editingNode,ImageCache,LatestCopyQueue});
  globalThis.ImageCopyCore=api;
  if(typeof module!=='undefined')module.exports=api;
})();
