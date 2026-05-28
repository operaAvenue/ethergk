const fs = require('fs');
const THREE = require('three');
const { STLLoader } = require('three/examples/jsm/loaders/STLLoader.js');
const { computeBoundsTree } = require('three-mesh-bvh');
const BufferGeometryUtils = require('three/examples/jsm/utils/BufferGeometryUtils.js');

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;

const buffer = fs.readFileSync('part8.stl');
const arrayBuffer = new Uint8Array(buffer).buffer;

const loader = new STLLoader();
let geometry = loader.parse(arrayBuffer);

geometry.computeBoundingBox();
const bbox = geometry.boundingBox;
const size = new THREE.Vector3();
bbox.getSize(size);

const maxDim = Math.max(size.x, size.y, size.z);
const targetMax = 10 * 0.8;
const scaleFactor = targetMax / maxDim;

geometry.center(); 
geometry.scale(scaleFactor, scaleFactor, scaleFactor);

if (!geometry.index) {
  geometry = BufferGeometryUtils.mergeVertices(geometry, 1e-4);
}

geometry.computeVertexNormals();
geometry.computeBoundsTree();

const p = new THREE.Vector3(0, 0, 0); 
const targetInfo = {};
geometry.boundsTree.closestPointToPoint(p, targetInfo);
let signedDist = targetInfo.distance;
const dir = new THREE.Vector3(Math.PI, Math.E, Math.SQRT2).normalize();
const ray = new THREE.Ray(p, dir);
const hits = geometry.boundsTree.raycast(ray, THREE.DoubleSide);
console.log("Hits at origin:", hits.length);

const pOut = new THREE.Vector3(10, 10, 10);
const targetInfoOut = {};
geometry.boundsTree.closestPointToPoint(pOut, targetInfoOut);
let signedDistOut = targetInfoOut.distance;
const rayOut = new THREE.Ray(pOut, dir);
const hitsOut = geometry.boundsTree.raycast(rayOut, THREE.DoubleSide);
console.log("Hits at outside:", hitsOut.length);
