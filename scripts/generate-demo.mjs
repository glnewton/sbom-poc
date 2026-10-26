import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const hash=(value,algorithm='sha256',encoding='hex')=>createHash(algorithm).update(value).digest(encoding);
const timestamp='2026-10-26T12:00:00Z';
const app=(key,number,name,owner,criticality,description)=>({sys_id:hash(key).slice(0,32),number,name,application_manager:{display_value:owner,value:hash(owner).slice(0,32)},business_criticality:criticality,short_description:description,install_status:'1',sys_updated_on:'2026-10-25 16:30:00',u_gitlab_project_ids:''});
const apps=[
 app('atlas','APM001001','Atlas Customer Platform','Customer engineering','1 - most critical','Customer portal, Python APIs, and notification delivery.'),
 app('meridian','APM001002','Meridian Payments','Payments engineering','1 - most critical','Java payment processing and settlement services.'),
 app('beacon','APM001003','Beacon Analytics','Data platform','2 - somewhat critical','Python ingestion and analytical reporting workloads.'),
 app('harbor','APM001004','Harbor Operations','Enterprise systems','3 - less critical','Internal operations portal and legacy batch processing.'),
];
const specs=[
 {id:101,app:0,name:'customer-api',type:'ECS',runtime:'python',versions:['3.12.7','3.11.10','3.10.15','3.10.14'],libs:[['fastapi',['0.115.2','0.112.2','0.103.2','0.103.2']],['requests',['2.32.3','2.32.3','2.31.0','2.31.0']],['urllib3',['2.2.3','2.2.3','1.26.18','1.26.18']]]},
 {id:102,app:0,name:'customer-web',type:'ECS',runtime:'node',versions:['22.10.0','20.18.0','18.20.4','18.20.3'],libs:[['express',['4.21.1','4.21.1','4.18.2','4.18.2']],['lodash',['4.17.21','4.17.21','4.17.20','4.17.20']],['react',['18.3.1','18.3.1','18.2.0','18.2.0']]]},
 {id:103,app:0,name:'notification-handler',type:'Lambda',runtime:'python',versions:['3.12','3.12','3.11','3.11'],libs:[['requests',['2.32.3','2.32.3','2.31.0','2.31.0']],['boto3',['1.35.40','1.35.40','1.34.10','1.34.10']]]},
 {id:201,app:1,name:'payment-gateway',type:'ECS',runtime:'java',versions:['21.0.5','21.0.4','17.0.12','17.0.11'],libs:[['spring-core',['6.1.14','6.1.12','6.0.13','6.0.13']],['log4j-core',['2.24.1','2.23.1','2.17.1','2.17.1']]]},
 {id:202,app:1,name:'settlement-worker',type:'ECS',runtime:'java',versions:['21.0.5','17.0.13','17.0.12','17.0.12'],libs:[['jackson-databind',['2.18.0','2.17.2','2.15.3','2.15.3']],['log4j-core',['2.24.1','2.23.1','2.17.1','2.17.1']]]},
 {id:301,app:2,name:'event-ingestion',type:'ECS',runtime:'python',versions:['3.12.7','3.11.10','3.11.9','3.11.9'],libs:[['pandas',['2.2.3','2.2.2','2.1.4','2.1.4']],['requests',['2.32.3','2.32.3','2.31.0','2.31.0']]]},
 {id:302,app:2,name:'report-builder',type:'ECS',runtime:'python',versions:['3.12.7','3.11.10','3.11.9','3.11.9'],libs:[['pandas',['2.2.3','2.2.2','2.1.4','2.1.4']],['numpy',['2.1.2','2.0.2','1.26.4','1.26.4']]]},
 {id:401,app:3,name:'operations-portal',type:'ECS',runtime:'node',versions:['22.10.0','20.18.0','20.17.0','20.17.0'],libs:[['express',['4.21.1','4.21.1','4.19.2','4.19.2']],['lodash',['4.17.21','4.17.21','4.17.21','4.17.21']]]},
 {id:402,app:3,name:'legacy-batch',type:'EC2',runtime:'python',versions:['3.11.10','3.9.20','3.9.18','3.9.18'],libs:[['requests',['2.32.3','2.31.0','2.28.2','2.28.2']],['urllib3',['2.2.3','1.26.18','1.26.16','1.26.16']]]},
];
const environments=['dev','uat','prod'];
const sourceEnvironments={dev:'development',uat:'user-acceptance',prod:'production'};
const runtimeNames={python:'python',node:'nodejs',java:'openjdk'};
const portfolio={schema_version:1,simulated:true,snapshot_at:timestamp,description:'Deterministic synthetic API-shaped snapshots. No customer data and no live API connections.',servicenow:{captured_at:timestamp,endpoint:'/api/now/table/cmdb_ci_business_app',businessApplications:{result:apps}},gitlab:{captured_at:timestamp,projects:[],environments:[],pipelines:[],jobs:[],deployments:[]},aws:{captured_at:timestamp,ecs:{tasks:[]},lambda:{functions:[]},ec2:{Reservations:[]},ssm:{Entities:[]}},buildManifests:[],sbomArtifacts:[],scenarios:[]};
let pipeline=8000,job=12000,deployment=4000;
const manifests=new Map();
function build(spec,index,label){
 const pipelineId=++pipeline,jobId=++job,sha=hash(`${spec.id}/${label}`,'sha1');
 const artifact=spec.type==='Lambda'?hash(`${spec.id}/${label}/zip`,'sha256','base64'):'sha256:'+hash(`${spec.id}/${label}/image`);
 const subjectType=spec.type==='Lambda'?'lambda-code-sha256':'container-image';
 const release=`${spec.id%100+1}.${3-index}.0`;
 portfolio.gitlab.pipelines.push({id:pipelineId,project_id:spec.id,sha,ref:label==='dev'?'main':`v${release}`,status:'success',created_at:'2026-10-25T09:00:00Z',updated_at:'2026-10-25T09:12:00Z'});
 portfolio.gitlab.jobs.push({id:jobId,project_id:spec.id,name:'generate-sbom',stage:'build',status:'success',commit:{id:sha,short_id:sha.slice(0,8)},pipeline:{id:pipelineId,project_id:spec.id,sha},artifacts_file:{filename:'artifacts.zip',size:4096},artifacts:[{file_type:'archive',filename:'artifacts.zip',file_format:'zip',size:4096}]});
 const bom={bomFormat:'CycloneDX',specVersion:'1.5',version:1,metadata:{timestamp:'2026-10-25T09:10:00Z',component:{'bom-ref':'application',type:'application',name:spec.name,version:release}},components:[],dependencies:[]};
 if(spec.type!=='Lambda')bom.components.push({'bom-ref':'runtime',type:'platform',name:runtimeNames[spec.runtime],version:spec.versions[index],description:'Synthetic runtime recorded in this image SBOM',properties:[{name:'bomscope:role',value:'runtime'}]});
 for(const [name,versions]of spec.libs){const group=spec.runtime==='java'?(name==='log4j-core'?'org.apache.logging.log4j':name==='spring-core'?'org.springframework':'com.fasterxml.jackson.core'):'';const version=versions[index];bom.components.push({'bom-ref':name,type:'library',group,name,version,purl:spec.runtime==='java'?`pkg:maven/${group}/${name}@${version}`:`pkg:${spec.runtime==='python'?'pypi':'npm'}/${name}@${version}`,licenses:[{license:{id:'Apache-2.0'}}]});}
 bom.dependencies.push({ref:'application',dependsOn:bom.components.filter(c=>c.name!=='urllib3').map(c=>c['bom-ref'])});if(bom.components.some(c=>c.name==='urllib3'))bom.dependencies.push({ref:'requests',dependsOn:['urllib3']});
 if(spec.id===302&&label==='uat'){const c=bom.components.find(c=>c.name==='numpy');delete c.version;delete c.purl;}
 const noSbom=spec.id===302&&label==='prod';
 const manifest={project_id:spec.id,pipeline_id:pipelineId,commit_sha:sha,sbom_job_id:jobId,sbom_path:'sbom.cdx.json',subject:{type:subjectType,digest:artifact},release,created_at:'2026-10-25T09:12:00Z'};
 portfolio.buildManifests.push(manifest);
 if(!noSbom)portfolio.sbomArtifacts.push({project_id:spec.id,job_id:jobId,path:'sbom.cdx.json',response:bom});
 manifests.set(`${spec.id}/${label}`,manifest);return manifest;
}
function tags(spec,environment){return {BusinessApplicationId:apps[spec.app].sys_id,GitLabProjectId:String(spec.id),Environment:sourceEnvironments[environment],Service:spec.name};}
function ecsTask(spec,environment,manifest,suffix='current'){
 const account=environment==='prod'?'111122223333':'444455556666',cluster=`${environment}-applications`,taskId=hash(`${spec.id}/${environment}/${suffix}`).slice(0,32),values=tags(spec,environment);
 const task={taskArn:`arn:aws:ecs:us-east-1:${account}:task/${cluster}/${taskId}`,clusterArn:`arn:aws:ecs:us-east-1:${account}:cluster/${cluster}`,taskDefinitionArn:`arn:aws:ecs:us-east-1:${account}:task-definition/${spec.name}-${environment}:${suffix==='old'?40:41}`,group:`service:${spec.name}-${environment}`,lastStatus:'RUNNING',desiredStatus:'RUNNING',startedAt:'2026-10-26T10:15:00Z',containers:[{name:spec.name,image:`${account}.dkr.ecr.us-east-1.amazonaws.com/${spec.name}:${manifest.release}`,imageDigest:manifest.subject.digest,lastStatus:'RUNNING',healthStatus:'HEALTHY'}],tags:Object.entries(values).map(([key,value])=>({key,value}))};
 if(spec.id===401&&environment==='uat')delete task.containers[0].imageDigest;
 portfolio.aws.ecs.tasks.push(task);return task;
}
for(const spec of specs){
 apps[spec.app].u_gitlab_project_ids+=(apps[spec.app].u_gitlab_project_ids?',':'')+spec.id;
 portfolio.gitlab.projects.push({id:spec.id,name:spec.name,path:spec.name,path_with_namespace:`demo/${spec.name}`,default_branch:'main',web_url:`https://gitlab.example.test/demo/${spec.name}`,topics:['simulated',`business-app:${apps[spec.app].number}`]});
 environments.forEach((environment,index)=>{
  const envId=spec.id*10+index,manifest=build(spec,index,environment);
  portfolio.gitlab.environments.push({id:envId,project_id:spec.id,name:sourceEnvironments[environment],slug:environment,state:'available',tier:environment==='prod'?'production':environment==='dev'?'development':'testing'});
  portfolio.gitlab.deployments.push({id:++deployment,project_id:spec.id,status:'success',sha:manifest.commit_sha,ref:environment==='dev'?'main':`v${manifest.release}`,created_at:'2026-10-26T10:00:00Z',updated_at:'2026-10-26T10:04:00Z',environment:{id:envId,name:sourceEnvironments[environment]},deployable:{id:job+50000,name:`deploy-${environment}`,pipeline:{id:manifest.pipeline_id,project_id:spec.id,sha:manifest.commit_sha},commit:{id:manifest.commit_sha}}});
  if(spec.type==='ECS')ecsTask(spec,environment,manifest);
  if(spec.type==='Lambda'){
   const account=environment==='prod'?'111122223333':'444455556666';
   portfolio.aws.lambda.functions.push({Configuration:{FunctionName:`${spec.name}-${environment}`,FunctionArn:`arn:aws:lambda:us-east-1:${account}:function:${spec.name}-${environment}:12`,Runtime:`python${spec.versions[index]}`,Version:'12',PackageType:'Zip',CodeSha256:manifest.subject.digest,LastModified:'2026-10-26T10:03:00.000+0000',State:'Active'},Tags:tags(spec,environment)});
  }
  if(spec.type==='EC2'){
   const instanceId='i-'+hash(`${spec.id}/${environment}`).slice(0,17),values=tags(spec,environment);
   portfolio.aws.ec2.Reservations.push({Instances:[{InstanceId:instanceId,ImageId:'ami-'+hash('base-image').slice(0,17),State:{Name:'running',Code:16},Placement:{AvailabilityZone:'us-east-1a'},Tags:Object.entries(values).map(([Key,Value])=>({Key,Value})),LaunchTime:'2026-10-20T08:00:00Z'}]});
   portfolio.aws.ssm.Entities.push({Id:instanceId,Data:{'AWS:Application':{TypeName:'AWS:Application',SchemaVersion:'1.1',CaptureTime:'2026-10-26T11:30:00Z',Content:[{Name:'python3',Version:spec.versions[index],ApplicationType:'System'},...spec.libs.map(([Name,versions])=>({Name,Version:versions[index],ApplicationType:'Package'}))]}}});
  }
 });
 if(spec.id===101||spec.id===102){const old=build(spec,3,'old-prod');ecsTask(spec,'prod',old,'old');}
}
// A genuinely unknown digest cannot be linked by image tag or latest pipeline.
const lost=structuredClone(portfolio.aws.ecs.tasks.find(t=>t.group==='service:report-builder-prod'));
lost.taskArn=lost.taskArn.replace(/[^/]+$/,hash('untracked-deploy').slice(0,32));lost.containers[0].imageDigest='sha256:'+hash('untracked-image');portfolio.aws.ecs.tasks.push(lost);
// One running asset intentionally lacks an application tag and project metadata.
const orphan=structuredClone(portfolio.aws.ecs.tasks[0]);orphan.taskArn=orphan.taskArn.replace(/[^/]+$/,hash('orphan').slice(0,32));orphan.tags=orphan.tags.filter(t=>!['BusinessApplicationId','GitLabProjectId'].includes(t.key));orphan.group='service:unmapped-worker';orphan.containers[0].name='unmapped-worker';portfolio.aws.ecs.tasks.push(orphan);
// A stopped task is present in the API snapshot but must never count as deployed.
const stopped=structuredClone(portfolio.aws.ecs.tasks[0]);stopped.taskArn=stopped.taskArn.replace(/[^/]+$/,hash('stopped-task').slice(0,32));stopped.lastStatus='STOPPED';stopped.containers[0].lastStatus='STOPPED';portfolio.aws.ecs.tasks.push(stopped);
portfolio.scenarios=[{id:'rollout',description:'Atlas prod has two customer-api and two customer-web digests with different runtime/library versions.'},{id:'lambda-family',description:'Lambda supplies python3.11 / python3.12 only; its SBOM describes code libraries, not an exact managed runtime patch.'},{id:'ssm',description:'Harbor EC2 versions are installed software observations. App tags do not attest which binaries the application executes.'},{id:'missing-sbom',description:'Beacon report-builder prod has a known build manifest but no captured SBOM artifact.'},{id:'unknown-digest',description:'A second report-builder prod task has an unrecognized digest, despite using a familiar image tag.'},{id:'mutable-tag',description:'Harbor UAT has an image tag but no observed digest; no version is inferred from a latest build.'},{id:'missing-version',description:'NumPy in Beacon UAT is recorded without a version or versioned purl.'},{id:'unmapped',description:'An orphan ECS task has no business application/project tags and remains unassigned.'}];
await writeFile(new URL('../dist/data/simulated-enterprise.json',import.meta.url),JSON.stringify(portfolio,null,2)+'\n');
console.log(`Generated ${apps.length} applications, ${specs.length} GitLab projects, ${portfolio.buildManifests.length} manifests and ${portfolio.sbomArtifacts.length} SBOMs.`);
