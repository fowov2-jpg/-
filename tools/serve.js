import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../web/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.json':'application/json; charset=utf-8'};
export function handleRequest(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 let file;
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.includes('\0'))throw Error();file=path.resolve(root,'.'+(name==='/'?'/index.html':name));}
 catch{res.writeHead(400);res.end('Bad request');return;}
 if(!file.startsWith(root)){res.writeHead(403);res.end('Forbidden');return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 });
}
export function createServer(){return http.createServer(handleRequest);}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createServer();server.on('error',err=>{console.error('Не удалось запустить сервер:',err.message);process.exitCode=1;});
 server.listen(4173,'0.0.0.0',()=>console.log('Управдом: http://localhost:4173'));
}
