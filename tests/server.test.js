import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../tools/serve.js';
function request(url,method='GET'){return new Promise(resolve=>{let status,headers;handleRequest({url,method},{writeHead(s,h){status=s;headers=h;},end(body){resolve({status,headers,body});}});});}
test('Malformed percent encoding returns 400 instead of crashing the server',async()=>{assert.equal((await request('/%ZZ')).status,400);assert.equal((await request('/%00')).status,400);assert.equal((await request('/')).status,200);});
test('Static server limits methods and serves local art with correct MIME',async()=>{assert.equal((await request('/','POST')).status,405);assert.equal((await request('/not-here')).status,404);const image=await request('/assets/neighborhood.webp');assert.equal(image.status,200);assert.equal(image.headers['Content-Type'],'image/webp');assert.ok(image.body.length>10000);assert.equal((await request('/','HEAD')).body,undefined);});
