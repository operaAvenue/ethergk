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

export function opRotate(p: THREE.Vector3, rotation: THREE.Euler): THREE.Vector3 {
  // To rotate an object forward, we must rotate the sampling space backwards
  const invRot = rotation.clone();
  invRot.x = -invRot.x;
  invRot.y = -invRot.y;
  invRot.z = -invRot.z;
  invRot.order = rotation.order === 'XYZ' ? 'ZYX' : 'XYZ'; // simplified inverse rotation for Euler
  // A much robust way is to use Quaternions
  const q = new THREE.Quaternion().setFromEuler(rotation).invert();
  return p.clone().applyQuaternion(q);
}

export function opTwist(p: THREE.Vector3, strength: number): THREE.Vector3 {
  const c = Math.cos(strength * p.y);
  const s = Math.sin(strength * p.y);
  const newX = p.x * c - p.z * s;
  const newZ = p.x * s + p.z * c;
  return new THREE.Vector3(newX, p.y, newZ);
}

export function opRepeat(p: THREE.Vector3, spacing: THREE.Vector3): THREE.Vector3 {
  const modP = p.clone();
  if (spacing.x > 0) modP.x = modP.x - spacing.x * Math.round(modP.x / spacing.x);
  if (spacing.y > 0) modP.y = modP.y - spacing.y * Math.round(modP.y / spacing.y);
  if (spacing.z > 0) modP.z = modP.z - spacing.z * Math.round(modP.z / spacing.z);
  return modP;
}

export function opMorph(d1: number, d2: number, amount: number): number {
  return d1 * (1.0 - amount) + d2 * amount;
}

// --- NEW LATTICES & TEXTURES (10) ---

export function sdLidinoid(p: THREE.Vector3): number {
  return 0.5 * (Math.sin(2*p.x)*Math.cos(p.y)*Math.sin(p.z) + Math.sin(2*p.y)*Math.cos(p.z)*Math.sin(p.x) + Math.sin(2*p.z)*Math.cos(p.x)*Math.sin(p.y)) 
       - 0.5 * (Math.cos(2*p.x)*Math.cos(2*p.y) + Math.cos(2*p.y)*Math.cos(2*p.z) + Math.cos(2*p.z)*Math.cos(2*p.x)) + 0.15;
}

export function sdSchwarzH(p: THREE.Vector3): number {
  return Math.cos(p.x)*Math.cos(p.y) + Math.cos(p.y)*Math.cos(p.z) + Math.cos(p.z)*Math.cos(p.x) - Math.sin(p.x)*Math.sin(p.y)*Math.sin(p.z);
}

export function sdGrid(p: THREE.Vector3): number {
  return Math.cos(p.x) + Math.cos(p.y) + Math.cos(p.z);
}

export function sdHoneycomb(p: THREE.Vector3): number {
  return Math.cos(p.x) + Math.cos(p.x/2 + p.y*0.866) + Math.cos(p.x/2 - p.y*0.866);
}

export function sdOctet(p: THREE.Vector3): number {
  return Math.abs(Math.cos(p.x)*Math.cos(p.y)) + Math.abs(Math.cos(p.y)*Math.cos(p.z)) + Math.abs(Math.cos(p.z)*Math.cos(p.x)) - 1.0;
}

export function sdSineWave(p: THREE.Vector3): number {
  return Math.sin(p.x) * Math.sin(p.y) * Math.sin(p.z);
}

export function sdFoam(p: THREE.Vector3): number {
  const cx = Math.cos(p.x);
  const cy = Math.cos(p.y);
  const cz = Math.cos(p.z);
  return cx*cy + cy*cz + cz*cx + 0.5;
}

export function sdFractalNoise(p: THREE.Vector3): number {
  let f = Math.sin(p.x)*Math.cos(p.y)*Math.sin(p.z);
  f += 0.5 * Math.sin(2*p.x)*Math.cos(2*p.y)*Math.sin(2*p.z);
  f += 0.25 * Math.sin(4*p.x)*Math.cos(4*p.y)*Math.sin(4*p.z);
  return f;
}

export function sdCylindricalGrid(p: THREE.Vector3): number {
  return Math.min(
    Math.cos(p.x) + Math.cos(p.y),
    Math.min(Math.cos(p.y) + Math.cos(p.z), Math.cos(p.z) + Math.cos(p.x))
  );
}

export function sdTubularGyroid(p: THREE.Vector3): number {
  const g = Math.sin(p.x)*Math.cos(p.y) + Math.sin(p.y)*Math.cos(p.z) + Math.sin(p.z)*Math.cos(p.x);
  return Math.abs(g) - 0.2;
}

// --- NEW DEFORMERS & SYMMETRY (10) ---

export function opTaper(p: THREE.Vector3, strength: number): THREE.Vector3 {
  const s = 1.0 + p.y * strength;
  return new THREE.Vector3(p.x / s, p.y, p.z / s); 
}

export function opBend(p: THREE.Vector3, strength: number): THREE.Vector3 {
  const c = Math.cos(strength * p.y);
  const s = Math.sin(strength * p.y);
  const x = p.x * c - p.y * s;
  const y = p.x * s + p.y * c;
  return new THREE.Vector3(x, y, p.z);
}

export function opQuantize(p: THREE.Vector3, step: number): THREE.Vector3 {
  if (step <= 0) return p;
  return new THREE.Vector3(
    Math.round(p.x / step) * step,
    Math.round(p.y / step) * step,
    Math.round(p.z / step) * step
  );
}

export function opRipple(p: THREE.Vector3, freq: number, amp: number): THREE.Vector3 {
  return new THREE.Vector3(
    p.x,
    p.y + Math.sin(p.x * freq) * amp + Math.cos(p.z * freq) * amp,
    p.z
  );
}

export function opSymX(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(Math.abs(p.x), p.y, p.z);
}

export function opSymY(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(p.x, Math.abs(p.y), p.z);
}

export function opSymZ(p: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, Math.abs(p.z));
}

export function opSymRadial(p: THREE.Vector3, slices: number): THREE.Vector3 {
  if (slices <= 0) return p;
  const a = Math.atan2(p.x, p.z);
  const r = Math.sqrt(p.x*p.x + p.z*p.z);
  const sliceAngle = (Math.PI * 2.0) / slices;
  const a2 = (a % sliceAngle) - (sliceAngle / 2.0);
  return new THREE.Vector3(Math.sin(a2)*r, p.y, Math.cos(a2)*r);
}

export function opElongateX(p: THREE.Vector3, length: number): THREE.Vector3 {
  const q = p.clone();
  q.x -= Math.max(-length, Math.min(length, p.x));
  return q;
}

export function opElongateY(p: THREE.Vector3, length: number): THREE.Vector3 {
  const q = p.clone();
  q.y -= Math.max(-length, Math.min(length, p.y));
  return q;
}

export function opBulge(p: THREE.Vector3, strength: number): THREE.Vector3 {
  const r2 = p.x * p.x + p.y * p.y + p.z * p.z;
  const f = 1.0 / (1.0 + strength * Math.exp(-r2 * 0.05));
  return p.clone().multiplyScalar(f);
}

export function opPinch(p: THREE.Vector3, strength: number): THREE.Vector3 {
  const r2 = p.x * p.x + p.y * p.y + p.z * p.z;
  const f = 1.0 + strength * Math.exp(-r2 * 0.05);
  return p.clone().multiplyScalar(f);
}

// --- NEW 16 TPMS & LATTICES ---

export function sdFischerKochS(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(2*scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) +
              Math.cos(2*scaledP.y)*Math.sin(scaledP.z)*Math.cos(scaledP.x) +
              Math.cos(2*scaledP.z)*Math.sin(scaledP.x)*Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdFischerKochD(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(2*scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) +
              Math.sin(2*scaledP.y)*Math.sin(scaledP.z)*Math.cos(scaledP.x) +
              Math.sin(2*scaledP.z)*Math.sin(scaledP.x)*Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSplitP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 1.5 * (Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x)) - 
              0.5 * (Math.sin(2*scaledP.x)*Math.sin(2*scaledP.y) + Math.sin(2*scaledP.y)*Math.sin(2*scaledP.z) + Math.sin(2*scaledP.z)*Math.sin(2*scaledP.x));
  return (Math.abs(val) - thickness) / scale;
}

export function sdGPrime(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.sin(scaledP.y) + Math.cos(scaledP.y)*Math.sin(scaledP.z) + Math.cos(scaledP.z)*Math.sin(scaledP.x);
  return (Math.abs(val) - thickness) / scale;
}

export function sdIWP2(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - 
              0.5 * (Math.cos(2*scaledP.x) + Math.cos(2*scaledP.y) + Math.cos(2*scaledP.z)) - 0.2;
  return (Math.abs(val) - thickness) / scale;
}

export function sdCarlyle(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z) - 
              (Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x));
  return (Math.abs(val) - thickness) / scale;
}

export function sdCrossedDecagons(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x) - 0.4;
  return (Math.abs(val) - thickness) / scale;
}

export function sdKelvin(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - 
              0.3 * Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) - 0.35;
  return (Math.abs(val) - thickness) / scale;
}

export function sdKagome(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) + 0.25;
  return (Math.abs(val) - thickness) / scale;
}

export function sdWaffle(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) * Math.cos(scaledP.y) + Math.sin(scaledP.z) * 0.5 - 0.2;
  return (Math.abs(val) - thickness) / scale;
}

export function sdChiral(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const angle = 0.2 * scaledP.z;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rx = scaledP.x * c - scaledP.y * s;
  const ry = scaledP.x * s + scaledP.y * c;
  const val = Math.sin(rx) * Math.cos(ry) + Math.sin(ry) * Math.cos(scaledP.z) + Math.sin(scaledP.z) * Math.cos(rx);
  return (Math.abs(val) - thickness) / scale;
}

export function sdRadialGrid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const r = Math.sqrt(scaledP.x*scaledP.x + scaledP.z*scaledP.z);
  const val = Math.cos(r) + Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdHerringbone(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x + Math.sin(scaledP.y)) * Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdWeairePhelan(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x) + 
              0.4 * (Math.cos(2*scaledP.x) + Math.cos(2*scaledP.y) + Math.cos(2*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdBoxFrame(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const qx = Math.abs(scaledP.x - Math.round(scaledP.x / (Math.PI*2)) * (Math.PI*2)) - 1.5;
  const qy = Math.abs(scaledP.y - Math.round(scaledP.y / (Math.PI*2)) * (Math.PI*2)) - 1.5;
  const qz = Math.abs(scaledP.z - Math.round(scaledP.z / (Math.PI*2)) * (Math.PI*2)) - 1.5;
  const d1 = Math.max(qx, qy);
  const d2 = Math.max(qy, qz);
  const d3 = Math.max(qz, qx);
  const val = Math.min(d1, Math.min(d2, d3)) - thickness;
  return val / scale;
}

export function sdOctahedral(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const qx = Math.abs(scaledP.x - Math.round(scaledP.x / (Math.PI*2)) * (Math.PI*2));
  const qy = Math.abs(scaledP.y - Math.round(scaledP.y / (Math.PI*2)) * (Math.PI*2));
  const qz = Math.abs(scaledP.z - Math.round(scaledP.z / (Math.PI*2)) * (Math.PI*2));
  const val = (qx + qy + qz) - 2.5;
  return (Math.abs(val) - thickness) / scale;
}

export function sdDoubleGyroid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const dotP = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x);
  return (Math.abs(Math.abs(dotP) - 0.5) - thickness) / scale;
}

export function sdDoubleSchwarzP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  return (Math.abs(Math.abs(val) - 1.0) - thickness) / scale;
}

export function sdDoubleDiamond(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(Math.abs(val) - 0.5) - thickness) / scale;
}

export function sdSchwarzCLP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.z) + Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchwarzT(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchoenIQP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 17.0 * (Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z)) - 3.0 * (Math.cos(2.0*scaledP.x)*Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.y)*Math.cos(2.0*scaledP.z) + Math.cos(2.0*scaledP.z)*Math.cos(2.0*scaledP.x));
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchoenS(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) - Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchoenM(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(2.0*scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(2.0*scaledP.y)*Math.sin(scaledP.z)*Math.cos(scaledP.x) + Math.cos(2.0*scaledP.z)*Math.sin(scaledP.x)*Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchoenY(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.y)*Math.sin(scaledP.z)*Math.cos(scaledP.x) + Math.cos(scaledP.z)*Math.sin(scaledP.x)*Math.cos(scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchoenHT(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 2.0*(Math.cos(scaledP.x) + Math.cos(scaledP.y))*Math.cos(scaledP.z) - Math.cos(2.0*scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdKarcherSchwarz(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 3.0*(Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z)) + 8.0*Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdNodal4Fold(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.y) + Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.z)*Math.sin(scaledP.x);
  return (Math.abs(val) - thickness) / scale;
}

export function sdNodal8Fold(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(2.0*scaledP.x)*Math.sin(2.0*scaledP.y) + Math.sin(2.0*scaledP.y)*Math.sin(2.0*scaledP.z) + Math.sin(2.0*scaledP.z)*Math.sin(2.0*scaledP.x);
  return (Math.abs(val) - thickness) / scale;
}

export function sdComplementaryIWP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 2.0 * (Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x)) - (Math.cos(2.0*scaledP.x) + Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.z));
  return (-val - thickness) / scale;
}

export function sdSchoenSPrime(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) - 0.5*(Math.cos(2.0*scaledP.x) + Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdBarthSextic(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 4.0*(Math.cos(scaledP.x)*Math.cos(scaledP.x) + Math.cos(scaledP.y)*Math.cos(scaledP.y) + Math.cos(scaledP.z)*Math.cos(scaledP.z)) - 5.0;
  return (Math.abs(val) - thickness) / scale;
}

export function sdKummerQuartic(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) - 0.25*(Math.cos(2.0*scaledP.x) + Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdTogliattiQuintic(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - 0.1*(Math.cos(3.0*scaledP.x) + Math.cos(3.0*scaledP.y) + Math.cos(3.0*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdClebschCubic(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + 0.1*(Math.cos(3.0*scaledP.x) + Math.cos(3.0*scaledP.y) + Math.cos(3.0*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdCayleyCubic(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - 1.0;
  return (Math.abs(val) - thickness) / scale;
}

export function sdTubularDiamond(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(Math.abs(val) - 0.2) - thickness) / scale;
}

export function sdTubularSchwarzP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  return (Math.abs(Math.abs(val) - 0.2) - thickness) / scale;
}

export function sdTubularNeovius(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 3.0 * (Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z)) + 4.0 * Math.cos(scaledP.x) * Math.cos(scaledP.y) * Math.cos(scaledP.z);
  return (Math.abs(Math.abs(val) - 0.25) - thickness) / scale;
}

export function sdTubularLidinoid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 0.5 * (Math.sin(2.0*scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z) + Math.sin(2.0*scaledP.y)*Math.cos(scaledP.z)*Math.sin(scaledP.x) + Math.sin(2.0*scaledP.z)*Math.cos(scaledP.x)*Math.sin(scaledP.y)) - 0.5 * (Math.cos(2.0*scaledP.x)*Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.y)*Math.cos(2.0*scaledP.z) + Math.cos(2.0*scaledP.z)*Math.cos(2.0*scaledP.x)) + 0.15;
  return (Math.abs(Math.abs(val) - 0.15) - thickness) / scale;
}

export function sdSuperGyroid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale * 2.0);
  const dotP = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x);
  return (Math.abs(dotP) - thickness) / (scale * 2.0);
}

export function sdSuperSchwarzP(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale * 2.0);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / (scale * 2.0);
}

export function sdSuperDiamond(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale * 2.0);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(val) - thickness) / (scale * 2.0);
}

export function sdGyroidSchwarzHybrid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const valG = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x);
  const valS = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  const val = valG * 0.5 + valS * 0.5;
  return (Math.abs(val) - thickness) / scale;
}

export function sdGyroidDiamondHybrid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const valG = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x);
  const valD = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  const val = valG * 0.5 + valD * 0.5;
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchwarzDiamondHybrid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const valS = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z);
  const valD = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z);
  const val = valS * 0.5 + valD * 0.5;
  return (Math.abs(val) - thickness) / scale;
}

export function sdHelicoid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.z - Math.atan2(scaledP.y, scaledP.x));
  return (Math.abs(val) - thickness) / scale;
}

export function sdDoubleHelicoid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.abs(Math.sin(scaledP.z - Math.atan2(scaledP.y, scaledP.x)));
  return (Math.abs(val) - thickness) / scale;
}

export function sdTriangularHoneycomb(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.x - scaledP.y);
  return (Math.abs(val) - thickness) / scale;
}

export function sdKagome3D(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) + Math.cos(scaledP.x + scaledP.y + scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdBoricAcidLayer(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) - 0.5;
  return (Math.abs(val) - thickness) / scale;
}

export function sdPoreNetwork(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 1.0 - (Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x));
  return (Math.abs(val) - thickness) / scale;
}

export function sdSaddle(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) - Math.cos(scaledP.y) + Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdDoubleSaddle(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.abs(Math.cos(scaledP.x) - Math.cos(scaledP.y) + Math.cos(scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdComplementaryFRD(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 4.0 * Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) - (Math.cos(2.0*scaledP.x)*Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.y)*Math.cos(2.0*scaledP.z) + Math.cos(2.0*scaledP.z)*Math.cos(2.0*scaledP.x));
  return (-val - thickness) / scale;
}

export function sdStaircaseGyroid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x+scaledP.z)*Math.cos(scaledP.y) + Math.sin(scaledP.y+scaledP.x)*Math.cos(scaledP.z) + Math.sin(scaledP.z+scaledP.y)*Math.cos(scaledP.x);
  return (Math.abs(val) - thickness) / scale;
}

export function sdTwistedGyroid(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x*Math.cos(scaledP.z))*Math.cos(scaledP.y*Math.sin(scaledP.x)) + Math.sin(scaledP.y*Math.cos(scaledP.x))*Math.cos(scaledP.z*Math.sin(scaledP.y)) + Math.sin(scaledP.z*Math.cos(scaledP.y))*Math.cos(scaledP.x*Math.sin(scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdChiralDiamond(p: THREE.Vector3, scale: number, thickness: number): number {
  const baseD = sdDiamond(p, scale, thickness);
  const scaledP = p.clone().multiplyScalar(scale);
  return baseD + 0.1 * Math.sin(scaledP.x + scaledP.y) / scale;
}

export function sdOctetTrussVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.abs(Math.sin(scaledP.x)*Math.cos(scaledP.y)) + Math.abs(Math.sin(scaledP.y)*Math.cos(scaledP.z)) + Math.abs(Math.sin(scaledP.z)*Math.cos(scaledP.x)) - 1.0;
  return (Math.abs(val) - thickness) / scale;
}

export function sdKelvinFoam(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) + Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.z)*Math.cos(scaledP.x) - 0.2;
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchwarzHPrime(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x)*Math.cos(scaledP.y) - Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdGyroidVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.cos(scaledP.y) + Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.sin(scaledP.z)*Math.cos(scaledP.x) + 0.5*Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdSchwarzPVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z) + 0.5*Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdDiamondVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = Math.sin(scaledP.x)*Math.sin(scaledP.y)*Math.sin(scaledP.z) + Math.sin(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.sin(scaledP.y)*Math.cos(scaledP.z) + Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z) + 0.2*Math.cos(scaledP.x)*Math.cos(scaledP.y)*Math.cos(scaledP.z);
  return (Math.abs(val) - thickness) / scale;
}

export function sdNeoviusVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 3.0 * (Math.cos(scaledP.x) + Math.cos(scaledP.y) + Math.cos(scaledP.z)) + 4.0 * Math.cos(scaledP.x) * Math.cos(scaledP.y) * Math.cos(scaledP.z) + 0.5*(Math.cos(2.0*scaledP.x) + Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.z));
  return (Math.abs(val) - thickness) / scale;
}

export function sdLidinoidVariant(p: THREE.Vector3, scale: number, thickness: number): number {
  const scaledP = p.clone().multiplyScalar(scale);
  const val = 0.5 * (Math.sin(2.0*scaledP.x)*Math.cos(scaledP.y)*Math.sin(scaledP.z) + Math.sin(2.0*scaledP.y)*Math.cos(scaledP.z)*Math.sin(scaledP.x) + Math.sin(2.0*scaledP.z)*Math.cos(scaledP.x)*Math.sin(scaledP.y)) - 0.5 * (Math.cos(2.0*scaledP.x)*Math.cos(2.0*scaledP.y) + Math.cos(2.0*scaledP.y)*Math.cos(2.0*scaledP.z) + Math.cos(2.0*scaledP.z)*Math.cos(2.0*scaledP.x)) + 0.3;
  return (Math.abs(val) - thickness) / scale;
}
