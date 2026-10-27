import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>JSON.parse(readFileSync(new URL('../dist/data/'+name,import.meta.url),'utf8'));
const snapshot=read('simulated-enterprise.json');
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,32);
const relationType=hash('Consumes::Consumed by');
const data={schema_version:1,simulated:true,captured_at:snapshot.snapshot_at,instances:{servicenow:'https://demo.service-now.example.test',gitlab:'https://gitlab.example.test',awsPartition:'aws'},profiles:[
 {id:'cmdb-relationships',name:'CMDB relationships + AWS service tags',description:'Resolve application ownership through cmdb_rel_ci and application-service identity from an AWS tag.',applicationMode:'relationship',serviceTag:'ApplicationServiceId',relationType,parentField:'parent',childField:'child',serviceKeyField:'u_deployable_service_id',environmentField:'u_environment',applicationReferenceField:'u_business_application',environmentAliases:{development:'dev','user-acceptance':'uat',production:'prod',dever:'dev',dev:'dev',uat:'uat',prod:'prod'}},
 {id:'custom-reference',name:'Custom application reference + alternate tag',description:'Equivalent ownership via a configured reference field; demonstrates an alternate customer data model.',applicationMode:'reference',serviceTag:'CMDBService',relationType,parentField:'parent',childField:'child',serviceKeyField:'u_deployable_service_id',environmentField:'u_environment',applicationReferenceField:'u_business_application',environmentAliases:{development:'dev','user-acceptance':'uat',production:'prod',dever:'dev',dev:'dev',uat:'uat',prod:'prod'}}
],servicenow:{applicationServices:{result:[]},relationships:{result:[]},relationshipTypes:{result:[{sys_id:relationType,name:'Consumes::Consumed by',parent_descriptor:'Consumes',child_descriptor:'Consumed by'}]}},registry:{services:[],sourceBindings:[]},aws:{accounts:[],ecs:{clusters:[],services:[],taskDefinitions:[]},ecr:{images:[]},lambda:{aliases:[]},workloadTagCaptures:[]},scenarios:[]};
for(const accountId of ['111122223333','444455556666'])data.aws.accounts.push({Account:accountId,Arn:`arn:aws:iam::${accountId}:role/InventoryReadOnly`,UserId:`SIMULATED:${accountId}`,source:'STS GetCallerIdentity'});
for(const p of snapshot.gitlab.projects){
 const app=snapshot.servicenow.businessApplications.result.find(a=>a.u_gitlab_project_ids.split(',').includes(String(p.id)));
 const serviceId='service-'+p.id;
 data.registry.services.push({id:serviceId,name:p.name,ownerApplication:app.sys_id});
 data.registry.sourceBindings.push({id:'binding-'+p.id,service_id:serviceId,gitlab_instance:data.instances.gitlab,project_id:p.id,path:'.',build_target:p.name,role:'primary',valid_from:'2026-01-01T00:00:00Z',valid_to:null,approved_by:'Demo architecture registry'});
 for(const env of snapshot.gitlab.environments.filter(e=>e.project_id===p.id)){
  const id=hash(serviceId+'/'+env.name);
  data.servicenow.applicationServices.result.push({sys_id:id,sys_class_name:'cmdb_ci_service_auto',name:`${p.name} / ${env.slug}`,operational_status:'1',u_deployable_service_id:serviceId,u_environment:env.name,u_business_application:{value:app.sys_id,display_value:app.name},sys_updated_on:'2026-10-25 16:30:00'});
  data.servicenow.relationships.result.push({sys_id:hash(app.sys_id+'/'+id),parent:{value:app.sys_id},child:{value:id},type:{value:relationType,display_value:'Consumes::Consumed by'}});
 }
}
// One repository serves an additional build target; it has no deployed workload in this capture.
data.registry.services.push({id:'service-notification-admin',name:'notification-admin',ownerApplication:snapshot.servicenow.businessApplications.result[0].sys_id});
data.registry.sourceBindings.push({id:'binding-notification-admin',service_id:'service-notification-admin',gitlab_instance:data.instances.gitlab,project_id:103,path:'admin',build_target:'notification-admin',role:'primary',valid_from:'2026-01-01T00:00:00Z',valid_to:null,approved_by:'Demo architecture registry'});
data.registry.sourceBindings.push({id:'binding-api-report-client',service_id:'service-101',gitlab_instance:data.instances.gitlab,project_id:302,path:'clients/customer',build_target:'report-client',role:'auxiliary',valid_from:'2026-01-01T00:00:00Z',valid_to:null,approved_by:'Demo architecture registry'});
// An actual many-to-many case: a second application's prod service shares notification-handler.
const shared=data.servicenow.applicationServices.result.find(s=>s.u_deployable_service_id==='service-103'&&s.u_environment==='production');
const consumer=snapshot.servicenow.businessApplications.result[1];
data.servicenow.relationships.result.push({sys_id:hash('shared-notification-consumer'),parent:{value:consumer.sys_id},child:{value:shared.sys_id},type:{value:relationType,display_value:'Consumes::Consumed by'}});
// Explicit override is a scoped, approved ownership choice; sharing remains visible in the graph.
data.registry.ownershipDecisions=[{application_service_id:shared.sys_id,primary_application_id:shared.u_business_application.value,consumer_application_ids:[consumer.sys_id],reason:'Atlas operates this shared service; Meridian consumes it.',approved_by:'Demo service owner'}];
function capture(resourceId,tagArray,kind,accountId){
 const tags=Array.isArray(tagArray)?Object.fromEntries(tagArray.map(t=>[t.key??t.Key,t.value??t.Value])):{...tagArray};
 const svc=data.servicenow.applicationServices.result.find(s=>s.u_deployable_service_id==='service-'+tags.GitLabProjectId&&s.u_environment===tags.Environment);
 if(svc){tags.ApplicationServiceId=svc.sys_id;tags.CMDBService=svc.sys_id;}
 // Cross-source contradiction is explicit and cannot inherit a valid app/build assertion.
 if(tags.GitLabProjectId==='401'&&tags.Environment==='development')tags.BusinessApplicationId=snapshot.servicenow.businessApplications.result[0].sys_id;
 data.aws.workloadTagCaptures.push({resourceId,accountId:accountId||resourceId.split(':')[4],region:'us-east-1',kind,captured_at:snapshot.snapshot_at,tags,api:kind==='ECS'?'ecs:ListTagsForResource':kind==='Lambda'?'lambda:ListTags':'ec2:DescribeInstances'});
}
for(const task of snapshot.aws.ecs.tasks){
 capture(task.taskArn,task.tags,'ECS');
 if(!data.aws.ecs.clusters.some(c=>c.clusterArn===task.clusterArn))data.aws.ecs.clusters.push({clusterArn:task.clusterArn,clusterName:task.clusterArn.split('/').at(-1),status:'ACTIVE'});
 const serviceName=task.group.replace(/^service:/,'');
 const serviceArn=task.clusterArn.replace(':cluster/',':service/')+'/'+serviceName;
 if(!data.aws.ecs.services.some(s=>s.serviceArn===serviceArn))data.aws.ecs.services.push({serviceArn,serviceName,clusterArn:task.clusterArn,taskDefinition:task.taskDefinitionArn,status:'ACTIVE',desiredCount:1});
 if(!data.aws.ecs.taskDefinitions.some(t=>t.taskDefinitionArn===task.taskDefinitionArn))data.aws.ecs.taskDefinitions.push({taskDefinitionArn:task.taskDefinitionArn,family:task.taskDefinitionArn.split('/').at(-1).split(':')[0],revision:Number(task.taskDefinitionArn.split(':').at(-1)),containerDefinitions:task.containers.map(c=>({name:c.name,image:c.image}))});
 for(const c of task.containers){if(!c.imageDigest)continue;const registryId=c.image.split('.')[0],repositoryName=c.image.split('/').at(-1).split(':')[0];if(!data.aws.ecr.images.some(i=>i.registryId===registryId&&i.repositoryName===repositoryName&&i.imageDigest===c.imageDigest))data.aws.ecr.images.push({registryId,region:'us-east-1',repositoryName,imageDigest:c.imageDigest,imageTags:[c.image.split(':').at(-1)],imageManifestMediaType:'application/vnd.oci.image.manifest.v1+json',imagePushedAt:'2026-10-25T09:12:00Z'});}
}
for(const f of snapshot.aws.lambda.functions){capture(f.Configuration.FunctionArn,f.Tags,'Lambda');const arn=f.Configuration.FunctionArn.replace(/:\d+$/,'');data.aws.lambda.aliases.push({AliasArn:arn+':live',Name:'live',FunctionVersion:f.Configuration.Version,RoutingConfig:{AdditionalVersionWeights:{}}});}
for(const r of snapshot.aws.ec2.Reservations)for(const i of r.Instances)capture(i.InstanceId,i.Tags,'EC2',r.OwnerId);
data.scenarios=[{id:'shared-service',description:'Meridian consumes the Atlas notification service. An explicit registry decision identifies its operating application; both CMDB links are retained.'},{id:'mapping-conflict',description:'operations-portal DEV has an AWS application tag contradicting its CMDB service ownership. Its deployed version remains unresolved under the mapping profile.'},{id:'alternate-profile',description:'Switch between cmdb_rel_ci ownership and a custom application reference with an alternate AWS tag. Equivalent primary mappings produce equivalent version results.'},{id:'orphan',description:'The unmapped ECS worker has no application-service identity and is not joined by a similar name.'}];
writeFileSync(new URL('../dist/data/simulated-mapping-input.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Generated ${data.servicenow.applicationServices.result.length} application services, ${data.servicenow.relationships.result.length} CMDB relationships and ${data.aws.workloadTagCaptures.length} AWS tag captures.`);
