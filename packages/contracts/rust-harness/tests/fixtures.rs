use std::{fs, path::Path};

use jsonschema::validator_for;
use serde_json::Value;

const CONTRACTS_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/..");
const SCHEMAS: &[&str] = &[
    "core-info",
    "workflow",
    "plugin-manifest",
    "plugin-json-rpc-message",
    "core-sse-event",
    "connection-context-export",
    "provider-model-capabilities",
    "problem-details",
];

fn read_json(path: impl AsRef<Path>) -> Value {
    serde_json::from_slice(&fs::read(path).expect("contract fixture should be readable"))
        .expect("contract fixture should be JSON")
}

#[test]
fn validates_the_same_valid_and_invalid_fixtures_as_typescript() {
    for name in SCHEMAS {
        let schema = read_json(format!("{CONTRACTS_DIR}/schemas/{name}.schema.json"));
        let validator = validator_for(&schema).expect("schema should compile");
        let valid = read_json(format!("{CONTRACTS_DIR}/fixtures/{name}.valid.json"));
        let invalid = read_json(format!("{CONTRACTS_DIR}/fixtures/{name}.invalid.json"));

        assert!(
            validator.validate(&valid).is_ok(),
            "{name} valid fixture was rejected"
        );
        assert!(
            validator.validate(&invalid).is_err(),
            "{name} invalid fixture was accepted"
        );
    }
}
