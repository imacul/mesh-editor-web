export type BrushMode = "paint" | "erase" | "pick" | "landmark" | "trimCurve";

export type GroupType = "default" | "relief";

export interface GroupMeta {
  id: number;
  name: string;
  color: string;
  visible: boolean;
  type: GroupType;
}

export type Vec3 = [number, number, number];

export interface ModelTransform {
  position: Vec3;
  rotation: Vec3;
  scale: number;
}

export interface Landmark {
  id: string;
  name: string;
  position: Vec3;
  normal: Vec3;
  groupId: number;
}

export interface TriangleChange {
  triangleIndex: number;
  prevGroupId: number;
  nextGroupId: number;
}

export interface PaintOperation {
  id: string;
  changes: TriangleChange[];
}

export interface PerfStats {
  fps: number;
  strokeMs: number;
  strokeTriangles: number;
}

export type CurveKind = "trim" | "seam";

export interface SurfaceCurvePoint {
  id: string;
  triangleIndex: number;
  barycentricCoords: [number, number, number];
  worldPosition: Vec3;
}

export interface SurfaceCurve {
  id: string;
  name: string;
  kind: CurveKind;
  closed: boolean;
  points: SurfaceCurvePoint[];
}

export interface SplintSettings {
  baseClearance: number;
  reliefExtraClearance: number;
  thickness: number;
  seamCutWidth: number;
  borderSmoothIterations: number;
}

export interface EditorSession {
  version: 1;
  modelPath: string;
  modelTransform?: ModelTransform;
  triangleCount: number;
  triangleOrderHash?: string;
  groupIdsEncoded: string;
  groups: GroupMeta[];
  landmarks: Landmark[];
  activeGroupId: number;
  curves?: SurfaceCurve[];
  activeCurveId?: string | null;
  regionSeedTriangleIndex?: number | null;
  inRegion?: boolean[];
  splintSettings?: SplintSettings;
}
