export type ApiKind = "s3" | "iam";
export type OpGroup = "buckets" | "objects" | "multipart" | "policies" | "iam-policies";

export interface Operation {
  id: string; // e.g. "ListBuckets"
  api: ApiKind;
  group: OpGroup;
}

/**
 * S3 & IAM operations covered by MEGA S4.
 * Source: https://github.com/meganz/s4-specs
 * Note: PutBucketAcl / PutObjectAcl are permanently unsupported in S4
 * (always 400 AccessControlListNotSupported), so they are not monitored.
 */
export const OPERATIONS: Operation[] = [
  // --- S3 API: bucket services ---
  { id: "ListBuckets", api: "s3", group: "buckets" },
  { id: "CreateBucket", api: "s3", group: "buckets" },
  { id: "DeleteBucket", api: "s3", group: "buckets" },
  { id: "HeadBucket", api: "s3", group: "buckets" },
  { id: "GetBucketLocation", api: "s3", group: "buckets" },
  { id: "GetBucketAcl", api: "s3", group: "buckets" },
  // --- S3 API: object services ---
  { id: "ListObjects", api: "s3", group: "objects" },
  { id: "ListObjectsV2", api: "s3", group: "objects" },
  { id: "PutObject", api: "s3", group: "objects" },
  { id: "CopyObject", api: "s3", group: "objects" },
  { id: "GetObject", api: "s3", group: "objects" },
  { id: "HeadObject", api: "s3", group: "objects" },
  { id: "DeleteObject", api: "s3", group: "objects" },
  { id: "DeleteObjects", api: "s3", group: "objects" },
  // --- S3 API: multipart uploads ---
  { id: "CreateMultipartUpload", api: "s3", group: "multipart" },
  { id: "UploadPart", api: "s3", group: "multipart" },
  { id: "UploadPartCopy", api: "s3", group: "multipart" },
  { id: "ListParts", api: "s3", group: "multipart" },
  { id: "CompleteMultipartUpload", api: "s3", group: "multipart" },
  { id: "ListMultipartUploads", api: "s3", group: "multipart" },
  { id: "AbortMultipartUpload", api: "s3", group: "multipart" },
  // --- S3 API: policies & object ACL ---
  { id: "GetObjectAcl", api: "s3", group: "policies" },
  { id: "PutBucketPolicy", api: "s3", group: "policies" },
  { id: "GetBucketPolicy", api: "s3", group: "policies" },
  { id: "DeleteBucketPolicy", api: "s3", group: "policies" },
  // --- IAM API: policies ---
  { id: "GetPolicy", api: "iam", group: "iam-policies" },
  { id: "GetPolicyVersion", api: "iam", group: "iam-policies" },
  { id: "ListPolicies", api: "iam", group: "iam-policies" },
  { id: "ListAttachedUserPolicies", api: "iam", group: "iam-policies" },
  { id: "ListAttachedGroupPolicies", api: "iam", group: "iam-policies" },
  { id: "AttachUserPolicy", api: "iam", group: "iam-policies" },
  { id: "AttachGroupPolicy", api: "iam", group: "iam-policies" },
  { id: "DetachUserPolicy", api: "iam", group: "iam-policies" },
  { id: "DetachGroupPolicy", api: "iam", group: "iam-policies" },
];

export interface OpSection {
  api: ApiKind;
  group: OpGroup;
  ops: Operation[];
}

export const OP_SECTIONS: OpSection[] = [
  { api: "s3", group: "buckets", ops: OPERATIONS.filter((o) => o.group === "buckets") },
  { api: "s3", group: "objects", ops: OPERATIONS.filter((o) => o.group === "objects") },
  { api: "s3", group: "multipart", ops: OPERATIONS.filter((o) => o.group === "multipart") },
  { api: "s3", group: "policies", ops: OPERATIONS.filter((o) => o.group === "policies") },
  { api: "iam", group: "iam-policies", ops: OPERATIONS.filter((o) => o.group === "iam-policies") },
];
