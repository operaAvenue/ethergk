import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

export class Voxelizer {
  public marchingCubes: MarchingCubes;
  private resolution: number;
  private size: number;

  constructor(resolution: number = 64, size: number = 10) {
    this.resolution = resolution;
    this.size = size;
    
    // Material is just for visual display if we render the MarchingCubes directly.
    // We typically extract its geometry.
    const material = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      roughness: 0.4,
      metalness: 0.1,
    });
    
    // resolution, material, enableUvs, enableColors, maxPolyCount
    this.marchingCubes = new MarchingCubes(resolution, material, false, true, 500000);
    this.marchingCubes.isolation = 0; // Surface is at distance 0 (SDF convention)
  }

  // Evaluates a custom SDF function over the entire grid
  public evaluateSDF(sdfFunction: (p: THREE.Vector3) => { dist: number, color: THREE.Color }) {
    const res = this.resolution;
    const size = this.size;
    const halfSize = size / 2;
    
    // The grid in MarchingCubes goes from 0 to resolution-1.
    // We need to map this to our world coordinates (-halfSize to +halfSize).
    const step = size / (res - 1);
    const p = new THREE.Vector3();
    
    let index = 0;
    // MarchingCubes uses Z, Y, X iteration order internally for its field array.
    for (let k = 0; k < res; k++) {
      p.z = -halfSize + k * step;
      for (let j = 0; j < res; j++) {
        p.y = -halfSize + j * step;
        for (let i = 0; i < res; i++) {
          p.x = -halfSize + i * step;
          
          // Evaluate the SDF
          const res = sdfFunction(p);
          
          // MarchingCubes extracts the surface where field == isolation (which is 0).
          // Normally inside is > isolation and outside is < isolation in Three.js MarchingCubes.
          // In standard SDF: inside is negative, outside is positive.
          // So we need to invert the distance so that inside > 0 and outside < 0.
          this.marchingCubes.field[index] = -res.dist;
          this.marchingCubes.palette[index * 3] = res.color.r;
          this.marchingCubes.palette[index * 3 + 1] = res.color.g;
          this.marchingCubes.palette[index * 3 + 2] = res.color.b;
          index++;
        }
      }
    }
    
    // Recompute the mesh
    this.marchingCubes.update();
  }
  
  public getGeometry(): THREE.BufferGeometry {
    return this.marchingCubes.geometry;
  }
}
