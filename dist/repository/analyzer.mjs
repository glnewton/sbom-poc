import {compareVersions,parseVersion,operators} from '../version-search.mjs';

export const limits={files:500,fileBytes:2*1024*1024,totalBytes:10*1024*1024};
const unsupported=/^(?:pyproject\.toml|poetry\.lock|uv\.lock|Pipfile(?:\.lock)?|yarn\.lock|pnpm-lock\.yaml|pom\.xml|build\.gradle(?:\.kts)?|Cargo\.(?:toml|lock)|Gemfile(?:\.lock)?|composer\.(?:json|lock)|global\.json|.*\.csproj)$/i;
const pins={'.python-version':'python','.node-version':'node','.nvmrc':'node','.ruby-version':'ruby'};
const base=path=>path.split('/').at(-1);
export function candidatePath(path){return !/(^|\/)(?:\.git|node_modules|vendor|\.venv|venv|\.next)(\/|$)/.test(path)&&!!(Object.hasOwn(pins,base(path))||/^(?:package(?:-lock)?\.json|requirements[^/]*\.txt|go\.mod|\.tool-versions|Dockerfile(?:\..*)?)$/i.test(base(path))||unsupported.test(base(path)));}
const pointer=s=>String(s).replace(/~/g,'~0').replace(/\//g,'~1');
const exact=v=>typeof v==='string'&&/^v?\d+(?:\.\d+)+(?:[-+][\w.-]+)?$/.test(v);
function precision(value,kind){if(kind==='runtime'&&/^v?\d+(?:\.\d+)?$/.test(value))return 'family';return exact(value)?kind==='runtime'&&value.replace(/^v/,'').split(/[+-]/)[0].split('.').length<3?'family':'exact':/^(?:[<>=~^!]|\d.*[xX*|])/.test(value)?'constraint':'unresolved';}

// Text-only inspection. Never runs package managers, scripts, Docker, or includes.
export function analyzeRepository(files,context={}){
  const findings=[],diagnostics=[];let bytes=0,inspected=0;
  for(const file of files){
    const path=String(file.path||'').replace(/\\/g,'/');
    if(!candidatePath(path))continue;
    if(inspected>=limits.files){diagnostics.push({path,message:'File count limit reached; analysis is incomplete.'});break;}
    inspected++;
    const content=typeof file.content==='string'?file.content:'',size=new TextEncoder().encode(content).length;
    if(size>limits.fileBytes||bytes+size>limits.totalBytes){diagnostics.push({path,message:'Size limit exceeded; file skipped.'});continue;}bytes+=size;
    const name=base(path),directory=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'.';
    const add=(component,version,kind,scope,locator,reason,forced)=>findings.push({id:`repo-${findings.length}`,component,version:String(version??''),expression:String(version??''),kind,scope,path,directory,locator,precision:forced||precision(String(version??''),kind),reason,projectId:context.projectId??null,commit:context.commit||'',source:context.source||'local',simulated:context.simulated===true});
    const warn=message=>diagnostics.push({path,message});
    const lines=content.split(/\r?\n/);
    try{
      if(Object.hasOwn(pins,name)){
        lines.forEach((line,i)=>{const v=line.replace(/\s*#.*$/,'').trim();if(v)add(pins[name],v,'runtime','runtime selection',`line ${i+1}`,'Repository runtime selection; installation and execution unverified.');});
      }else if(name==='.tool-versions'){
        lines.forEach((line,i)=>{const [tool,...versions]=line.replace(/#.*$/,'').trim().split(/\s+/),runtime=({nodejs:'node',python:'python',ruby:'ruby',golang:'go',java:'java',rust:'rust',php:'php',dotnet:'dotnet'})[tool];if(runtime)for(const v of versions)add(runtime,v,'runtime','tool selection',`line ${i+1}`,'Tool-manager selection; multiple candidates retained.');});
      }else if(name==='package.json'){
        const data=JSON.parse(content);
        for(const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])for(const [dep,v]of Object.entries(data[section]||{}))add(dep,typeof v==='string'?v:'','package',section,`/${section}/${pointer(dep)}`,'Manifest declaration; a range does not establish the resolved version.',/^v?\d+(?:\.\d+){2}(?:[-+][\w.-]+)?$/.test(v)?'exact':'constraint');
        for(const [runtime,v]of Object.entries(data.engines||{}))add(runtime,String(v),runtime==='node'?'runtime':'package','engine requirement',`/engines/${pointer(runtime)}`,'Compatibility requirement, not an installed runtime.','constraint');
      }else if(name==='package-lock.json'){
        const data=JSON.parse(content);
        if(![1,2,3].includes(data.lockfileVersion)){warn('Unsupported npm lockfile version.');continue;}
        const record=(dep,item,loc)=>{if(!item||typeof item!=='object')return;const v=typeof item.version==='string'?item.version:'';add(dep,v,'package',item.dev?'development lock':item.optional||item.devOptional?'optional lock':'dependency lock',loc+'/version',item.link?'Workspace link; target version not resolved.':'Resolved lockfile entry; build inclusion and installation unverified.',item.link?'unresolved':undefined);};
        if(data.packages&&typeof data.packages==='object'){
          for(const [key,item]of Object.entries(data.packages)){if(!key)continue;record(item.name||key.split('node_modules/').at(-1),item,`/packages/${pointer(key)}`);}
        }else if(data.lockfileVersion===1){
          const walk=(deps,loc,depth=0)=>{if(depth>40){warn('Nested lockfile depth limit reached.');return;}for(const [dep,item]of Object.entries(deps||{})){const p=loc+'/'+pointer(dep);record(dep,item,p);walk(item?.dependencies,p+'/dependencies',depth+1);}};walk(data.dependencies,'/dependencies');
        }else warn('Lockfile packages object is missing.');
      }else if(/^requirements.*\.txt$/i.test(name)){
        lines.forEach((line,i)=>{
          const s=line.replace(/\s+#.*$/,'').trim();if(!s||s.startsWith('#'))return;
          if(s.startsWith('-')||s.includes('\\')){warn(`Line ${i+1}: directive or continuation not followed; dependency coverage may be incomplete.`);return;}
          const m=s.match(/^([\w.-]+)(?:\[[^\]]+\])?\s*([^;]*)(;.*)?$/);if(!m){warn(`Line ${i+1}: unsupported requirement.`);return;}
          const spec=m[2].trim(),pin=spec.match(/^==([^=*,\s]+)$/),v=pin?pin[1]:spec;
          add(m[1].toLowerCase().replace(/[-_.]+/g,'-'),v,'package',m[3]?'conditional requirement':'dependency requirement',`line ${i+1}`,`Python requirement${m[3]?' '+m[3]:''}; markers are not evaluated.`,pin?precision(v,'package'):'constraint');
          findings.at(-1).expression=spec+(m[3]||'');
        });
      }else if(name==='go.mod'){
        let block=false;
        lines.forEach((line,i)=>{const s=line.replace(/\/\/.*$/,'').trim();let m;
          if((m=s.match(/^go\s+(\S+)/)))add('go',m[1],'runtime','minimum toolchain',`line ${i+1}`,'Go directive specifies a minimum language/toolchain version.','constraint');
          else if((m=s.match(/^toolchain\s+(\S+)/)))add('go',m[1].replace(/^go/,''),'runtime','suggested toolchain',`line ${i+1}`,'Suggested toolchain; actual toolchain selection can differ.','constraint');
          else if(s==='require (')block=true;else if(s===')')block=false;
          else if((m=s.match(block?/^(\S+)\s+(v\S+)/:/^require\s+(\S+)\s+(v\S+)/)))add(m[1],m[2],'package','module requirement',`line ${i+1}`,'Required module version; minimal version selection may choose a higher version.','constraint');
          else if(/^(replace|exclude)\b/.test(s))warn(`Line ${i+1}: replacement/exclusion not resolved; module selections require review.`);
        });
      }else if(/^Dockerfile(?:\..*)?$/i.test(name)){
        lines.forEach((line,i)=>{const m=line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);if(!m)return;
          const image=m[1],leaf=image.split('/').at(-1),parts=leaf.match(/^(python|node|ruby|golang|openjdk|eclipse-temurin|php|rust):([^@]+)/i),runtime=parts?({golang:'go','eclipse-temurin':'java',openjdk:'java'})[parts[1]]||parts[1]:'';
          if(runtime)add(runtime,parts[2],'runtime',`base image${m[2]?' stage '+m[2]:''}`,`line ${i+1}`,`Base-image tag ${image}; mutable tags and build stages do not prove final runtime contents.`,'hint');
          else warn(`Line ${i+1}: base image runtime unresolved (${image}); no registry or ARG resolution performed.`);
        });
      }else warn('Recognized file, parser not implemented. No version inferred.');
    }catch(e){warn(`Could not parse file: ${e instanceof SyntaxError?'invalid JSON':'unsupported structure'}.`);}
  }
  return {context:{...context},findings,diagnostics,inspected,bytes};
}

export function queryRepository(analysis,{name='',operator='any',target='',kind='all'}={}){
  if(!operators.some(o=>o.id===operator))return {rows:[],error:'Choose a version condition.'};
  if(operator!=='any'&&!parseVersion(target))return {rows:[],error:'Enter a numeric version such as 3.11 or 2.32.0.'};
  const q=name.toLowerCase().trim();
  return {error:'',rows:analysis.findings.filter(f=>(kind==='all'||f.kind===kind)&&f.component.toLowerCase().includes(q)).map(f=>{
    const order=f.precision==='exact'?compareVersions(f.version,target,f.kind==='runtime'?f.component:''):null;
    const status=operator==='any'?'included':order===null?'unknown':({gte:order>=0,gt:order>0,lte:order<=0,lt:order<0,eq:order===0,neq:order!==0})[operator]?'match':'other';
    return {...f,status};
  })};
}

// A source link is useful fallback evidence, never a new deployed-component assertion.
export function repositoryLinks(analysis,assets){
  const {projectId,commit,source}=analysis.context;
  if(source!=='gitlab-snapshot'||!projectId||!commit)return [];
  return assets.filter(a=>a.project?.id===projectId&&a.manifest?.commit_sha===commit);
}
