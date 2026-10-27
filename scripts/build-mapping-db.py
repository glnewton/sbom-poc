"""Build a new SQLite evidence graph from export-mapping.mjs output; standard library only."""
import hashlib, json, pathlib, sqlite3, sys
if len(sys.argv) != 3:
    raise SystemExit('Usage: python3 scripts/build-mapping-db.py INPUT.json NEW_DATABASE.sqlite')
source, destination = map(pathlib.Path, sys.argv[1:])
if destination.exists():
    raise SystemExit('Destination already exists; choose a new path.')
graph = json.loads(source.read_text())
if graph.get('schema_version') != 1 or graph.get('simulated') is not True:
    raise SystemExit('This exporter currently accepts the version 1 simulated POC graph only.')
if 'sources' not in graph:
    raise SystemExit('Use the CLI export with source captures, not the browser graph-only export.')
db = sqlite3.connect(destination)
try:
    db.executescript((pathlib.Path(__file__).resolve().parent.parent / 'schema/canonical-graph.sql').read_text())
    dump = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True)
    collection = hashlib.sha256(source.read_bytes()).hexdigest()
    for profile in graph['sources']['capture']['profiles']:
        db.execute('INSERT INTO mapping_profile VALUES (?,?)', (profile['id'], dump(profile)))
    db.execute('INSERT INTO collection_run VALUES (?,?,?,?)', (collection,graph['capturedAt'],graph['profileId'],1))
    db.executemany('INSERT INTO entity_type VALUES (?,?,?,?,?)', graph['catalog']['entities'])
    db.executemany('INSERT INTO rule VALUES (?,?,?)', graph['catalog']['rules'])
    db.executemany('INSERT INTO relationship_type VALUES (?,?,?,?,?,?)', graph['catalog']['relations'])
    def evidence_id(item):
        key = collection + '|' + item['source'] + '|' + item['pointer']
        eid = hashlib.sha256(key.encode()).hexdigest()
        value = graph['sources'][item['source']]
        for token in item['pointer'].split('/')[1:]:
            token = token.replace('~1','/').replace('~0','~')
            value = value[int(token)] if isinstance(value,list) else value[token]
        db.execute('INSERT OR IGNORE INTO evidence VALUES (?,?,?,?,?,?)', (eid,collection,item['source'],item['pointer'],item.get('capturedAt',graph['capturedAt']),dump(value)))
        return eid
    ids = {node['id'] for node in graph['nodes']}
    for node in graph['nodes']:
        db.execute('INSERT INTO entity VALUES (?,?,?,?,?)', (node['id'],collection,node['type'],node['label'],dump(node['attributes'])))
        for item in node['provenance']:
            db.execute('INSERT OR IGNORE INTO entity_evidence VALUES (?,?)', (node['id'],evidence_id(item)))
    for edge in graph['edges']:
        db.execute('INSERT INTO relationship VALUES (?,?,?,?,?,?,?)', (edge['id'],collection,edge['type'],edge['from'],edge['to'],edge['rule'],dump(edge['attributes'])))
        for item in edge['provenance']:
            db.execute('INSERT OR IGNORE INTO relationship_evidence VALUES (?,?)', (edge['id'],evidence_id(item)))
    for issue in graph['issues']:
        db.execute('INSERT INTO issue(collection_id,code,subject_id,message,detail_json) VALUES (?,?,?,?,?)', (collection,issue['code'],issue.get('subject') if issue.get('subject') in ids else None,issue['message'],dump(issue)))
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.commit()
    print('Created SQLite graph:', len(graph['nodes']), 'entities,', len(graph['edges']), 'relationships; foreign keys verified.')
except Exception:
    db.rollback(); db.close(); destination.unlink(missing_ok=True); raise
else:
    db.close()
