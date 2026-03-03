export type BrushMode = "paint" | "erase" | "pick" | "landmark";

export interface GroupMeta {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

export type Vec3 = [number, number, number];

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

export interface EditorSession {
  version: 1;
  modelPath: string;
  triangleCount: number;
  groupIdsEncoded: string;
  groups: GroupMeta[];
  landmarks: Landmark[];
  activeGroupId: number;
}

