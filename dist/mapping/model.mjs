import {canonicalId as id,mappingProfile} from './resolve.mjs';
import {entities,relations,rules,fields,apis,entityFields} from './catalog.mjs';
import {normalize} from '../engine.mjs';
import {analyzeRepository} from '../repository/analyzer.mjs';
const ref=v=>v&&typeof v==='object'?v.value:v;
export function buildMappingGraph(fleet,input,repositories={samples:[]}){
 const s=fleet.snapshot,p=mappingProfile(input,fleet.profileId),sn=input.instances.servicenow,gl=input.instances.gitlab;
 const nodes=[],edges=[],issues=[],nodeMap=new Map(),edgeSet=new Set();
 const evidence=(source,pointer,meaning)=>({source,pointer,meaning,capturedAt:input.captured_at,simulated:true});
 function node(type,key,label,attributes={},provenance=[]){const keyId=id(type,...key);if(!nodeMap.has(keyId)){const n={id:keyId,type,label,attributes,provenance};nodes.push(n);nodeMap.set(keyId,n);}return keyId;}
 function link(type,from,to,provenance=[],attributes={}){const definition=relations.find(r=>r[0]===type);if(!definition)throw Error('Undocumented relationship '+type);const key=id('edge',type,from,to);if(edgeSet.has(key)){const existing=edges.find(e=>e.id===key);for(const e of provenance)if(!existing.provenance.some(old=>old.source===e.source&&old.pointer===e.pointer))existing.provenance.push(e);return;}edgeSet.add(key);edges.push({id:key,type,from,to,rule:definition[5],attributes,provenance});}
 const app=a=>id('application',sn,a),svc=a=>id('application_service',sn,a),service=a=>id('service','demo',a),project=a=>id('project',gl,a),commit=(a,c)=>id('commit',gl,a,c),pipeline=(a,n)=>id('pipeline',gl,a,n),job=(a,n)=>id('job',gl,a,n),artifact=(t,d)=>id('artifact',t,d),env=e=>id('environment','demo',e);
 const envName=v=>p.environmentAliases[v]||v||'unassigned';
 function ensureEnv(value){const name=envName(value);return node('environment',['demo',name],name.toUpperCase(),{name});}
 const apps=s.servicenow.businessApplications.result;
 apps.forEach((a,i)=>node('application',[sn,a.sys_id],a.name,a,[evidence('snapshot',`/servicenow/businessApplications/result/${i}`,'Business application')]));
 input.registry.services.forEach((r,i)=>node('service',['demo',r.id],r.name,r,[evidence('capture',`/registry/services/${i}`,'Deployable service registry')]));
 input.servicenow.applicationServices.result.forEach((r,i)=>{
  const ev=[evidence('capture',`/servicenow/applicationServices/result/${i}`,'CMDB application service')];node('application_service',[sn,r.sys_id],r.name,r,ev);link('service_instance',svc(r.sys_id),service(r[p.serviceKeyField]),ev);link('service_environment',svc(r.sys_id),ensureEnv(r[p.environmentField]),ev);
  if(p.applicationMode==='reference'&&ref(r[p.applicationReferenceField]))link('application_uses_service',app(ref(r[p.applicationReferenceField])),svc(r.sys_id),ev,{method:'custom reference'});
 });
 // The raw CMDB relationship graph remains visible under both profiles, including shared consumers.
 input.servicenow.relationships.result.filter(r=>ref(r.type)===p.relationType).forEach(r=>link('application_uses_service',app(ref(r[p.parentField])),svc(ref(r[p.childField])),[evidence('capture','/servicenow/relationships/result/'+input.servicenow.relationships.result.indexOf(r),'Configured relation type/direction')],{relationshipId:r.sys_id,method:'CMDB relationship'}));
 s.gitlab.projects.forEach((r,i)=>node('project',[gl,r.id],r.path_with_namespace,r,[evidence('snapshot',`/gitlab/projects/${i}`,'GitLab project')]));
 input.registry.sourceBindings.forEach((r,i)=>{const b=node('source_binding',['demo',r.id],`${r.build_target} · ${r.path}`,r,[evidence('capture',`/registry/sourceBindings/${i}`,'Approved source binding')]);link('service_source',service(r.service_id),b,nodeMap.get(b).provenance);link('binding_project',b,project(r.project_id),nodeMap.get(b).provenance);});
 s.gitlab.pipelines.forEach((r,i)=>{const ev=[evidence('snapshot',`/gitlab/pipelines/${i}`,'Pipeline execution')];node('commit',[gl,r.project_id,r.sha],r.sha.slice(0,12),{projectId:r.project_id,sha:r.sha},ev);node('pipeline',[gl,r.project_id,r.id],`Pipeline ${r.id}`,r,ev);link('project_commit',project(r.project_id),commit(r.project_id,r.sha),ev);link('commit_pipeline',commit(r.project_id,r.sha),pipeline(r.project_id,r.id),ev);});
 s.gitlab.jobs.forEach((r,i)=>{const ev=[evidence('snapshot',`/gitlab/jobs/${i}`,'Job execution')];node('job',[gl,r.project_id,r.id],`Job ${r.id} · ${r.name}`,r,ev);link('pipeline_job',pipeline(r.project_id,r.pipeline.id),job(r.project_id,r.id),ev);});
 s.gitlab.environments.forEach((r,i)=>{const ev=[evidence('snapshot',`/gitlab/environments/${i}`,'GitLab environment')],g=node('gitlab_environment',[gl,r.project_id,r.id],`${r.project_id} / ${r.name}`,r,ev);link('project_environment',project(r.project_id),g,ev);link('environment_alias',g,ensureEnv(r.name),ev);});
 s.gitlab.deployments.forEach((r,i)=>{const ev=[evidence('snapshot',`/gitlab/deployments/${i}`,'Deployment intent')],d=node('deployment',[gl,r.project_id,r.id],`Deployment ${r.id}`,r,ev);link('environment_deployment',id('gitlab_environment',gl,r.project_id,r.environment.id),d,ev);link('deployment_commit',d,commit(r.project_id,r.sha),ev);});
 s.buildManifests.forEach((r,i)=>{
  const ev=[evidence('snapshot',`/buildManifests/${i}`,'Integration-owned build manifest')];
  const pipe=s.gitlab.pipelines.find(x=>x.project_id===r.project_id&&x.id===r.pipeline_id),j=s.gitlab.jobs.find(x=>x.project_id===r.project_id&&x.id===r.sbom_job_id);
  const same=s.buildManifests.filter(x=>x.project_id===r.project_id&&x.subject.type===r.subject.type&&x.subject.digest===r.subject.digest);
  if(same.length!==1||!pipe||!j||pipe.sha!==r.commit_sha||j.commit?.id!==r.commit_sha||j.pipeline?.id!==r.pipeline_id){issues.push({code:'BUILD_PROVENANCE',message:'Manifest is ambiguous or inconsistent with its pipeline/job.',provenance:ev});return;}
  const a=node('artifact',[r.subject.type,r.subject.digest],r.subject.digest.slice(0,24)+'…',{...r.subject,release:r.release},ev);
  link('job_artifact',job(r.project_id,r.sbom_job_id),a,ev,{pipelineId:r.pipeline_id,commit:r.commit_sha});
  const matches=s.sbomArtifacts.filter(x=>x.project_id===r.project_id&&x.job_id===r.sbom_job_id&&x.path===r.sbom_path);
  if(matches.length!==1){issues.push({code:'SBOM_CAPTURE',message:'Expected one captured SBOM for the exact build job/path.',subject:a,provenance:ev});return;}
  const captured=matches[0],sbomEv=[evidence('snapshot','/sbomArtifacts/'+s.sbomArtifacts.indexOf(captured),'Exact captured job artifact')],b=node('sbom',[gl,r.project_id,r.sbom_job_id,r.sbom_path],`${r.project_id} / job ${r.sbom_job_id} / ${r.sbom_path}`,{projectId:r.project_id,jobId:r.sbom_job_id,path:r.sbom_path},sbomEv);
  link('job_sbom',job(r.project_id,r.sbom_job_id),b,sbomEv);link('artifact_sbom',a,b,ev);
  const model=normalize(captured.response,r.sbom_path);
  for(const c of model.components){const ci=node('component',[b,c.id],c.name,{name:c.name,version:c.version,purl:c.purl,reference:c.id},sbomEv);link('sbom_component',b,ci,sbomEv);const observation=node('observation',[b,c.id],`${c.name} ${c.version||'Unknown'}`,{component:c.name,version:c.version,precision:c.version?'exact':'unknown',scope:'artifact inventory',purl:c.purl},sbomEv);link('component_observation',ci,observation,sbomEv);}
  for(const [from,to]of model.edges)link('component_dependency',id('component',b,from),id('component',b,to),sbomEv);
 });
 input.aws.accounts.forEach((r,i)=>node('account',['aws',r.Account],r.Account,r,[evidence('capture',`/aws/accounts/${i}`,'Collector STS account context')]));
 input.aws.ecs.clusters.forEach((r,i)=>node('cluster',[r.clusterArn],r.clusterName,r,[evidence('capture',`/aws/ecs/clusters/${i}`,'ECS cluster')]));
 input.aws.ecs.taskDefinitions.forEach((r,i)=>node('task_definition',[r.taskDefinitionArn],`${r.family}:${r.revision}`,r,[evidence('capture',`/aws/ecs/taskDefinitions/${i}`,'ECS task definition revision')]));
 input.aws.ecs.services.forEach((r,i)=>{const ev=[evidence('capture',`/aws/ecs/services/${i}`,'ECS desired service')],e=node('ecs_service',[r.serviceArn],r.serviceName,r,ev);link('cluster_service',id('cluster',r.clusterArn),e,ev);link('ecs_desired_definition',e,id('task_definition',r.taskDefinition),ev);});
 input.aws.ecr.images.forEach((r,i)=>{const ev=[evidence('capture',`/aws/ecr/images/${i}`,'ECR registry occurrence')],e=node('ecr_image',[r.registryId,r.region,r.repositoryName,r.imageDigest],`${r.repositoryName} @ ${r.imageDigest.slice(0,19)}…`,r,ev);node('artifact',['container-image',r.imageDigest],r.imageDigest.slice(0,24)+'…',{type:'container-image',digest:r.imageDigest},ev);link('registry_artifact',e,artifact('container-image',r.imageDigest),ev);});
 const assetNodeIds={};
 for(const a of fleet.assets){
  const nativeIndex=a.kind==='ECS'?s.aws.ecs.tasks.findIndex(t=>t.taskArn===a.resourceId):a.kind==='Lambda'?s.aws.lambda.functions.findIndex(f=>f.Configuration.FunctionArn===a.resourceId):s.aws.ec2.Reservations.findIndex(r=>r.Instances.some(i=>i.InstanceId===a.resourceId));
  const ev=[evidence('snapshot',a.kind==='ECS'?`/aws/ecs/tasks/${nativeIndex}`:a.kind==='Lambda'?`/aws/lambda/functions/${nativeIndex}`:`/aws/ec2/Reservations/${nativeIndex}`,'Observed AWS resource')];
  // EC2 reservation OwnerId or collector context supplies scope, never environment inference.
  const account=a.account;
  const w=node('workload',['aws',account,a.region,a.id],`${a.service} · ${a.environment} · ${a.resourceId.split('/').at(-1).slice(-12)}`,{assetId:a.id,resourceId:a.resourceId,kind:a.kind,application:a.app?.name||null,environment:a.environment,mappingStatus:a.mapping?.status||'legacy',coverage:a.coverage,digest:a.digest,observedAt:a.observedAt},ev);assetNodeIds[a.id]=w;
  node('region',['aws',a.region],a.region,{region:a.region});link('account_workload',id('account','aws',account),w,ev);link('region_workload',id('region','aws',a.region),w,ev);
  if(a.mapping?.status==='resolved'){link('workload_service',w,svc(a.mapping.applicationServiceId),a.mapping.evidence.map(e=>({...e,capturedAt:input.captured_at,simulated:true})));link('workload_environment',w,ensureEnv(a.environment),ev);}
  if(a.digest){node('artifact',[a.subjectType,a.digest],a.digest.slice(0,24)+'…',{type:a.subjectType,digest:a.digest},ev);link('workload_artifact',w,artifact(a.subjectType,a.digest),ev);}
  if(a.kind==='ECS'){const task=a.raw.task;link('cluster_workload',id('cluster',task.clusterArn),w,ev);link('workload_definition',w,id('task_definition',task.taskDefinitionArn),ev);const controller=input.aws.ecs.services.find(e=>e.clusterArn===task.clusterArn&&'service:'+e.serviceName===task.group);if(controller)link('ecs_service_workload',id('ecs_service',controller.serviceArn),w,ev);}
  if(a.kind==='Lambda'){const arn=a.resourceId.replace(/:\d+$/,''),f=node('lambda_function',[arn],a.raw.Configuration.FunctionName,{arn},ev);link('function_version',f,w,ev);}
  if(a.kind==='EC2'&&a.inventory){const inv=node('inventory',['aws',account,a.region,a.resourceId,a.inventory.CaptureTime,'AWS:Application'],`${a.resourceId} / installed software`,{instanceId:a.resourceId,capturedAt:a.inventory.CaptureTime},[evidence('snapshot','/aws/ssm/Entities/'+s.aws.ssm.Entities.findIndex(e=>e.Id===a.resourceId&&e.AccountId===a.account&&e.Region===a.region),'SSM inventory adapter envelope')]);link('workload_inventory',w,inv,nodeMap.get(inv).provenance);a.components.forEach((c,i)=>{const o=node('observation',[inv,i],`${c.name} ${c.version}`,{component:c.name,version:c.version,precision:'exact',scope:'host installed'},nodeMap.get(inv).provenance);link('inventory_observation',inv,o,nodeMap.get(inv).provenance);link('workload_observation',w,o,nodeMap.get(inv).provenance);});}
  else for(const c of a.components){if(c.precision==='family'){const o=node('observation',[w,c.id],`${c.name} ${c.version} family`,{component:c.name,version:c.version,precision:'family',scope:'managed runtime configuration'},ev);link('workload_observation',w,o,ev);}else if(a.manifest){const b=id('sbom',gl,a.project.id,a.manifest.sbom_job_id,a.manifest.sbom_path);const o=id('observation',b,c.id);if(nodeMap.has(o))link('workload_observation',w,o,ev);}}
  for(const message of a.issues)issues.push({code:a.mapping?.issues.find(i=>i.message===message)?.code||'EVIDENCE_GAP',message,subject:w,assetId:a.id,provenance:ev});
 }
 input.aws.lambda.aliases.forEach((r,i)=>{const arn=r.AliasArn.replace(/:[^:]+$/,''),ev=[evidence('capture',`/aws/lambda/aliases/${i}`,'Lambda routing intent')],alias=node('lambda_alias',[r.AliasArn],r.AliasArn,r,ev);link('function_alias',id('lambda_function',arn),alias,ev);for(const version of [r.FunctionVersion,...Object.keys(r.RoutingConfig?.AdditionalVersionWeights||{})]){const a=fleet.assets.find(a=>a.resourceId===arn+':'+version);if(a)link('alias_version',alias,assetNodeIds[a.id],ev,{weight:r.RoutingConfig?.AdditionalVersionWeights?.[version]??1-Object.values(r.RoutingConfig?.AdditionalVersionWeights||{}).reduce((a,b)=>a+b,0)});else issues.push({code:'ALIAS_VERSION_MISSING',message:'An alias target version has no captured qualified workload.',subject:alias,provenance:ev});}});
 for(const sample of repositories.samples||[]){
  const c=node('commit',[gl,sample.context.projectId,sample.context.commit],sample.context.commit.slice(0,12),{sha:sample.context.commit,projectId:sample.context.projectId});link('project_commit',project(sample.context.projectId),c);
  sample.files.forEach((file,index)=>{const ev=[evidence('repositories',`/samples/${repositories.samples.indexOf(sample)}/files/${index}`,'Simulated GitLab file at commit')],f=node('source_file',[gl,sample.context.projectId,sample.context.commit,file.path],file.path,{path:file.path,projectId:sample.context.projectId,commit:sample.context.commit},ev);link('commit_file',c,f,ev);for(const finding of analyzeRepository([file],sample.context).findings){const o=node('observation',[f,finding.id],`${finding.component} ${finding.version}`,{...finding,scope:'source: '+finding.scope},ev);link('file_observation',f,o,ev);}});
 }
 for(const edge of edges){const from=nodeMap.get(edge.from),to=nodeMap.get(edge.to),def=relations.find(r=>r[0]===edge.type);if(!from||!to)issues.push({code:'DANGLING_REFERENCE',message:`${edge.type} endpoint not captured`,subject:edge.from,provenance:edge.provenance});else if(from.type!==def[1]||to.type!==def[2])throw Error('Relationship endpoint type mismatch');}
 return {schema_version:1,simulated:true,capturedAt:input.captured_at,profileId:p.id,nodes,edges,issues,assetNodeIds,catalog:{entities,relations,rules,fields,apis,entityFields}};
}
export function traceAsset(graph,asset){
 const selected=new Set([graph.assetNodeIds[asset.id]]),map=new Map(graph.nodes.map(n=>[n.id,n]));
 // Only walk semantically useful directions; never fan out to every workload sharing an account.
 const out=new Set(['workload_service','workload_environment','workload_artifact','workload_definition','workload_inventory','workload_observation','artifact_sbom','job_sbom','sbom_component','component_observation','inventory_observation','service_instance','service_source','binding_project','commit_file','file_observation']);
 const incoming=new Set(['application_uses_service','job_artifact','pipeline_job','commit_pipeline','account_workload','region_workload','cluster_workload','ecs_service_workload','function_version','alias_version']);
 for(let i=0;i<10;i++){let changed=false;for(const e of graph.edges){if(selected.has(e.from)&&out.has(e.type)&&!selected.has(e.to)){selected.add(e.to);changed=true;}if(selected.has(e.to)&&incoming.has(e.type)&&!selected.has(e.from)){selected.add(e.from);changed=true;}}if(!changed)break;}
 return {nodes:[...selected].map(k=>map.get(k)).filter(Boolean),edges:graph.edges.filter(e=>selected.has(e.from)&&selected.has(e.to)),issues:graph.issues.filter(i=>i.assetId===asset.id||selected.has(i.subject))};
}
export function readEvidence(bundle,e){let value=bundle[e.source];for(const key of e.pointer.split('/').slice(1).map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~')))value=value?.[key];return value;}
