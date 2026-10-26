import {analyzeRepository,candidatePath,limits,queryRepository,repositoryLinks} from './analyzer.mjs';
import {operators} from '../version-search.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option=(v,label,current)=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`;
const panel=(title,body)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div>${body}</section>`;
export function createRepositoryView({onChange,getFleet,inspectAsset}){
  let samples=[],selected='',analysis=null,loadError='',busy=false,localName='',query={name:'',kind:'all',operator:'any',target:'3.11'};
  function choose(id){const sample=samples.find(s=>s.id===id);if(!sample)return;selected=id;localName='';analysis=analyzeRepository(sample.files,sample.context);}
  function results(){
    if(!analysis)return '<p class="section-note">Choose a simulated commit or select repository files.</p>';
    const result=queryRepository(analysis,query);if(result.error)return `<p class="risk" role="alert">${esc(result.error)}</p>`;
    const rows=result.rows;
    return `<p class="section-note" aria-live="polite">${rows.length} source observations · ${rows.filter(r=>r.status==='match').length} match · ${rows.filter(r=>r.status==='other').length} other · ${rows.filter(r=>r.status==='unknown').length} cannot be compared. ${query.operator==='any'?'All evidence types included.':''} Showing up to 200 rows; export includes all filtered results.</p><div class="table-wrap"><table><thead><tr><th>Component / version</th><th>Precision / result</th><th>Scope</th><th>File / location</th></tr></thead><tbody>${rows.slice(0,200).map(r=>`<tr><td><strong>${esc(r.component)}</strong><small class="exact-version">${esc(r.version||'Unresolved')}</small></td><td><span class="tag ${r.precision==='exact'?'':'medium'}">${esc(r.precision)}</span> <span class="tag ${r.status==='unknown'?'medium':''}">${esc(r.status)}</span></td><td>${esc(r.scope)}<small>${esc(r.reason)}</small></td><td><code>${esc(r.path)}</code><small>${esc(r.locator)}</small></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No matching source records. This does not establish that the component is absent.</td></tr>'}</tbody></table></div>`;
  }
  function render(){
    const links=analysis?repositoryLinks(analysis,getFleet()?.assets||[]):[],c=analysis?.context;
    return `<div class="simulation-banner"><span class="simulation-pill">${c?.simulated?'SIMULATED SNAPSHOT':'LOCAL ANALYSIS'}</span><span>Repository evidence · no code execution</span></div>`+panel('Analyze repository evidence',`<p class="section-note">Fill gaps using runtime selections, dependency declarations, lockfiles, and base-image references. Findings describe source files; a matching build commit connects the evidence to an asset without proving what executes there.</p><div class="repository-controls"><label>Simulated GitLab commit<select id="repo-sample">${option('','Choose a snapshot',selected)}${samples.map(s=>option(s.id,s.label,selected)).join('')}</select></label><div class="repository-import"><label class="button" for="repo-directory">Choose local folder</label><input id="repo-directory" class="repository-file" type="file" webkitdirectory multiple><label class="button" for="repo-files">Choose manifest files</label><input id="repo-files" class="repository-file" type="file" multiple></div></div><p class="footnote">Local files stay in this browser session. Select a checked-out repository; only recognized manifest/configuration files are read. Up to 500 recognized files, 2 MB per file, 10 MB total. Git history, dependencies, and virtual environments are skipped. No URL cloning or live GitLab connection is configured.</p>${busy?'<p role="status">Reading selected repository files…</p>':''}${loadError?`<p class="risk" role="alert">${esc(loadError)}</p>`:''}`)+
      (analysis?panel('Source and deployment context',`<div class="section-note"><strong>${c.simulated?'Simulated GitLab source snapshot':esc(localName||'Local repository files')}</strong><p>Project: ${esc(c.projectId||'Unverified')} · Commit: <code>${esc(c.commit||'Not verified for local files')}</code></p><p>${analysis.inspected} recognized files inspected · ${analysis.findings.length} observations · ${analysis.diagnostics.length} collection/parser notices.</p>${links.length?`<p>${links.length} observed workload(s) link to this project and build commit. Source pins remain distinct from deployed versions.</p><div class="detail-list">${links.map(a=>`<button class="button" data-repo-asset="${esc(a.id)}">${esc(a.app?.name)} · ${esc(a.service)} · ${esc(a.environment.toUpperCase())}</button>`).join('')}</div>`:'<p class="risk">No verified link to an observed deployment. These files cannot establish a version in DEV, UAT, or PROD.</p>'}</div>`):'')+
      panel('Search derived versions',`<form id="repo-query" class="version-fields"><label>Component name<input id="repo-name" value="${esc(query.name)}" placeholder="e.g. python, numpy, react"></label><label>Type<select id="repo-kind">${[['all','All components'],['runtime','Runtime'],['package','Library / package']].map(([v,l])=>option(v,l,query.kind)).join('')}</select></label><label>Version condition<select id="repo-operator">${operators.map(o=>option(o.id,o.label,query.operator)).join('')}</select></label><label>Threshold<input id="repo-target" value="${esc(query.target)}" ${query.operator==='any'?'disabled':''}></label><button type="submit" class="button primary">Search source evidence →</button></form><p class="footnote">Threshold comparisons use exact source pins and lock entries. Requirements, families, image hints, and unresolved references remain Unknown. Different directories and dependency scopes are retained; conflicting versions are never silently merged.</p><div id="repo-results">${results()}</div><div class="toolbar"><button class="button" id="repo-export" ${!analysis?'disabled':''}>↓ Export source evidence</button></div>`)+
      (analysis?.diagnostics.length?panel('Collection and parser notices',`<ul class="repository-notices">${analysis.diagnostics.map(d=>`<li><code>${esc(d.path)}</code>: ${esc(d.message)}</li>`).join('')}</ul>`):'')+
      panel('Supported source files',`<p class="section-note"><code>.python-version</code>, <code>.nvmrc</code>, <code>.node-version</code>, <code>.ruby-version</code>, <code>.tool-versions</code>, <code>package.json</code>, npm lockfiles v1–v3, <code>requirements*.txt</code>, <code>go.mod</code>, and Dockerfiles. Common unsupported manifests produce notices. This is bounded file analysis, not a dependency resolver or a complete repository audit.</p>`);
  }
  async function readLocal(list){
    if(busy)return;busy=true;loadError='';onChange();
    const all=Array.from(list),candidates=all.filter(f=>candidatePath(f.webkitRelativePath||f.name));
    const files=[],notices=[];let total=0;
    try{
      if(candidates.length>limits.files)notices.push({path:'Selection',message:'More than 500 recognized files; only the first 500 were considered.'});
      for(const f of candidates.slice(0,limits.files)){
        const path=f.webkitRelativePath||f.name;
        if(f.size>limits.fileBytes||total+f.size>limits.totalBytes){notices.push({path,message:'Size limit exceeded; file skipped.'});continue;}
        total+=f.size;
        try{files.push({path,content:await f.text()});}catch{notices.push({path,message:'File could not be read.'});}
      }
      analysis=analyzeRepository(files,{source:'local',simulated:false});analysis.diagnostics.push(...notices);
      if(!candidates.length)analysis.diagnostics.push({path:'Selection',message:'No recognized manifest/configuration files found.'});
      selected='';localName=all[0]?.webkitRelativePath?.split('/')[0]||'Selected local files';
    }catch{loadError='Unable to read the selected files.';}finally{busy=false;onChange();}
  }
  function exportRows(){
    if(!analysis)return;const result=queryRepository(analysis,query);if(result.error)return;
    const payload={schema_version:1,evidenceScope:'repository-source; not deployed-version attestation',context:analysis.context,query,findings:result.rows,diagnostics:analysis.diagnostics,linkedAssets:repositoryLinks(analysis,getFleet()?.assets||[]).map(a=>({id:a.id,application:a.app?.name,environment:a.environment,commit:a.manifest.commit_sha}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='repository-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bind(){
    const $=s=>document.querySelector(s);$('#repo-sample')?.addEventListener('change',e=>{choose(e.target.value);onChange();});
    for(const id of ['#repo-directory','#repo-files'])$(id)?.addEventListener('change',e=>readLocal(e.target.files));
    const readQuery=()=>{query={name:$('#repo-name').value,kind:$('#repo-kind').value,operator:$('#repo-operator').value,target:$('#repo-target').value};};
    $('#repo-query')?.addEventListener('submit',e=>{e.preventDefault();readQuery();onChange();});
    $('#repo-query')?.addEventListener('input',()=>{readQuery();$('#repo-target').disabled=query.operator==='any';$('#repo-results').innerHTML=results();});
    $('#repo-export')?.addEventListener('click',exportRows);
    document.querySelectorAll('[data-repo-asset]').forEach(b=>b.onclick=()=>inspectAsset(b.dataset.repoAsset));
  }
  return {render,bind,export:exportRows,
    async load(){try{const r=await fetch(new URL('../data/simulated-repositories.json',import.meta.url));if(!r.ok)throw Error('Repository samples unavailable. Local analysis is still available.');const data=await r.json();if(data.schema_version!==1||!data.simulated)throw Error('Invalid repository sample format.');samples=data.samples;choose(samples[0]?.id);}catch(e){loadError=e.message;}},
    assetSummary(asset){const found=samples.filter(s=>s.context.projectId===asset.project?.id&&s.context.commit===asset.manifest?.commit_sha);return `<h3>Repository fallback evidence</h3><p>${found.length?'Source files are available for this exact build commit. Analyze them for missing runtime or library records.':'No repository snapshot is linked to this observed build. You can inspect local files separately.'}</p><button class="button" id="inspect-repository" ${found.length?`data-sample="${esc(found[0].id)}"`:''}>Review repository evidence →</button>`;},
    openSample(id){if(id)choose(id);document.querySelector('#details')?.close();location.hash='repository';onChange();},
  };
}
