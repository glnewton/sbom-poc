import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeRepository,queryRepository,repositoryLinks,candidatePath,limits} from './dist/repository/analyzer.mjs';
import {buildPortfolio,queryPortfolio} from './dist/enterprise/model.js';
const analyze=entries=>analyzeRepository(Object.entries(entries).map(([path,content])=>({path,content})));
const result=analyze({
  '.python-version':'3.11.9\n', '.nvmrc':'lts/*\n', 'svc/.node-version':'20\n',
  '.tool-versions':'python 3.12.7 3.11.9\nnodejs 20.18.0\n',
  'package.json':JSON.stringify({engines:{node:'>=18'},dependencies:{react:'^18.3.0',axios:'1.7.7','local':'workspace:*'},devDependencies:{vite:'5.4.8'}}),
  'package-lock.json':JSON.stringify({lockfileVersion:3,packages:{'':{name:'app'},'node_modules/@scope/pkg':{version:'2.4.1'},'node_modules/vite':{version:'5.4.8',dev:true},'node_modules/workspace':{link:true,resolved:'packages/workspace'}}}),
  'requirements.txt':'Requests==2.32.3\nnumpy>=1.26,<3\nuvloop==0.21.0; sys_platform != "win32"\n-r private.txt\nfoo==1.*\n',
  'go.mod':'module example.com/app\ngo 1.22.0\ntoolchain go1.23.2\nrequire (\n example.com/pkg v1.2.3\n)\nreplace example.com/pkg => ../pkg\n',
  'Dockerfile':'FROM node:20.18.0 AS build\nFROM nginx:1.27\n',
  'pyproject.toml':'[project]\nrequires-python=">=3.11"',
});
const find=(name,path)=>result.findings.find(f=>f.component===name&&(!path||f.path===path));
assert.equal(find('python','.python-version').precision,'exact');
assert.equal(find('node','.nvmrc').precision,'unresolved');
assert.equal(find('node','svc/.node-version').precision,'family');
assert.equal(find('node','package.json').precision,'constraint');
assert.equal(find('react').precision,'constraint');
assert.equal(find('axios').precision,'exact');
assert.equal(find('@scope/pkg').version,'2.4.1');
assert.equal(find('@scope/pkg').locator,'/packages/node_modules~1@scope~1pkg/version');
assert.equal(find('workspace').precision,'unresolved');
assert.equal(find('requests').version,'2.32.3');
assert.equal(find('requests').expression,'==2.32.3');
assert.equal(find('uvloop').scope,'conditional requirement');
assert.equal(find('foo').precision,'constraint');
assert.equal(find('go').precision,'constraint');
assert.equal(find('example.com/pkg').precision,'constraint');
assert.equal(find('node','Dockerfile').precision,'hint');
assert.ok(result.diagnostics.some(d=>d.path==='pyproject.toml'));
assert.ok(result.diagnostics.some(d=>d.message.includes('directive')));
assert.ok(result.diagnostics.some(d=>d.message.includes('replacement')));
const q=queryRepository(result,{name:'node',operator:'gte',target:'20'});
assert.equal(q.error,'');assert.ok(q.rows.some(r=>r.status==='match'));assert.ok(q.rows.some(r=>r.status==='unknown'));assert.ok(q.rows.filter(r=>r.precision!=='exact').every(r=>r.status==='unknown'));
assert.ok(queryRepository(result,{operator:'lt',target:'bad'}).error);
assert.equal(queryRepository(result,{name:'axios',operator:'lt',target:'1.8'}).rows[0].status,'match');
assert.equal(queryRepository(result,{name:'axios',operator:'gt',target:'2'}).rows[0].status,'other');
assert.equal(queryRepository(result,{name:'absent'}).rows.length,0);
const conflict=analyze({'api/.python-version':'3.11.9','worker/.python-version':'3.12.7'});
assert.equal(conflict.findings.length,2);assert.notEqual(conflict.findings[0].directory,conflict.findings[1].directory);
assert.equal(analyze({'package.json':'{broken'}).diagnostics.length,1);
assert.equal(analyze({'package-lock.json':'{"lockfileVersion":99}'}).findings.length,0);
assert.equal(analyze({'package-lock.json':JSON.stringify({lockfileVersion:1,dependencies:{a:{version:'1.2.3',dependencies:{b:{version:'2.3.4'}}}}})}).findings.length,2);
assert.equal(candidatePath('.git/package.json'),false);assert.equal(candidatePath('node_modules/a/package.json'),false);assert.equal(candidatePath('src/__proto__'),false);
assert.equal(analyze({'package.json':' '.repeat(limits.fileBytes+1)}).diagnostics.length,1);
assert.ok(analyzeRepository(Array.from({length:501},(_,i)=>({path:`${i}/.python-version`,content:'3.11.9'}))).diagnostics.some(d=>d.message.includes('count limit')));
const fleet=buildPortfolio(JSON.parse(readFileSync('dist/data/simulated-enterprise.json','utf8')));
const samples=JSON.parse(readFileSync('dist/data/simulated-repositories.json','utf8')).samples;
const prod=samples.find(s=>s.id==='302-prod'),source=analyzeRepository(prod.files,prod.context);
const assets=repositoryLinks(source,fleet.assets);
assert.ok(assets.length);assert.ok(assets.every(a=>a.environment==='prod'&&a.coverage==='gap'));
assert.equal(repositoryLinks({...source,context:{...source.context,source:'local'}},fleet.assets).length,0);
assert.equal(repositoryLinks({...source,context:{...source.context,projectId:999}},fleet.assets).length,0);
const branch=samples.find(s=>s.id==='302-unbound');assert.equal(repositoryLinks(analyzeRepository(branch.files,branch.context),fleet.assets).length,0);
const deployed=queryPortfolio(fleet,{projectId:'302',environment:'prod',kind:'runtime',runtime:'python',operator:'gte',target:'3.11'});
assert.equal(deployed.matched,0);assert.ok(deployed.unknown>0);
assert.ok(queryRepository(source,{name:'python',operator:'gte',target:'3.11'}).rows.some(r=>r.status==='match'));
console.log('Repository checks passed: parsers, precision, constraints, scope, diagnostics, limits, conservative comparison, commit links, and unchanged deployed Unknowns.');
