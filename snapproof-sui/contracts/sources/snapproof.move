/// SnapProof: On-chain photo evidence timestamping
///
/// Each PhotoProof object stores the hash of an image and its metadata,
/// along with a reference to the Walrus blob. Anyone can later verify
/// that a photo existed at a certain time by comparing hashes.
module snapproof::snapproof {
    use std::string::String;
    use sui::event;

    /// A timestamped proof record for a photo.
    public struct PhotoProof has key, store {
        id: UID,
        /// Address of the proof creator
        creator: address,
        /// Walrus blob ID where the image is stored
        walrus_blob_id: String,
        /// SHA-256 hash of the image bytes
        image_hash: String,
        /// SHA-256 hash of selected metadata
        metadata_hash: String,
        /// Combined proof hash (image_hash + metadata_hash)
        proof_hash: String,
        /// Timestamp when the proof was created (milliseconds)
        created_at: u64,
        /// Optional coarse geohash for location
        coarse_geo_hash: String,
        /// Optional case or report identifier
        case_id: String,
    }

    /// Event emitted when a new proof is created.
    public struct ProofCreated has copy, drop {
        proof_id: ID,
        creator: address,
        image_hash: String,
        proof_hash: String,
        created_at: u64,
        coarse_geo_hash: String,
    }

    /// Create a new photo proof and transfer it to the sender.
    public fun create_proof(
        walrus_blob_id: String,
        image_hash: String,
        metadata_hash: String,
        proof_hash: String,
        created_at: u64,
        coarse_geo_hash: String,
        case_id: String,
        ctx: &mut TxContext,
    ) {
        let creator = ctx.sender();
        let proof = PhotoProof {
            id: object::new(ctx),
            creator,
            walrus_blob_id,
            image_hash,
            metadata_hash,
            proof_hash,
            created_at,
            coarse_geo_hash,
            case_id,
        };

        event::emit(ProofCreated {
            proof_id: object::id(&proof),
            creator,
            image_hash: proof.image_hash,
            proof_hash: proof.proof_hash,
            created_at,
            coarse_geo_hash: proof.coarse_geo_hash,
        });

        transfer::transfer(proof, creator);
    }

    // === Accessors ===

    public fun creator(proof: &PhotoProof): address {
        proof.creator
    }

    public fun image_hash(proof: &PhotoProof): String {
        proof.image_hash
    }

    public fun metadata_hash(proof: &PhotoProof): String {
        proof.metadata_hash
    }

    public fun proof_hash(proof: &PhotoProof): String {
        proof.proof_hash
    }

    public fun walrus_blob_id(proof: &PhotoProof): String {
        proof.walrus_blob_id
    }

    public fun created_at(proof: &PhotoProof): u64 {
        proof.created_at
    }

    public fun coarse_geo_hash(proof: &PhotoProof): String {
        proof.coarse_geo_hash
    }

    public fun case_id(proof: &PhotoProof): String {
        proof.case_id
    }
}
