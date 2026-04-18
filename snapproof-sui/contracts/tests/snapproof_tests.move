#[test_only]
module snapproof::snapproof_tests {
    use std::string;
    use sui::test_scenario;
    use snapproof::snapproof::{Self, PhotoProof};

    #[test]
    fun test_create_proof() {
        let creator = @0xA;
        let mut scenario = test_scenario::begin(creator);

        // Create a proof
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            snapproof::create_proof(
                string::utf8(b"walrus-blob-123"),
                string::utf8(b"abc123imagehash"),
                string::utf8(b"def456metahash"),
                string::utf8(b"combined-proof-hash"),
                1700000000000,
                string::utf8(b""),
                string::utf8(b""),
                ctx,
            );
        };

        // Verify the proof was created and transferred to creator
        test_scenario::next_tx(&mut scenario, creator);
        {
            let proof = test_scenario::take_from_sender<PhotoProof>(&scenario);
            assert!(snapproof::creator(&proof) == creator);
            assert!(snapproof::image_hash(&proof) == string::utf8(b"abc123imagehash"));
            assert!(snapproof::walrus_blob_id(&proof) == string::utf8(b"walrus-blob-123"));
            assert!(snapproof::created_at(&proof) == 1700000000000);
            test_scenario::return_to_sender(&scenario, proof);
        };

        test_scenario::end(scenario);
    }
}
