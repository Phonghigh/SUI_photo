export interface ProofData {
  id: string;
  imageHash: string;
  metadataHash: string;
  proofHash: string;
  walrusBlobId: string;
  createdAt: number;
  creator?: string;
  coarseGeoHash?: string;
  caseId?: string;
}

export interface ProofRecord extends ProofData {
  txDigest: string;
  objectId: string;
}
