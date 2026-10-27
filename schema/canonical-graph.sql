-- Implemented SQLite graph persistence contract. Logical entities are typed rows.
-- Source captures and observations are immutable within a collection export.
PRAGMA foreign_keys = ON;
CREATE TABLE mapping_profile (id TEXT PRIMARY KEY, definition_json TEXT NOT NULL CHECK(json_valid(definition_json)));
CREATE TABLE collection_run (id TEXT PRIMARY KEY, captured_at TEXT NOT NULL, profile_id TEXT NOT NULL REFERENCES mapping_profile(id), simulated INTEGER NOT NULL CHECK(simulated IN(0,1)));
CREATE TABLE entity_type (id TEXT PRIMARY KEY, label TEXT NOT NULL, identity_scope TEXT NOT NULL, native_source TEXT NOT NULL, description TEXT NOT NULL);
CREATE TABLE rule (id TEXT PRIMARY KEY, name TEXT NOT NULL, policy TEXT NOT NULL);
CREATE TABLE relationship_type (id TEXT PRIMARY KEY, from_kind TEXT NOT NULL REFERENCES entity_type(id), to_kind TEXT NOT NULL REFERENCES entity_type(id), cardinality TEXT NOT NULL, predicate TEXT NOT NULL, rule_id TEXT NOT NULL REFERENCES rule(id));
CREATE TABLE entity (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection_run(id), kind TEXT NOT NULL REFERENCES entity_type(id), label TEXT NOT NULL, attributes_json TEXT NOT NULL CHECK(json_valid(attributes_json)));
CREATE INDEX entity_kind_label ON entity(kind,label);
CREATE TABLE evidence (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection_run(id), source TEXT NOT NULL, json_pointer TEXT NOT NULL, captured_at TEXT NOT NULL, native_record_json TEXT NOT NULL CHECK(json_valid(native_record_json)), UNIQUE(collection_id,source,json_pointer));
CREATE TABLE entity_evidence (entity_id TEXT NOT NULL REFERENCES entity(id), evidence_id TEXT NOT NULL REFERENCES evidence(id), PRIMARY KEY(entity_id,evidence_id));
CREATE TABLE relationship (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection_run(id), type TEXT NOT NULL REFERENCES relationship_type(id), from_id TEXT NOT NULL REFERENCES entity(id), to_id TEXT NOT NULL REFERENCES entity(id), rule_id TEXT NOT NULL REFERENCES rule(id), attributes_json TEXT NOT NULL CHECK(json_valid(attributes_json)), UNIQUE(collection_id,type,from_id,to_id));
CREATE INDEX relationship_from ON relationship(from_id,type);
CREATE INDEX relationship_to ON relationship(to_id,type);
CREATE TABLE relationship_evidence (relationship_id TEXT NOT NULL REFERENCES relationship(id), evidence_id TEXT NOT NULL REFERENCES evidence(id), PRIMARY KEY(relationship_id,evidence_id));
CREATE TABLE issue (id INTEGER PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection_run(id), code TEXT NOT NULL, subject_id TEXT REFERENCES entity(id), message TEXT NOT NULL, detail_json TEXT NOT NULL CHECK(json_valid(detail_json)));
CREATE TRIGGER relationship_type_check BEFORE INSERT ON relationship BEGIN
 SELECT CASE WHEN (SELECT kind FROM entity WHERE id=NEW.from_id)!=(SELECT from_kind FROM relationship_type WHERE id=NEW.type) OR (SELECT kind FROM entity WHERE id=NEW.to_id)!=(SELECT to_kind FROM relationship_type WHERE id=NEW.type) THEN RAISE(ABORT,'Relationship endpoint type mismatch') END;
 SELECT CASE WHEN NEW.rule_id!=(SELECT rule_id FROM relationship_type WHERE id=NEW.type) THEN RAISE(ABORT,'Relationship rule mismatch') END;
END;
