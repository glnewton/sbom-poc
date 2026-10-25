import assert from 'node:assert/strict';
import {normalize} from './dist/engine.mjs';
import {parseVersion,compareVersions,recordedVersion,searchVersions} from './dist/version-search.mjs';
assert.equal(compareVersions('3.10.2','3.9.9'),1);
assert.equal(compareVersions('3.11','3.11.0'),0);
assert.equal(compareVersions('v20.1.0','20'),1);
assert.equal(compareVersions('1.2.3-rc.1','1.2.3'),-1);
assert.equal(compareVersions('1.2.3-rc.10','1.2.3-rc.2'),1);
assert.equal(compareVersions('1.2.3-alpha','1.2.3-beta'),-1);
assert.equal(compareVersions('1.2.3+build.1','1.2.3+build.2'),0);
assert.equal(compareVersions('99999999999999999999','99999999999999999998'),1);
assert.equal(compareVersions('go1.22.1','1.22','go'),1);
assert.equal(compareVersions('1.8.0','8','java'),0);
assert.equal(compareVersions('1.8.0','8'),-1);
for(const v of ['','^3.11','>=3.11','3.x','1:3.11.2','3.11.2-1ubuntu1','3.11.0rc1','1.2.3-alpine','1.2.3-1','1.2.3-rc.01','1.2.3+bad..build','01.2.3'])assert.equal(parseVersion(v),null,v);
assert.equal(recordedVersion({version:'',purl:'pkg:npm/@scope/pkg@1.2.3'}).value,'1.2.3');
assert.equal(recordedVersion({version:'2',purl:'pkg:npm/pkg@1'}).value,'2');
assert.equal(recordedVersion({purl:'pkg:npm/@scope/pkg'}).value,'');
const raw={bomFormat:'CycloneDX',specVersion:'1.5',metadata:{component:{'bom-ref':'app',name:'app',version:'1'}},components:[
 {'bom-ref':'p1',name:'python',version:'3.9.18'},
 {'bom-ref':'p2',name:'python3',version:'3.11.2'},
 {'bom-ref':'p3',name:'python3.11-minimal',version:'3.11.2-1ubuntu1'},
 {'bom-ref':'p4',name:'python',version:''},
 {'bom-ref':'lib',name:'python-helper',version:'99'},
 {'bom-ref':'lib2',name:'requests',version:'2',purl:'pkg:pypi/requests@2'},
 {'bom-ref':'l1',name:'lodash',version:'4.17.20'},
 {'bom-ref':'l2',name:'lodash',version:'4.17.21'},
 {'bom-ref':'l3',name:'lodash-es',version:'4.17.20'},
 {'bom-ref':'l4',name:'fallback',purl:'pkg:npm/fallback@2.0.0'},
 {'bom-ref':'j',name:'openjdk-17-jre-headless',version:'17.0.8'},
 {'bom-ref':'scoped',name:'pkg',group:'@scope',version:'1.2.3'},
],dependencies:[{ref:'app',dependsOn:['p2','l1']}]};
const m=normalize(raw);
const params={kind:'runtime',runtime:'python',operator:'gte',target:'3.11'};
const r=searchVersions(m,params);assert.equal(r.rows.length,4);assert.equal(r.matched,1);assert.equal(r.other,1);assert.equal(r.unknown,2);
assert.equal(searchVersions(m,{...params,operator:'neq'}).matched,2);
assert.equal(searchVersions(m,{...params,operator:'any',target:''}).matched,4);
assert.equal(searchVersions(m,{...params,runtime:'node'}).rows.length,0);
assert.equal(searchVersions(m,{...params,runtime:'java',target:'17'}).matched,1);
assert.equal(searchVersions(m,{...params,target:'latest'}).rows.length,0);
assert(searchVersions(m,{...params,target:'latest'}).error);
const pkg={kind:'package',name:'lodash',match:'exact',operator:'lt',target:'4.17.21'};
assert.equal(searchVersions(m,pkg).rows.length,2);assert.equal(searchVersions(m,pkg).matched,1);
assert.equal(searchVersions(m,{...pkg,match:'contains'}).rows.length,3);
assert.equal(searchVersions(m,{...pkg,name:'@scope/pkg',target:'2'}).matched,1);
assert.equal(searchVersions(m,{...pkg,name:'fallback',operator:'gte',target:'2'}).matched,1);
assert.equal(searchVersions(m,{...pkg,name:'',operator:'any'}).rows.length,0);
for(const [operator,n]of [['lt',1],['lte',2],['gt',0],['gte',1],['eq',1],['neq',1]])assert.equal(searchVersions(m,{...pkg,operator}).matched,n,operator);
const spdx=normalize({spdxVersion:'SPDX-2.3',name:'java-app',packages:[{SPDXID:'java',name:'openjdk',versionInfo:'21.0.1'}]});
assert.equal(searchVersions(spdx,{kind:'runtime',runtime:'java',operator:'gte',target:'21'}).matched,1);
console.log('Version search checks passed: numeric ordering, prereleases, runtime aliases, exact/partial names, package URLs, all comparisons, missing and unsupported versions, CycloneDX and SPDX.');
