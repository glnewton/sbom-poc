// Conservative comparison: unsupported ecosystem-specific versions stay unknown.
export const runtimes = [
  {id:'python',label:'Python',pattern:/^(?:python(?:[23](?:\.\d+)*)?|cpython|pypy[23]?)(?:-(?:runtime|core|full|minimal))?$/i},
  {id:'node',label:'Node.js',pattern:/^(?:node|nodejs|node\.js)(?:-runtime)?$/i},
  {id:'java',label:'Java / OpenJDK',pattern:/^(?:(?:java|openjdk|jdk|jre|temurin|adoptium|corretto)(?:-?\d+)?(?:-(?:jdk|jre|headless|runtime|hotspot|openjdk|devel))*|java-\d+-openjdk(?:-headless|-devel)?)$/i},
  {id:'dotnet',label:'.NET',pattern:/^(?:dotnet|\.net|aspnetcore|aspnet|microsoft\.netcore\.app|microsoft\.aspnetcore\.app)(?:-(?:runtime|sdk|core))?(?:-\d+(?:\.\d+)*)?$/i},
  {id:'go',label:'Go',pattern:/^(?:go|golang)(?:-\d+(?:\.\d+)*)?(?:-go)?$/i},
  {id:'ruby',label:'Ruby',pattern:/^(?:ruby|jruby)(?:-?\d+(?:\.\d+)*)?(?:-runtime)?$/i},
  {id:'php',label:'PHP',pattern:/^php(?:-?\d+(?:\.\d+)*)?(?:-(?:cli|fpm|common|runtime))?$/i},
  {id:'rust',label:'Rust',pattern:/^(?:rust|rustc)(?:-runtime)?$/i},
];
export const operators = [
  {id:'gte',symbol:'≥',label:'At least (≥)'},
  {id:'lt',symbol:'<',label:'Below (<)'},
  {id:'lte',symbol:'≤',label:'At most (≤)'},
  {id:'gt',symbol:'>',label:'Above (>)'},
  {id:'eq',symbol:'=',label:'Equal (=)'},
  {id:'neq',symbol:'≠',label:'Not equal (≠)'},
  {id:'any',symbol:'',label:'Any version'},
];
export function parseVersion(value,runtime='') {
  if(typeof value!=='string'||!value.trim())return null;
  let text=value.trim().replace(/^v(?=\d)/,'');
  if(runtime==='go')text=text.replace(/^go(?=\d)/,'');
  const match=text.match(/^(0|[1-9]\d*)(\.(?:0|[1-9]\d*))*((?:-[0-9A-Za-z.-]+)?)(\+[0-9A-Za-z.-]+)?$/);
  if(!match)return null;
  const release=text.split('+')[0],dash=release.indexOf('-');
  const main=dash<0?release:release.slice(0,dash),prePart=dash<0?undefined:release.slice(dash+1);
  const nums=main.split('.').map(BigInt);
  let pre=[];
  if(prePart!==undefined){
    // Restrict suffixes to recognizable prereleases rather than interpreting distro revisions.
    if(nums.length!==3||!(/^(?:alpha|beta|rc|pre|preview|dev|next|canary|snapshot)(?:\.[0-9A-Za-z-]+)*$/i.test(prePart)))return null;
    pre=prePart.split('.');
    if(pre.some(x=>/^0\d+$/.test(x)))return null;
  }
  const build=text.includes('+')?text.split('+')[1]:'';
  if(build&&build.split('.').some(x=>!x))return null;
  if(runtime==='java'&&nums.length>=2&&nums[0]===1n&&nums[1]>=1n&&nums[1]<=8n)nums.shift();
  return {nums,pre};
}
export function compareVersions(a,b,runtime='') {
  const x=parseVersion(a,runtime),y=parseVersion(b,runtime);
  if(!x||!y)return null;
  for(let i=0;i<Math.max(x.nums.length,y.nums.length);i++){
    const p=x.nums[i]??0n,q=y.nums[i]??0n;
    if(p!==q)return p<q?-1:1;
  }
  if(!x.pre.length||!y.pre.length)return x.pre.length? -1:y.pre.length?1:0;
  for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
    const p=x.pre[i],q=y.pre[i];
    if(p===q)continue;
    if(p===undefined)return -1;if(q===undefined)return 1;
    const pn=/^\d+$/.test(p),qn=/^\d+$/.test(q);
    if(pn&&qn)return BigInt(p)<BigInt(q)?-1:1;
    if(pn!==qn)return pn?-1:1;
    return p<q?-1:1;
  }
  return 0;
}
export function recordedVersion(component){
  if(typeof component.version==='string'&&component.version.trim())return {value:component.version,source:'Component version'};
  // A scoped purl may contain an @ in its namespace; the version is the final @ suffix.
  const path=String(component.purl||'').split(/[?#]/)[0];
  const at=path.lastIndexOf('@');
  if(at>path.lastIndexOf('/')){
    try {const value=decodeURIComponent(path.slice(at+1));if(value)return {value,source:'Package URL version'};}catch{}
  }
  return {value:'',source:'Not supplied'};
}
export function searchVersions(model,{kind='package',name='',runtime='python',match='contains',operator='gte',target=''}){
  const family=runtimes.find(x=>x.id===runtime);
  const q=name.trim().toLowerCase();
  if(kind==='package'&&!q)return {error:'Enter a package name or package URL.',rows:[]};
  if(kind==='runtime'&&!family)return {error:'Choose a runtime.',rows:[]};
  if(!operators.some(x=>x.id===operator))return {error:'Choose a comparison.',rows:[]};
  if(operator!=='any'&&!parseVersion(target,kind==='runtime'?runtime:''))return {error:'Enter a numeric release such as 3.11 or 4.17.21, or a supported prerelease such as 1.2.3-rc.1.',rows:[]};
  const candidates=model.components.filter(c=>{
    if(kind==='runtime')return family.pattern.test(c.name);
    const names=[c.name,c.group?`${c.group}/${c.name}`:''].map(x=>String(x).toLowerCase());
    const purl=String(c.purl||'').toLowerCase();
    return match==='exact'?names.includes(q)||purl===q:[...names,purl].some(x=>x.includes(q));
  });
  const rows=candidates.map(component=>{
    const version=recordedVersion(component);
    const order=operator==='any'?null:compareVersions(version.value,target,kind==='runtime'?runtime:'');
    let status,reason;
    if(operator==='any'){status='match';reason=version.value?'Recorded component':'Version not supplied; included because any version was selected';}
    else if(order===null){status='unknown';reason=version.value?'Version format needs manual comparison':'Version not supplied';}
    else {const matches={gte:order>=0,gt:order>0,lte:order<=0,lt:order<0,eq:order===0,neq:order!==0};status=matches[operator]?'match':'other';reason=order<0?'Below threshold':order>0?'Above threshold':'Equal to threshold';}
    return {component,version:version.value,source:version.source,order,status,reason};
  }).sort((a,b)=>a.component.name.localeCompare(b.component.name)||a.version.localeCompare(b.version));
  return {error:'',rows,matched:rows.filter(r=>r.status==='match').length,other:rows.filter(r=>r.status==='other').length,unknown:rows.filter(r=>r.status==='unknown').length};
}
