const {test}=require('node:test');
const assert=require('node:assert/strict');
const {imageURL,copyKey,editingNode,ImageCache,LatestCopyQueue}=require('../core.js');
test('image requests reject local networks, credentials and non-web URLs',()=>{
 for(const url of ['file:///tmp/a.png','https://secret@example.com/a','http://localhost/a','http://127.1/a','http://192.168.1.1/a','http://[::1]/a','http://10.0.0.1/a'])assert.equal(imageURL(url),null,url);
 assert.equal(imageURL('https://i.pinimg.com/736x/a.jpg#x'),'https://i.pinimg.com/736x/a.jpg');
});
test('normal copy shortcut only; editors keep their native behavior',()=>{
 assert.ok(copyKey({key:'c',metaKey:true}));assert.ok(copyKey({key:'C',ctrlKey:true}));
 for(const event of [{key:'c'},{key:'v',metaKey:true},{key:'c',metaKey:true,shiftKey:true},{key:'c',ctrlKey:true,repeat:true}])assert.ok(!copyKey(event));
 assert.ok(editingNode({nodeType:1,isContentEditable:true}));
 assert.ok(editingNode({nodeType:1,closest:()=>({})}));
 assert.ok(!editingNode({nodeType:1,closest:()=>null}));
});
test('concurrent hover and key share work; different images remain separate',async()=>{
 const c=new ImageCache(2);let count=0,finish;
 const a=c.get('a',()=>{count++;return new Promise(r=>finish=r)});
 assert.equal(c.get('a',()=>assert.fail()),a);
 assert.equal(await c.get('b',()=> 'image-b'),'image-b');finish('image-a');assert.equal(await a,'image-a');assert.equal(count,1);
 await c.get('c',()=> 'image-c');assert.equal(c.entries.size,2);
});
test('failed image can be retried without returning old data',async()=>{
 const c=new ImageCache(2);await assert.rejects(c.get('a',()=>Promise.reject(new Error('timeout'))));
 assert.equal(await c.get('a',()=> 'fresh-image'),'fresh-image');
});
test('latest copy bypasses a hung previous preparation and never writes the old image',async()=>{
 const q=new LatestCopyQueue(),written=[];let finish;
 const old=q.copy(()=>new Promise(r=>finish=r),blob=>written.push(blob));
 await Promise.resolve();await Promise.resolve();
 const latest=q.copy(()=> 'new-image',blob=>written.push(blob));
 assert.deepEqual(await latest,{superseded:false});assert.deepEqual(await old,{superseded:true});
 finish('old-image');await Promise.resolve();assert.deepEqual(written,['new-image']);
});
test('clipboard writes remain serial even when switching images during a write',async()=>{
 const q=new LatestCopyQueue(),written=[];let release,started;
 const began=new Promise(r=>started=r);
 const a=q.copy(()=> 'a',async blob=>{written.push(blob);started();await new Promise(r=>release=r)});
 await began;const b=q.copy(()=> 'b',blob=>written.push(blob));release();
 await Promise.all([a,b]);assert.deepEqual(written,['a','b']);
});
