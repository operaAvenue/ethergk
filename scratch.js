import * as THREE from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;

const geo = new THREE.BoxGeometry(1, 1, 1);
geo.computeBoundsTree();

const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0));
const hits = geo.boundsTree.raycast(ray, THREE.DoubleSide);
console.log("HITS:", hits.length);
