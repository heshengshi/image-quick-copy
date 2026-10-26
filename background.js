'use strict';
importScripts('core.js');
const {imageURL,webURL,ImageCache}=ImageCopyCore;
const cache=new ImageCache(8);
const MAX_BYTES=15*1024*1024;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id || !sender.tab || !(webURL(sender.url)||webURL(sender.origin)||sender.url==='about:blank') || msg?.type!=='prepare' || !imageURL(msg.url))return;
  const url=imageURL(msg.url);
  cache.get(url,()=>prepare(url)).then(value=>reply({ok:true,url,...value}),error=>reply({ok:false,url,error:error.name==='AbortError'?'图片加载超时':error.message||'图片准备失败'}));
  return true;
});
async function prepare(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(url,{credentials:'omit',redirect:'error',cache:'force-cache',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok)throw new Error('图片请求失败：'+response.status);
    const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!/^image\/(png|jpeg|webp|avif|gif|bmp|x-ms-bmp|x-icon|vnd.microsoft.icon)$/.test(mime))throw new Error('此图片类型暂不能转换');
    if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('图片超过 15 MB');
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES){await reader.cancel();throw new Error('图片超过 15 MB');}chunks.push(value);}
    }finally{reader.releaseLock();}
    const bitmap=await createImageBitmap(new Blob(chunks,{type:mime}));
    try{
      if(bitmap.width*bitmap.height>30000000)throw new Error('图片尺寸过大');
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
      canvas.getContext('2d').drawImage(bitmap,0,0);
      const png=await canvas.convertToBlob({type:'image/png'});
      if(png.size>MAX_BYTES)throw new Error('转换后的 PNG 超过 15 MB');
      const bytes=new Uint8Array(await png.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return {base64:btoa(binary),width:bitmap.width,height:bitmap.height};
    }finally{bitmap.close();}
  }finally{clearTimeout(timer);}
}
