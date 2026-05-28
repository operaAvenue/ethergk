import * as THREE from 'three';
import { Evaluator, Brush, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';

export function applyCSGOperation(
  baseGeometry: THREE.BufferGeometry,
  operation: 'subtract' | 'intersect' | 'union',
  toolShape: 'box' | 'sphere',
  toolScale: number,
  toolPosition: [number, number, number]
): THREE.BufferGeometry {
  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];

  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const toolMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

  const brush1 = new Brush(baseGeometry, baseMaterial);
  brush1.updateMatrixWorld();

  let toolGeo;
  if (toolShape === 'box') {
    toolGeo = new THREE.BoxGeometry(1, 1, 1);
  } else {
    toolGeo = new THREE.SphereGeometry(0.5, 32, 32);
  }

  // Remove uv attribute to match STLLoader geometry (which only has position and normal)
  // This prevents three-bvh-csg from crashing when it tries to interpolate uvs
  toolGeo.deleteAttribute('uv');

  const brush2 = new Brush(toolGeo, toolMaterial);
  brush2.position.set(...toolPosition);
  brush2.scale.set(toolScale, toolScale, toolScale);
  brush2.updateMatrixWorld();

  let result;
  switch (operation) {
    case 'subtract':
      result = evaluator.evaluate(brush1, brush2, SUBTRACTION);
      break;
    case 'intersect':
      result = evaluator.evaluate(brush1, brush2, INTERSECTION);
      break;
    case 'union':
    default:
      result = evaluator.evaluate(brush1, brush2, ADDITION);
      break;
  }

  return result.geometry;
}
