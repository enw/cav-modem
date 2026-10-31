import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files=new Set(['index.html','app.js','modem.js','capture-worklet.js','style.css','browser-check.html']);
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!files.has(name)) { res.writeHead(404);res.end('Not found');return; }
  try { const body=await readFile(new URL(name,import.meta.url)); res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(body); }
  catch { res.writeHead(404);res.end('Not found'); }
});
server.listen(Number(process.env.PORT||8080),'127.0.0.1',()=>console.log(`Modem: http://localhost:${server.address().port}`));
