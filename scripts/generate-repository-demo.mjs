import {readFileSync,writeFileSync} from 'node:fs';
import {buildPortfolio} from '../dist/enterprise/model.js';
const snapshot=JSON.parse(readFileSync(new URL('../dist/data/simulated-enterprise.json',import.meta.url),'utf8'));
const fleet=buildPortfolio(snapshot);
const files=entries=>Object.entries(entries).map(([path,content])=>({path,content}));
const samples=[];
function add(projectId,environment,label,entries){
  const asset=fleet.assets.find(a=>a.project?.id===projectId&&a.environment===environment&&a.manifest);
  if(!asset)throw Error(`Missing simulated build for ${projectId}/${environment}`);
  samples.push({id:`${projectId}-${environment}`,label,context:{projectId,commit:asset.manifest.commit_sha,source:'gitlab-snapshot',simulated:true,capturedAt:snapshot.snapshot_at},files:files(entries)});
}
add(302,'prod','report-builder · prod build · SBOM missing',{
  '.python-version':'3.11.9\n',
  'requirements.txt':'pandas==2.1.4\nnumpy==1.26.4\nrequests>=2.31,<3\n',
  'Dockerfile':'FROM python:3.11.9-slim AS runtime\nCOPY . /app\n',
});
add(302,'uat','report-builder · UAT build · NumPy SBOM version missing',{
  '.python-version':'3.12.7\n',
  'requirements.txt':'pandas==2.2.3\nnumpy==2.0.2\nrequests==2.32.3\n',
});
add(102,'prod','customer-web · prod build · runtime requirement and lockfile',{
  '.nvmrc':'20.18.0\n',
  'package.json':JSON.stringify({name:'customer-web',engines:{node:'>=18'},dependencies:{react:'^18.3.0'},devDependencies:{vite:'^5.4.0'}},null,2),
  'package-lock.json':JSON.stringify({name:'customer-web',lockfileVersion:3,packages:{'':{name:'customer-web'},'node_modules/react':{version:'18.3.1'},'node_modules/vite':{version:'5.4.8',dev:true}}},null,2),
  'Dockerfile':'FROM node:20.18.0 AS build\nRUN npm ci\nFROM nginx:1.27\nCOPY --from=build /app/dist /usr/share/nginx/html\n',
});
samples.push({id:'302-unbound',label:'report-builder · newer branch commit · no observed deployment',context:{projectId:302,commit:'f'.repeat(40),source:'gitlab-snapshot',simulated:true,capturedAt:snapshot.snapshot_at},files:files({'.python-version':'3.13.0\n','requirements.txt':'numpy==2.1.2\npandas>=2.2\n','pyproject.toml':'[project]\nrequires-python = ">=3.12"\n'})});
writeFileSync(new URL('../dist/data/simulated-repositories.json',import.meta.url),JSON.stringify({schema_version:1,simulated:true,samples},null,2)+'\n');
console.log(`Generated ${samples.length} simulated repository snapshots.`);
