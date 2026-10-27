import {writeFileSync,mkdirSync} from 'node:fs';
import {entities,relations,rules,fields,apis,entityFields} from '../dist/mapping/catalog.mjs';
mkdirSync(new URL('../docs/architecture/erd/',import.meta.url),{recursive:true});
const write=(path,text)=>writeFileSync(new URL('../'+path,import.meta.url),text+'\n');
const table=(header,rows)=>'| '+header.join(' | ')+' |\n| '+header.map(()=> '---').join(' | ')+' |\n'+rows.map(r=>'| '+r.map(v=>String(v).replace(/\|/g,'\\|').replace(/\n/g,' ')).join(' | ')+' |').join('\n');
const groups={
 '01-complete':entities.map(e=>e[0]),
 '02-ownership':['application','application_service','service','source_binding','project','environment','workload'],
 '03-delivery':['project','commit','pipeline','job','artifact','sbom','gitlab_environment','deployment'],
 '04-runtime':['account','region','cluster','ecs_service','task_definition','workload','ecr_image','artifact','lambda_function','lambda_alias','inventory'],
 '05-evidence':['commit','source_file','sbom','component','observation','inventory','workload'],
};
for(const [name,types]of Object.entries(groups)){
 const cardinal={'many-to-many':'}o--o{','many-to-one':'}o--||','one-to-many':'||--o{'};
 const rs=relations.filter(r=>types.includes(r[1])&&types.includes(r[2]));
 const diagram='erDiagram\n'+types.map(t=>`  ${t.toUpperCase()} {\n    string id PK\n${entityFields[t].map(([name,type,key])=>`    ${type==='reference'?'json':type} ${name}${key?' '+key:''}`).join('\n')}\n  }`).join('\n')+'\n'+rs.map(r=>`  ${r[1].toUpperCase()} ${cardinal[r[3]]} ${r[2].toUpperCase()} : "${r[0]}"`).join('\n');
 write('docs/architecture/erd/'+name+'.mmd',diagram);
 write('docs/architecture/erd/'+name+'.md',`# ${name.slice(3)} logical ERD\n\nGenerated from the same catalog as the POC workbench. Each node is a typed canonical entity; its native scoped key is documented in the entity dictionary. Logical fields below project native attributes, capture metadata and relationship keys; *_key foreign keys are physically implemented by typed edges, not duplicated columns in the graph store. Optional fields such as source-file hashes remain absent when the capture does not supply them. The physical graph store is documented separately. Cardinalities describe a valid, complete relationship; missing captures produce issues rather than invented parents. Many-to-many links are represented as relationship assertions.\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\n\n${table(['Relationship','From','To','Cardinality','Join policy','Rule'],rs)}\n`);
}
write('docs/architecture/entity-dictionary.md',`# Canonical entity dictionary\n\nGenerated from \`dist/mapping/catalog.mjs\`. IDs use the entity type plus URL-encoded native identity parts. Source instance, account, region, project and document scope are retained where required.\n\n${table(['Entity','Meaning','Unique native identity','Native source','Scope'],entities)}\n\nEvery entity also has \`label\`, \`attributes\`, and \`provenance[]\`. Labels are display-only. Provenance includes source bundle, JSON pointer, captured time and simulated indicator. A capture is an observation at a time, not a timeless assertion.\n`);
write('docs/architecture/field-mapping-reference.md',`# Native-to-canonical field mappings\n\nGenerated from the catalog used in the POC's **Field mappings** view. The current implementation uses two configured ServiceNow ownership/tag profiles. Read [adapter profiles](adapter-profiles.md) for the exact contract, precedence and failure behavior.\n\n${table(['Provider','Native field','Canonical destination','Transformation','Rule','Field ownership'],fields)}\n`);
write('docs/architecture/relationship-rules.md',`# Relationship rules and cardinalities\n\nGenerated from the POC catalog. The implementation is in \`dist/mapping/resolve.mjs\`, \`dist/mapping/model.mjs\` and \`dist/enterprise/model.js\`. All accepted graph edges carry a rule ID; source-backed edges retain evidence references. Cross-source ownership conflicts block portfolio attribution.\n\n${table(['Rule','Purpose','Policy'],rules)}\n\n## Relationship inventory\n\n${table(['Relationship','From','To','Cardinality','Join predicate','Rule'],relations)}\n\nCardinality is conceptual, not proof that the capture is complete. One-to-many permits zero captured children; many-to-one requires one resolved parent when a claim is accepted. The adapter rejects missing/ambiguous primary bindings. Graph validation exposes missing endpoints; SQL foreign keys reject persisting them as accepted relationships.\n`);
write('docs/architecture/api-reference.md',`# Official API collection reference\n\nGenerated from the same catalog as the POC **Official APIs & rules** view. These are official operations, not invented cross-vendor APIs. The [collection runbook](collection-runbook.md) supplies concrete request examples, ordering, credentials and operational handling. Live collection is not enabled in the public POC.\n\n${table(['Provider','Operation','Request','Permission / authentication','Pagination / behavior','Official reference'],apis.map(a=>[...a.slice(0,5),`[Documentation](${a[5]})`]))}\n`);
console.log('Generated 5 logical ERDs, Mermaid sources, dictionary, field mappings, relationship rules and API catalog.');

// Concrete, reproducible examples use the exact same fixtures and resolver as the UI.
const {readFileSync}=await import('node:fs');
const {buildPortfolio}=await import('../dist/enterprise/model.js');
const {buildMappingGraph,traceAsset}=await import('../dist/mapping/model.mjs');
const read=name=>JSON.parse(readFileSync(new URL('../dist/data/'+name,import.meta.url),'utf8'));
const capture=read('simulated-mapping-input.json'),fleet=buildPortfolio(read('simulated-enterprise.json'),{mappingInput:capture}),graph=buildMappingGraph(fleet,capture,read('simulated-repositories.json'));
const picks=[
 ['Atlas Python prod, including mixed rollout',a=>a.project?.id===101&&a.environment==='prod'],
 ['Beacon prod: known build, missing SBOM, repository fallback',a=>a.issues.includes('SBOM artifact missing')],
 ['Beacon prod: unknown observed digest',a=>a.issues.includes('Artifact digest not linked to a build')],
 ['Harbor DEV: CMDB/AWS ownership conflict',a=>a.service==='operations-portal'&&a.environment==='dev'],
 ['Harbor UAT: image tag without observed digest',a=>a.service==='operations-portal'&&a.environment==='uat'],
 ['Shared notification service and Lambda runtime family',a=>a.project?.id===103&&a.environment==='prod'],
 ['Harbor host-installed software',a=>a.kind==='EC2'&&a.environment==='prod'],
 ['Unmapped ECS worker',a=>a.mapping.status==='unresolved'],
];
let worked=`# Worked traces and acceptance cases\n\nGenerated from committed fixtures and the current mapping implementation. Open **Mapping workbench → Workload trace** and select the service/environment below; the same keys and decisions appear in the POC. Snapshot: ${fleet.snapshot.snapshot_at}. Profile: ${fleet.profileId}.\n\nThe current graph contains ${graph.nodes.length} entities, ${graph.edges.length} relationships and ${graph.issues.length} recorded issues. These are deterministic fixture counts, not production statistics.\n`;
for(const [title,predicate]of picks){
 worked+='\n## '+title+'\n\n';
 for(const a of fleet.assets.filter(predicate)){
  const trace=traceAsset(graph,a);
  worked+=table(['Field','Recorded value'],[['Application',a.app?.name||'Unresolved'],['Workload',a.resourceId],['Environment / type',a.environment+' / '+a.kind],['Application-service sys_id',a.mapping.applicationServiceId||'Missing'],['Deployable service / build target',(a.mapping.serviceId||'Missing')+' / '+(a.mapping.buildTarget||'Missing')],['Project / source path',(a.project?.id||'Unresolved')+' / '+(a.mapping.sourcePath||'Unresolved')],['Mapping decision',a.mapping.status],['Observed artifact',a.digest||'Missing'],['Build commit',a.manifest?.commit_sha||'Unresolved'],['Pipeline / SBOM job',a.manifest?`${a.manifest.pipeline_id} / ${a.manifest.sbom_job_id}`:'Unresolved'],['Inventory scope',a.coverage],['Recorded components',a.components.map(c=>`${c.name} ${c.version||'Unknown'} (${c.precision})`).join('; ')||'No component inventory linked'],['Trace size',`${trace.nodes.length} entities / ${trace.edges.length} relationships`],['Issues',a.issues.join('; ')||'None recorded']])+'\n\n';
 }
}
worked+='## Acceptance behavior\n\n- Unknown digest, missing SBOM, missing version and ownership conflict are separate failure states. No latest-build or display-name shortcut is permitted.\n- Changing to the custom-reference profile preserves equivalent primary mappings for this fixture, while applying a different ownership/tag route.\n- Removing the shared-service ownership decision makes the relationship profile ambiguous; it cannot silently choose an application.\n- Adding an active duplicate primary source binding or expiring the only primary binding blocks attribution.\n- A missing Lambda alias target is a captured routing gap, not an invented function version.\n- Missing repository/SBOM fields remain evidence-specific Unknowns; source pins stay attached to their exact commit.\n\nThese cases are executable in `mapping-checks.mjs`, with existing artifact/version cases in `enterprise-checks.mjs` and `repository-checks.mjs`.\n';
write('docs/architecture/worked-traces.md',worked);

write('docs/architecture/logical-field-dictionary.md', '# Logical entity fields\n\nLogical fields are projections of the native mapping table and typed relationships. Foreign-key projections use canonical target IDs; the physical graph stores them as relationship rows. Optional missing source fields remain unknown.\n\n'+entities.map(e=>'## '+e[1]+'\n\n'+table(['Field','Logical type','Key'],[['id','string','PK'],...entityFields[e[0]].map(([n,t,k])=>[n,t,k||''])])).join('\n\n'));
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required});
const str={type:'string'},arr=items=>({type:'array',items});
const ev=object({source:{enum:['snapshot','capture','repositories']},pointer:str,meaning:str,capturedAt:str,simulated:{const:true}},['source','pointer']);
const contract={$schema:'https://json-schema.org/draft/2020-12/schema',title:'BOMscope canonical simulated evidence graph',...object({schema_version:{const:1},simulated:{const:true},capturedAt:str,profileId:str,nodes:arr(object({id:str,type:{enum:entities.map(e=>e[0])},label:str,attributes:{type:'object'},provenance:arr(ev)})),edges:arr(object({id:str,type:{enum:relations.map(r=>r[0])},from:str,to:str,rule:{enum:rules.map(r=>r[0])},attributes:{type:'object'},provenance:arr(ev)})),issues:arr(object({code:str,message:str,subject:str,assetId:str,provenance:arr(ev)},['code','message']))},['schema_version','simulated','capturedAt','profileId','nodes','edges','issues'])};
write('schema/canonical-graph.schema.json',JSON.stringify(contract,null,2));
