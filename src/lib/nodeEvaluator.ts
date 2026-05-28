import * as THREE from 'three';
import { useStore, LogicNodeData, AppNode } from '@/store/useStore';
import * as sdf from './sdfCore';
import { Edge } from '@xyflow/react';

export type SDFResult = { dist: number, color: THREE.Color };

// Compiles a node into a distance function
export function buildGraphSDF(): (p: THREE.Vector3) => SDFResult {
  const { nodes, edges } = useStore.getState();
  
  // Find the output node
  const outputNode = nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
  if (!outputNode) return () => ({ dist: 10000, color: new THREE.Color('#e879f9') });
  
  // Helper to find the node connected to a specific handle of a target node
  const getConnectedNode = (targetId: string, targetHandle?: string): AppNode | undefined => {
    const edge = edges.find(e => e.target === targetId && (!targetHandle || e.targetHandle === targetHandle));
    if (!edge) return undefined;
    return nodes.find(n => n.id === edge.source);
  };

  const defaultMissingColor = new THREE.Color('#e879f9');

  // Recursively compile the node into a distance function
  const compileNode = (node: AppNode): (p: THREE.Vector3) => SDFResult => {
    const data = node.data;
    
    switch (data.type) {
      case 'primitive': {
        const nodeColor = new THREE.Color(data.color || '#6366f1');
        return (p: THREE.Vector3) => {
          const transformedP = sdf.opTransform(p, new THREE.Vector3(...data.position));
          let dist = 10000;
          switch (data.shape) {
            case 'box': dist = sdf.sdBox(transformedP, new THREE.Vector3(data.scale, data.scale, data.scale)); break;
            case 'cylinder': dist = sdf.sdCylinder(transformedP, data.scale, data.scale / 2); break;
            case 'sphere':
            default: dist = sdf.sdSphere(transformedP, data.scale); break;
          }
          return { dist, color: nodeColor };
        };
      }
      
      case 'mesh': {
        const nodeColor = new THREE.Color(data.color || '#f97316');
        return (p: THREE.Vector3) => {
          if (!data.bvh || !data.geometry || !data.geometry.index) return { dist: 10000, color: nodeColor };
          
          const transformedP = sdf.opTransform(p, new THREE.Vector3(...data.position));
          const targetInfo: any = {};
          data.bvh.closestPointToPoint(transformedP, targetInfo);
          
          let signedDist = targetInfo.distance;
          
          // Use robust raycasting to determine inside/outside (parity check)
          // Use an irrational direction to avoid perfectly hitting edges/vertices
          const dir = new THREE.Vector3(Math.PI, Math.E, Math.SQRT2).normalize();
          const ray = new THREE.Ray(transformedP, dir);
          
          // raycast returns an array of intersections
          const hits = data.bvh.raycast(ray, THREE.DoubleSide);
          
          // If the number of intersections is odd, we are inside the mesh
          if (hits && hits.length % 2 === 1) {
            signedDist = -Math.abs(signedDist);
          } else {
            signedDist = Math.abs(signedDist);
          }
          
          return { dist: signedDist, color: nodeColor };
        };
      }
      
      case 'boolean': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id); // fallback to any connection if no handle
        const toolNode = getConnectedNode(node.id, 'tool');
        
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        const toolFunc = toolNode ? compileNode(toolNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          const r1 = baseFunc(p);
          const r2 = toolFunc(p);
          
          let finalDist = r1.dist;
          let finalColor = r1.color.clone();
          
          switch (data.operation) {
            case 'union':
              finalDist = sdf.opUnion(r1.dist, r2.dist);
              finalColor = r1.dist < r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'subtract':
              finalDist = sdf.opSubtract(r1.dist, r2.dist);
              finalColor = r1.dist > -r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'intersect':
              finalDist = sdf.opIntersect(r1.dist, r2.dist);
              finalColor = r1.dist > r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'smoothUnion': {
              finalDist = sdf.opSmoothUnion(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 + 0.5 * (r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
            case 'smoothSubtract': {
              finalDist = sdf.opSmoothSubtract(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 - 0.5 * (-r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
            case 'smoothIntersect': {
              finalDist = sdf.opSmoothIntersect(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 - 0.5 * (r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
          }
          return { dist: finalDist, color: finalColor };
        };
      }
      
      case 'lattice': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        const latticeColor = new THREE.Color(data.color || '#06b6d4');
        
        return (p: THREE.Vector3) => {
          const rBase = baseFunc(p);
          let latticeDist = 10000;
          switch (data.pattern) {
            case 'schwarzP': latticeDist = sdf.sdSchwarzP(p, data.scale, data.thickness); break;
            case 'diamond': latticeDist = sdf.sdDiamond(p, data.scale, data.thickness); break;
            case 'neovius': latticeDist = sdf.sdNeovius(p, data.scale, data.thickness); break;
            case 'iwp': latticeDist = sdf.sdIWP(p, data.scale, data.thickness); break;
            case 'frd': latticeDist = sdf.sdFRD(p, data.scale, data.thickness); break;
            case 'gyroid':
            default: latticeDist = sdf.sdGyroid(p, data.scale, data.thickness); break;
          }
          // Infill the base with lattice
          const finalDist = sdf.opIntersect(rBase.dist, latticeDist);
          const finalColor = rBase.dist > latticeDist ? rBase.color.clone() : latticeColor;
          return { dist: finalDist, color: finalColor };
        };
      }
      
      case 'modifier': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          const rBase = baseFunc(p);
          let finalDist = rBase.dist;
          if (data.modifierType === 'shell') {
            finalDist = sdf.opShell(rBase.dist, data.amount);
          } else {
            finalDist = sdf.opOffset(rBase.dist, data.amount);
          }
          return { dist: finalDist, color: rBase.color };
        };
      }
      
      case 'transform': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          let transformedP = p.clone();
          // Inverse Transform: Translate -> Rotate -> Scale
          if (data.translate) transformedP = sdf.opTransform(transformedP, new THREE.Vector3(...data.translate));
          if (data.rotate) {
            const eul = new THREE.Euler(
              THREE.MathUtils.degToRad(data.rotate[0] || 0),
              THREE.MathUtils.degToRad(data.rotate[1] || 0),
              THREE.MathUtils.degToRad(data.rotate[2] || 0),
              'XYZ'
            );
            transformedP = sdf.opRotate(transformedP, eul);
          }
          if (data.scale && (data.scale[0] !== 1 || data.scale[1] !== 1 || data.scale[2] !== 1)) {
            transformedP.x /= (data.scale[0] || 1);
            transformedP.y /= (data.scale[1] || 1);
            transformedP.z /= (data.scale[2] || 1);
          }

          const rBase = baseFunc(transformedP);
          let dist = rBase.dist;
          
          if (data.scale && (data.scale[0] !== 1 || data.scale[1] !== 1 || data.scale[2] !== 1)) {
             // Exact distance with non-uniform scale is mathematically hard for SDFs.
             // An approximation is multiplying by the minimum scale factor to ensure safe raymarching bounds.
             const minScale = Math.min(data.scale[0]||1, data.scale[1]||1, data.scale[2]||1);
             dist *= minScale;
          }
          return { dist, color: rBase.color };
        };
      }

      case 'deform': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        return (p: THREE.Vector3) => {
          let deformedP = p.clone();
          if (data.deformType === 'twist') deformedP = sdf.opTwist(deformedP, data.strength || 0);
          return baseFunc(deformedP);
        };
      }

      case 'repeat': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        return (p: THREE.Vector3) => {
          const repP = sdf.opRepeat(p, new THREE.Vector3(...(data.spacing || [0,0,0])));
          return baseFunc(repP);
        };
      }

      case 'morph': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const shapeBNode = getConnectedNode(node.id, 'shapeB');
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        const shapeBFunc = shapeBNode ? compileNode(shapeBNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          const rA = baseFunc(p);
          const rB = shapeBFunc(p);
          return { 
            dist: sdf.opMorph(rA.dist, rB.dist, data.amount || 0),
            color: rA.color.clone().lerp(rB.color, data.amount || 0)
          };
        };
      }

      default:
        return () => ({ dist: 10000, color: defaultMissingColor });
    }
  };

  const getAllConnectedNodes = (targetId: string, targetHandle?: string): AppNode[] => {
    const connectedEdges = edges.filter(e => e.target === targetId && (!targetHandle || e.targetHandle === targetHandle));
    return connectedEdges.map(e => nodes.find(n => n.id === e.source)).filter((n): n is AppNode => n !== undefined);
  };

  // Start compilation from ALL nodes connected to Output
  const finalInputNodes = getAllConnectedNodes(outputNode.id);
  
  if (finalInputNodes.length === 0) return () => ({ dist: 10000, color: defaultMissingColor });
  
  if (finalInputNodes.length === 1) {
    return compileNode(finalInputNodes[0]);
  }

  // If multiple nodes are connected to Output, implicitly Union them
  const compiledFuncs = finalInputNodes.map(compileNode);
  
  return (p: THREE.Vector3) => {
    let finalDist = 10000;
    let finalColor = defaultMissingColor;
    
    for (const func of compiledFuncs) {
      const res = func(p);
      if (res.dist < finalDist) {
        finalDist = res.dist;
        finalColor = res.color;
      }
    }
    
    return { dist: finalDist, color: finalColor };
  };
}
