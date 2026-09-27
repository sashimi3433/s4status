export type ServiceKind = "s3" | "iam";

export interface Region {
  /** endpoint_domain segment, e.g. "eu-luxembourg-1" */
  id: string;
  /** English city name used as the canonical label */
  city: string;
  zone: 1 | 2;
}

/**
 * Source: https://help.mega.io/megas4/setup-guides/mega-s4-endpoint-urls
 * Endpoint pattern: {s3|iam}.<endpoint_domain>.megas4.com
 */
export const REGIONS: Region[] = [
  { id: "eu-luxembourg-1", city: "Luxembourg", zone: 1 },
  { id: "eu-luxembourg-2", city: "Luxembourg", zone: 2 },
  { id: "eu-amsterdam-1", city: "Amsterdam", zone: 1 },
  { id: "eu-amsterdam-2", city: "Amsterdam", zone: 2 },
  { id: "eu-paris-1", city: "Paris", zone: 1 },
  { id: "eu-paris-2", city: "Paris", zone: 2 },
  { id: "eu-barcelona-1", city: "Barcelona", zone: 1 },
  { id: "eu-barcelona-2", city: "Barcelona", zone: 2 },
  { id: "ca-montreal-1", city: "Montreal", zone: 1 },
  { id: "ca-montreal-2", city: "Montreal", zone: 2 },
  { id: "ca-vancouver-1", city: "Vancouver", zone: 1 },
  { id: "ca-vancouver-2", city: "Vancouver", zone: 2 },
  { id: "ap-tokyo-1", city: "Tokyo", zone: 1 },
  { id: "ap-tokyo-2", city: "Tokyo", zone: 2 },
];

export interface Endpoint {
  key: string; // e.g. "s3:eu-luxembourg-1"
  service: ServiceKind;
  regionId: string;
  url: string; // e.g. "https://s3.eu-luxembourg-1.megas4.com"
}

export const ENDPOINTS: Endpoint[] = REGIONS.flatMap(({ id }) =>
  (["s3", "iam"] as const).map((service) => ({
    key: `${service}:${id}`,
    service,
    regionId: id,
    url: `${service}.${id}.megas4.com`,
  })),
);

export const endpointOf = (key: string): Endpoint | undefined =>
  ENDPOINTS.find((e) => e.key === key);
