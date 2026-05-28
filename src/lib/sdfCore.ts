import * as THREE from 'three';

// --- PRIMITIVES ---

export function sdSphere(p: THREE.Vector3, s: number): number {
  return p.length() - s;
}

export function sdBox(p: THREE.Vector3, b: THREE.Vector3): number {
  const d = new THREE.Vector3(Math.abs(p.x) - b.x, Math.abs(p.y) - b.y, Math.abs(p.z) - b.z);
  const lengthVec = new THREE.Vector3(Math.max(d.x, 0), Math.max(d.y, 0), Math.max(d.z, 0));
  return lengthVec.length() + Math.min(Math.max(d.x, Math.max(d.y, d.z)), 0.0);
}

export function sdCylinder(p: THREE.Vector3, h: number, r: number): number {
  const d = new THREE.Vector2(Math.abs(Math.sqrt(p.x * p.x + p.z * p.z)), Math.abs(p.y))
    .sub(new THREE.Vector2(r, h));
  return Math.min(Math.max(d.x, d.y), 0.0) + new THREE.Vector2(Math.max(d.x, 0), Math.max(d.y, 0)).length();
}

export function sdGyroid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = Math.sin(scaledP.x) * Math.cos(scaledP.y) + 
              Math.sin(scaledP.y) * Math.cos(scaledP.z) + 
              Math.sin(scaledP.z) * Math.cos(scaledP.x);
  return (Math.abs(dot) - thickness) / scale;
}

export function sdSchwarzP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  return (Math.abs(dot) - thickness) / scale;
}

export function sdDiamond(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + 
              Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + 
              Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + 
              Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(dot) - thickness) / scale;
}

export function sdNeovius(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = 3 * (Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z)) + 
              4 * Math.cos(scaledP.x) * Math.cos(scaledP.y) * Math.cos(scaledP.z);
  return (Math.abs(dot) - thickness) / scale;
}

export function sdIWP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = 2 * (Math.cos(scaledP.x) * Math.cos(scaledP.y) + 
                   Math.cos(scaledP.y) * Math.cos(scaledP.z) + 
                   Math.cos(scaledP.z) * Math.cos(scaledP.x)) - 
              (Math.cos(2 * scaledP.x) + Math.cos(2 * scaledP.y) + Math.cos(2 * scaledP.z));
  return (Math.abs(dot) - thickness) / scale;
}

export function sdFRD(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dot = 4 * Math.cos(scaledP.x) * Math.cos(scaledP.y) * Math.cos(scaledP.z) - 
              (Math.cos(2 * scaledP.x) * Math.cos(2 * scaledP.y) + 
               Math.cos(2 * scaledP.y) * Math.cos(2 * scaledP.z) + 
               Math.cos(2 * scaledP.z) * Math.cos(2 * scaledP.x));
  return (Math.abs(dot) - thickness) / scale;
}

// --- BOOLEAN OPERATIONS ---

export function opUnion(d1: number, d2: number): number {
  return Math.min(d1, d2);
}

export function opSubtract(d1: number, d2: number): number {
  // Subtract d2 (tool) from d1 (base)
  return Math.max(d1, -d2);
}

export function opIntersect(d1: number, d2: number): number {
  return Math.max(d1, d2);
}

// --- SMOOTH BOOLEANS (PicoGK Blends) ---

export function opSmoothUnion(d1: number, d2: number, k: number): number {
  const h = Math.max(k - Math.abs(d1 - d2), 0.0) / k;
  return Math.min(d1, d2) - h * h * k * 0.25;
}

export function opSmoothSubtract(d1: number, d2: number, k: number): number {
  // Smoothly subtract d2 from d1 -> smoothMax(d1, -d2)
  const h = Math.max(k - Math.abs(d1 - (-d2)), 0.0) / k;
  return Math.max(d1, -d2) + h * h * k * 0.25;
}

export function opSmoothIntersect(d1: number, d2: number, k: number): number {
  // smoothMax(d1, d2)
  const h = Math.max(k - Math.abs(d1 - d2), 0.0) / k;
  return Math.max(d1, d2) + h * h * k * 0.25;
}

// --- MODIFIERS ---

export function opOffset(d: number, offset: number): number {
  // Negative offset thickens, positive shrinks (or vice-versa depending on SDF convention, usually d - offset dilates)
  return d - offset;
}

export function opShell(d: number, thickness: number): number {
  return Math.abs(d) - thickness;
}

// Transform a point
export function opTransform(p: THREE.Vector3, position: THREE.Vector3): THREE.Vector3 {
  return p.clone().sub(position);
}
