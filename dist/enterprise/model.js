import {resolveAssetMapping,validateMappingInput} from '../mapping/resolve.mjs';
import {normalize} from '../engine.mjs';
import {runtimes,searchVersions} from '../version-search.mjs';

export const environmentOrder=['dev','uat','prod'];
export function normalizeEnvironment(value){
  const env=String(value||'').trim().toLowerCase();
  return ({development:'dev',dever:'dev',dev:'dev','user-acceptance':'uat','user acceptance testing':'uat',uat:'uat',production:'prod',prod:'prod',staging:'stage',stg:'stage',stage:'stage',test:'test',testing:'test',qa:'test'})[env]||env||'unassigned';
}
const tags=(value,upper=false)=>Array.isArray(value)?Object.fromEntries(value.map(t=>[t[upper?'Key':'key'],t[upper?'Value':'value']])):value||{};
const runtimeFor=c=>runtimes.find(r=>r.pattern.test(c.name))?.id||'';
const manifestKey=(project,type,digest)=>`${project}|${type}|${digest}`;

export function buildPortfolio(snapshot,{mappingInput=null,profileId='cmdb-relationships'}={}){
  if(!snapshot||snapshot.schema_version!==1||snapshot.simulated!==true)throw Error('Expected a version 1 simulated enterprise snapshot.');
  if(mappingInput)validateMappingInput(mappingInput);
  const apps=snapshot.servicenow.businessApplications.result.map(raw=>({id:raw.sys_id,number:raw.number,name:raw.name,owner:raw.application_manager?.display_value||'Unassigned',criticality:raw.business_criticality,description:raw.short_description,projectIds:String(raw.u_gitlab_project_ids||'').split(',').filter(Boolean).map(Number),raw}));
  const appMap=new Map(apps.map(a=>[a.id,a]));
  const projectMap=new Map(snapshot.gitlab.projects.map(p=>[p.id,p]));
  const manifests=new Map();
  for(const m of snapshot.buildManifests){const k=manifestKey(m.project_id,m.subject.type,m.subject.digest);if(!manifests.has(k))manifests.set(k,[]);manifests.get(k).push(m);}
  const assets=[];
  function add(base){
    const mapping=mappingInput?resolveAssetMapping(base,snapshot,mappingInput,profileId):null;
    const values=base.tags,app=appMap.get(mapping?mapping.applicationId:values.BusinessApplicationId)||null;
    const project=projectMap.get(Number(mapping?mapping.projectId:values.GitLabProjectId))||null;
    const asset={...base,mapping,app,project,environment:mapping?mapping.environment:normalizeEnvironment(values.Environment),originalEnvironment:values.Environment||'',service:values.Service||base.service,issues:[],components:[],manifest:null,bom:null,coverage:'gap'};
    if(mapping)asset.issues.push(...mapping.issues.map(i=>i.message));
    if(!app)asset.issues.push('Application mapping missing');
    if(!project)asset.issues.push('GitLab project mapping missing');
    if(!mapping&&app&&project&&!app.projectIds.includes(project.id))asset.issues.push('Application/project mapping conflict');
    if(!values.Environment)asset.issues.push('Environment tag missing');
    if(base.kind==='EC2'){
      const inventories=snapshot.aws.ssm.Entities.filter(i=>i.Id===base.instanceId&&(!mappingInput||i.AccountId===base.account&&i.Region===base.region));
      const inventory=inventories.length===1?inventories[0].Data?.['AWS:Application']:null;
      if(inventories.length>1)asset.issues.push('SSM inventory ambiguous');
      if(inventory){asset.inventory=inventory;asset.observedAt=inventory.CaptureTime;asset.coverage='host';asset.components=inventory.Content.map((c,i)=>({id:`installed-${i}`,name:c.Name,version:c.Version||'',purl:'',group:'',type:'library',licenses:[],hashes:[],raw:c,precision:'exact',origin:'AWS SSM installed software',runtime:runtimeFor({name:c.Name})}));}
      else asset.issues.push('SSM inventory missing');
    }else if(project&&app&&(mapping?.status==='resolved'||app.projectIds.includes(project.id))){
      if(!base.digest)asset.issues.push('Observed artifact digest missing');
      else {
        const found=manifests.get(manifestKey(project.id,base.subjectType,base.digest))||[];
        if(found.length!==1)asset.issues.push(found.length?'Artifact mapping ambiguous':'Artifact digest not linked to a build');
        else {
          const m=found[0];
          const pipeline=snapshot.gitlab.pipelines.find(p=>p.id===m.pipeline_id&&p.project_id===project.id);
          const job=snapshot.gitlab.jobs.find(j=>j.id===m.sbom_job_id&&j.project_id===project.id);
          if(!pipeline||!job||pipeline.sha!==m.commit_sha||job.commit?.id!==m.commit_sha||job.pipeline?.id!==m.pipeline_id)asset.issues.push('Build metadata inconsistent');
          else {
            asset.manifest=m;asset.pipeline=pipeline;asset.job=job;
            const captured=snapshot.sbomArtifacts.filter(a=>a.project_id===project.id&&a.job_id===m.sbom_job_id&&a.path===m.sbom_path);
            if(captured.length!==1)asset.issues.push(captured.length?'SBOM artifact ambiguous':'SBOM artifact missing');
            else {
              asset.bom=captured[0].response;
              const model=normalize(asset.bom,`${project.path}/${m.sbom_path}`);
              asset.components=model.components.filter(c=>c.id!==model.root).map(c=>({...c,precision:'exact',origin:'GitLab artifact SBOM',runtime:runtimeFor(c)}));
              asset.coverage='artifact';
            }
          }
        }
      }
    }
    if(base.kind==='Lambda'){
      const match=String(base.runtime||'').match(/^(python|nodejs|java|dotnet|ruby)(\d+(?:\.\d+)*)(?:\.x)?$/);
      if(match){const runtime=({nodejs:'node',dotnet:'dotnet'})[match[1]]||match[1];asset.components.push({id:'aws-managed-runtime',name:match[1],version:match[2],purl:'',group:'',type:'platform',licenses:[],hashes:[],raw:{Runtime:base.runtime},precision:'family',origin:'AWS Lambda runtime configuration',runtime});}
    }
    const deployments=snapshot.gitlab.deployments.filter(d=>d.project_id===project?.id&&d.status==='success'&&normalizeEnvironment(d.environment.name)===asset.environment).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
    asset.deployment=deployments[0]||null;
    asset.rolloutDifference=!!(asset.manifest&&asset.deployment&&asset.manifest.commit_sha!==asset.deployment.sha);
    if(asset.rolloutDifference)asset.issues.push('AWS build differs from GitLab deployment target');
    assets.push(asset);
  }
  for(const task of snapshot.aws.ecs.tasks){
    if(task.lastStatus!=='RUNNING')continue;
    for(const container of task.containers){if(container.lastStatus!=='RUNNING')continue;add({id:task.taskArn+'#'+container.name,kind:'ECS',resourceId:task.taskArn,service:container.name,tags:tags(task.tags),region:task.taskArn.split(':')[3],account:task.taskArn.split(':')[4],digest:container.imageDigest||'',subjectType:'container-image',image:container.image,observedAt:snapshot.aws.captured_at,raw:{task,container}});}
  }
  for(const fn of snapshot.aws.lambda.functions){if(fn.Configuration.State!=='Active')continue;const c=fn.Configuration;add({id:c.FunctionArn,kind:'Lambda',resourceId:c.FunctionArn,service:c.FunctionName,tags:tags(fn.Tags),region:c.FunctionArn.split(':')[3],account:c.FunctionArn.split(':')[4],digest:c.CodeSha256||'',subjectType:'lambda-code-sha256',runtime:c.Runtime,observedAt:snapshot.aws.captured_at,raw:fn});}
  for(const reservation of snapshot.aws.ec2.Reservations)for(const i of reservation.Instances){if(i.State.Name!=='running')continue;add({id:i.InstanceId,kind:'EC2',instanceId:i.InstanceId,resourceId:i.InstanceId,service:i.InstanceId,tags:tags(i.Tags,true),region:i.Placement.AvailabilityZone.slice(0,-1),account:reservation.OwnerId||'Account capture missing',digest:'',observedAt:snapshot.aws.captured_at,raw:i});}
  if(mappingInput)for(const app of apps)app.projectIds=[...new Set(assets.filter(a=>a.app?.id===app.id&&a.project).map(a=>a.project.id))];
  return {snapshot,apps,appMap,projectMap,assets,mappingInput,profileId};
}
export function selectAssets(fleet,{appId='all',environment='all',projectId='all',kindFilter='all'}={}){
  return fleet.assets.filter(a=>(appId==='all'||(appId==='unassigned'?!a.app:a.app?.id===appId))&&(environment==='all'||a.environment===environment)&&(projectId==='all'||String(a.project?.id)===String(projectId))&&(kindFilter==='all'||a.kind===kindFilter));
}
export function queryPortfolio(fleet,request){
  const assets=selectAssets(fleet,request),rows=[],notRecorded=[];
  // Validate even if the selected application has no assets.
  const validation=searchVersions({components:[]},request);
  if(validation.error)return {...validation,assets,notRecorded,matched:0,other:0,unknown:0};
  for(const asset of assets){
    const result=searchVersions({components:asset.components},request);
    for(const r of result.rows){
      if(r.component.precision==='family'){r.status='unknown';r.reason='Managed runtime family only; exact patch not supplied';}
      rows.push({...r,id:asset.id+'|'+r.component.id,asset});
    }
    const runtimeCoveredByFamily=request.kind==='runtime'&&result.rows.some(r=>r.component.precision==='family');
    if(asset.coverage==='gap'&&!runtimeCoveredByFamily){
      rows.push({id:asset.id+'|evidence-gap',asset,component:null,version:'',source:'Missing deployed artifact evidence',status:'unknown',reason:asset.issues.filter(x=>!x.includes('differs from')).join('; ')||'No inventory supplied'});
    }else if(!result.rows.length)notRecorded.push(asset);
  }
  return {error:'',assets,rows,notRecorded,matched:rows.filter(r=>r.status==='match').length,other:rows.filter(r=>r.status==='other').length,unknown:rows.filter(r=>r.status==='unknown').length};
}
export function environmentMatrix(fleet,request){
  const result=queryPortfolio(fleet,{...request,environment:'all'});
  if(result.error)return {...result,groups:[]};
  const groups=new Map();
  for(const asset of result.assets){
    const key=`${asset.app?.id||'unassigned'}|${asset.project?.id||asset.service}`;
    if(!groups.has(key))groups.set(key,{key,app:asset.app,project:asset.project,service:asset.service,cells:{}});
    const row=groups.get(key),cell=row.cells[asset.environment]||{assets:[],rows:[]};
    cell.assets.push(asset);cell.rows.push(...result.rows.filter(r=>r.asset.id===asset.id));row.cells[asset.environment]=cell;
  }
  for(const group of groups.values())for(const cell of Object.values(group.cells)){
    cell.versions=[...new Set(cell.rows.filter(r=>r.component&&r.component.precision==='exact'&&r.version).map(r=>r.version))];
    cell.unknown=cell.rows.filter(r=>r.status==='unknown').length;
    cell.mixed=cell.versions.length>1;
  }
  return {...result,groups:[...groups.values()].filter(g=>Object.values(g.cells).some(c=>c.rows.length))};
}
export function describeEvidence(asset){return asset.coverage==='artifact'?'Digest-linked SBOM':asset.coverage==='host'?'Installed on EC2 host':'Evidence gap';}
