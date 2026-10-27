"""Integration test for reproducible graph export and the committed SQL constraints."""
import json, pathlib, sqlite3, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parent
with tempfile.TemporaryDirectory() as folder:
    data = pathlib.Path(folder) / 'graph.json'
    database = pathlib.Path(folder) / 'graph.sqlite'
    subprocess.run(['node','scripts/export-mapping.mjs',str(data)],cwd=root,check=True)
    subprocess.run(['python3','scripts/build-mapping-db.py',str(data),str(database)],cwd=root,check=True)
    graph = json.loads(data.read_text())
    db = sqlite3.connect(database)
    db.execute('PRAGMA foreign_keys=ON')
    assert db.execute('SELECT COUNT(*) FROM entity').fetchone()[0] == len(graph['nodes'])
    assert db.execute('SELECT COUNT(*) FROM relationship').fetchone()[0] == len(graph['edges'])
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    assert db.execute('SELECT COUNT(*) FROM evidence').fetchone()[0] > 100
    row = db.execute('SELECT * FROM relationship LIMIT 1').fetchone()
    try:
        db.execute('INSERT INTO relationship VALUES (?,?,?,?,?,?,?)', ('bad-edge',row[1],row[2],row[4],row[3],row[5],row[6]))
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('Wrong endpoint kinds were accepted')
    db.close()
print('SQLite mapping checks passed: exported counts, native evidence, foreign keys and endpoint-type enforcement.')
