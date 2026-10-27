const ref=v=>typeof v==='object'&&v?v.value:v;
export const canonicalId=(type,...parts)=>type+':'+parts.map(v=>encodeURIComponent(String(v))).join('|');
export function validateMappingInput(input){
 if(input?.schema_version!==1||input.simulated!==true)throw Error('Expected a version 1 simulated mapping capture.');
 if(!input.instances?.servicenow||!input.instances?.gitlab||!Array.isArray(input.profiles)||!input.profiles.length)throw Error('Mapping instance/profile context is missing.');
 if(new Set(input.profiles.map(p=>p.id)).size!==input.profiles.length)throw Error('Duplicate mapping profile IDs.');
 for(const p of input.profiles)if(!['relationship','reference'].includes(p.applicationMode)||!p.serviceTag||!p.serviceKeyField||!p.environmentField||!p.environmentAliases)throw Error('Invalid mapping profile configuration.');
 for(const rows of [input.servicenow?.applicationServices?.result,input.servicenow?.relationships?.result,input.registry?.services,input.registry?.sourceBindings,input.aws?.workloadTagCaptures])if(!Array.isArray(rows))throw Error('Mapping capture collection is missing.');
}
export function mappingProfile(input,id='cmdb-relationships'){
 const p=input.profiles.find(p=>p.id===id);if(!p)throw Error('Unknown mapping profile: '+id);return p;
}
export function resolveAssetMapping(base,snapshot,input,profileId){
 const p=mappingProfile(input,profileId),issues=[],evidence=[],rules=['MAP-01','MAP-02','MAP-03','MAP-04'];
 const normalize=v=>p.environmentAliases[String(v||'').toLowerCase()]||String(v||'').toLowerCase()||'unassigned';
 let status='resolved';const fail=(code,message,state='unresolved')=>{issues.push({code,message});if(({resolved:0,unresolved:1,ambiguous:2,conflict:3})[state]>({resolved:0,unresolved:1,ambiguous:2,conflict:3})[status])status=state;};
 const captures=input.aws.workloadTagCaptures.filter(c=>c.resourceId===base.resourceId&&c.accountId===base.account&&c.region===base.region);
 if(captures.length!==1)fail('TAG_CAPTURE','Expected one resource-scoped tag capture.',captures.length?'ambiguous':'unresolved');
 const tags=captures.length===1?captures[0].tags:{};
 if(captures.length===1)evidence.push({source:'capture',pointer:'/aws/workloadTagCaptures/'+input.aws.workloadTagCaptures.indexOf(captures[0]),meaning:'Observed AWS tags'});
 const services=input.servicenow.applicationServices.result.filter(s=>s.sys_id===tags[p.serviceTag]);
 if(services.length!==1)fail('SERVICE_ID',`AWS ${p.serviceTag} does not identify exactly one CMDB application service.`,services.length?'ambiguous':'unresolved');
 const service=services.length===1?services[0]:null;
 let owners=[],applicationId='',binding=null;
 if(service){
  evidence.push({source:'capture',pointer:'/servicenow/applicationServices/result/'+input.servicenow.applicationServices.result.indexOf(service),meaning:'CMDB application service'});
  if(p.applicationMode==='relationship'){
   const rels=input.servicenow.relationships.result.filter(r=>ref(r.type)===p.relationType&&ref(r[p.childField])===service.sys_id);
   owners=[...new Set(rels.map(r=>ref(r[p.parentField])))];
   for(const r of rels)evidence.push({source:'capture',pointer:'/servicenow/relationships/result/'+input.servicenow.relationships.result.indexOf(r),meaning:'Configured CMDB relationship and direction'});
  }else if(p.applicationMode==='reference')owners=[ref(service[p.applicationReferenceField])].filter(Boolean);
  else fail('PROFILE_MODE','Unsupported ownership mapping mode.');
  const decisions=(input.registry.ownershipDecisions||[]).filter(d=>d.application_service_id===service.sys_id);
  if(owners.length===1)applicationId=owners[0];
  else if(owners.length>1&&decisions.length===1&&owners.includes(decisions[0].primary_application_id)){
   applicationId=decisions[0].primary_application_id;evidence.push({source:'capture',pointer:'/registry/ownershipDecisions/'+input.registry.ownershipDecisions.indexOf(decisions[0]),meaning:'Explicit primary owner for a shared service'});
  }else fail('APPLICATION_OWNERSHIP',owners.length?'Multiple owning applications require an explicit primary-ownership decision.':'CMDB application relationship/reference is missing.',owners.length?'ambiguous':'unresolved');
  if(applicationId&&!snapshot.servicenow.businessApplications.result.some(a=>a.sys_id===applicationId))fail('APPLICATION_MISSING','Referenced business application is not present.');
  const bindings=input.registry.sourceBindings.filter(b=>b.service_id===service[p.serviceKeyField]&&b.role==='primary'&&b.gitlab_instance===input.instances.gitlab&&Date.parse(b.valid_from)<=Date.parse(snapshot.snapshot_at)&&(!b.valid_to||Date.parse(b.valid_to)>Date.parse(snapshot.snapshot_at)));
  if(bindings.length!==1)fail('SOURCE_BINDING','Expected one active primary build-target binding.',bindings.length?'ambiguous':'unresolved');
  else{binding=bindings[0];evidence.push({source:'capture',pointer:'/registry/sourceBindings/'+input.registry.sourceBindings.indexOf(binding),meaning:'Approved service/project/path/build-target binding'});}
  if(!input.registry.services.some(s=>s.id===service[p.serviceKeyField]))fail('SERVICE_REGISTRY','Deployable service is absent from the registry.');
  if(binding&&!snapshot.gitlab.projects.some(pr=>pr.id===binding.project_id))fail('PROJECT_MISSING','Bound GitLab project is absent.');
  if(applicationId&&tags.BusinessApplicationId&&tags.BusinessApplicationId!==applicationId)fail('APPLICATION_CONFLICT','AWS application tag contradicts CMDB ownership.','conflict');
  if(binding&&tags.GitLabProjectId&&String(binding.project_id)!==tags.GitLabProjectId)fail('PROJECT_CONFLICT','AWS project tag contradicts the approved source binding.','conflict');
  if(tags.Environment&&normalize(tags.Environment)!==normalize(service[p.environmentField]))fail('ENVIRONMENT_CONFLICT','AWS environment tag contradicts the CMDB service environment.','conflict');
 }
 const environment=normalize(service?.[p.environmentField]||tags.Environment||base.tags.Environment);
 return {status,profileId:p.id,applicationId:status==='resolved'?applicationId:null,projectId:status==='resolved'?binding?.project_id:null,serviceId:service?.[p.serviceKeyField]||null,applicationServiceId:service?.sys_id||null,sourcePath:binding?.path||null,buildTarget:binding?.build_target||null,environment,ownerCandidates:owners,issues,evidence,rules};
}
