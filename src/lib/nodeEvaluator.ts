import * as THREE from 'three';
import { useStore, LogicNodeData, AppNode } from '@/store/useStore';
import * as sdf from './sdfCore';
import { Edge } from '@xyflow/react';

export type SDFResult = { dist: number, color: THREE.Color };

// Compiles a node into a distance function
export function buildGraphSDF(customNodes?: AppNode[], customEdges?: Edge[]): (p: THREE.Vector3) => SDFResult {
  const nodes = customNodes || useStore.getState().nodes;
  const edges = customEdges || useStore.getState().edges;
  
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
          if (!data.bvh || !data.geometry) return { dist: 10000, color: nodeColor };
          
          const transformedP = sdf.opTransform(p, new THREE.Vector3(...data.position));
          const scale = data.scale || 1.0;
          const scaledP = transformedP.clone().divideScalar(scale);
          
          const targetInfo: any = {};
          data.bvh.closestPointToPoint(scaledP, targetInfo);
          
          let signedDist = targetInfo.distance * scale;
          
          // Use robust raycasting to determine inside/outside (parity check)
          // Use an irrational direction to avoid perfectly hitting edges/vertices
          const dir = new THREE.Vector3(Math.PI, Math.E, Math.SQRT2).normalize();
          const ray = new THREE.Ray(scaledP, dir);
          
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
          const scale = 100.0 / (data.scale || 500.0);
          switch (data.pattern) {
            case 'schwarzP': latticeDist = sdf.sdSchwarzP(p, scale, data.thickness); break;
            case 'diamond': latticeDist = sdf.sdDiamond(p, scale, data.thickness); break;
            case 'neovius': latticeDist = sdf.sdNeovius(p, scale, data.thickness); break;
            case 'iwp': latticeDist = sdf.sdIWP(p, scale, data.thickness); break;
            case 'frd': latticeDist = sdf.sdFRD(p, scale, data.thickness); break;
            case 'lidinoid': latticeDist = (Math.abs(sdf.sdLidinoid(p.clone().multiplyScalar(scale))) - data.thickness) / scale; break;
            case 'schwarzH': latticeDist = (Math.abs(sdf.sdSchwarzH(p.clone().multiplyScalar(scale))) - data.thickness) / scale; break;
            case 'grid': latticeDist = (sdf.sdGrid(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'honeycomb': latticeDist = (sdf.sdHoneycomb(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'octet': latticeDist = (sdf.sdOctet(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'sineWave': latticeDist = (Math.abs(sdf.sdSineWave(p.clone().multiplyScalar(scale))) - data.thickness) / scale; break;
            case 'foam': latticeDist = (sdf.sdFoam(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'fractalNoise': latticeDist = (sdf.sdFractalNoise(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'cylindricalGrid': latticeDist = (sdf.sdCylindricalGrid(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'tubularGyroid': latticeDist = (sdf.sdTubularGyroid(p.clone().multiplyScalar(scale)) - data.thickness) / scale; break;
            case 'fischerKochS': latticeDist = sdf.sdFischerKochS(p, scale, data.thickness); break;
            case 'fischerKochD': latticeDist = sdf.sdFischerKochD(p, scale, data.thickness); break;
            case 'splitP': latticeDist = sdf.sdSplitP(p, scale, data.thickness); break;
            case 'gPrime': latticeDist = sdf.sdGPrime(p, scale, data.thickness); break;
            case 'iwp2': latticeDist = sdf.sdIWP2(p, scale, data.thickness); break;
            case 'carlyle': latticeDist = sdf.sdCarlyle(p, scale, data.thickness); break;
            case 'crossedDecagons': latticeDist = sdf.sdCrossedDecagons(p, scale, data.thickness); break;
            case 'kelvin': latticeDist = sdf.sdKelvin(p, scale, data.thickness); break;
            case 'kagome': latticeDist = sdf.sdKagome(p, scale, data.thickness); break;
            case 'waffle': latticeDist = sdf.sdWaffle(p, scale, data.thickness); break;
            case 'chiral': latticeDist = sdf.sdChiral(p, scale, data.thickness); break;
            case 'radialGrid': latticeDist = sdf.sdRadialGrid(p, scale, data.thickness); break;
            case 'herringbone': latticeDist = sdf.sdHerringbone(p, scale, data.thickness); break;
            case 'weairePhelan': latticeDist = sdf.sdWeairePhelan(p, scale, data.thickness); break;
            case 'boxFrame': latticeDist = sdf.sdBoxFrame(p, scale, data.thickness); break;
            case 'octahedral': latticeDist = sdf.sdOctahedral(p, scale, data.thickness); break;
            case 'doubleGyroid': latticeDist = sdf.sdDoubleGyroid(p, scale, data.thickness); break;
            case 'doubleSchwarzP': latticeDist = sdf.sdDoubleSchwarzP(p, scale, data.thickness); break;
            case 'doubleDiamond': latticeDist = sdf.sdDoubleDiamond(p, scale, data.thickness); break;
            case 'schwarzCLP': latticeDist = sdf.sdSchwarzCLP(p, scale, data.thickness); break;
            case 'schwarzT': latticeDist = sdf.sdSchwarzT(p, scale, data.thickness); break;
            case 'schoenIQP': latticeDist = sdf.sdSchoenIQP(p, scale, data.thickness); break;
            case 'schoenS': latticeDist = sdf.sdSchoenS(p, scale, data.thickness); break;
            case 'schoenM': latticeDist = sdf.sdSchoenM(p, scale, data.thickness); break;
            case 'schoenY': latticeDist = sdf.sdSchoenY(p, scale, data.thickness); break;
            case 'schoenHT': latticeDist = sdf.sdSchoenHT(p, scale, data.thickness); break;
            case 'karcherSchwarz': latticeDist = sdf.sdKarcherSchwarz(p, scale, data.thickness); break;
            case 'nodal4Fold': latticeDist = sdf.sdNodal4Fold(p, scale, data.thickness); break;
            case 'nodal8Fold': latticeDist = sdf.sdNodal8Fold(p, scale, data.thickness); break;
            case 'complementaryIWP': latticeDist = sdf.sdComplementaryIWP(p, scale, data.thickness); break;
            case 'schoenSPrime': latticeDist = sdf.sdSchoenSPrime(p, scale, data.thickness); break;
            case 'barthSextic': latticeDist = sdf.sdBarthSextic(p, scale, data.thickness); break;
            case 'kummerQuartic': latticeDist = sdf.sdKummerQuartic(p, scale, data.thickness); break;
            case 'togliattiQuintic': latticeDist = sdf.sdTogliattiQuintic(p, scale, data.thickness); break;
            case 'clebschCubic': latticeDist = sdf.sdClebschCubic(p, scale, data.thickness); break;
            case 'cayleyCubic': latticeDist = sdf.sdCayleyCubic(p, scale, data.thickness); break;
            case 'tubularDiamond': latticeDist = sdf.sdTubularDiamond(p, scale, data.thickness); break;
            case 'tubularSchwarzP': latticeDist = sdf.sdTubularSchwarzP(p, scale, data.thickness); break;
            case 'tubularNeovius': latticeDist = sdf.sdTubularNeovius(p, scale, data.thickness); break;
            case 'tubularLidinoid': latticeDist = sdf.sdTubularLidinoid(p, scale, data.thickness); break;
            case 'superGyroid': latticeDist = sdf.sdSuperGyroid(p, scale, data.thickness); break;
            case 'superSchwarzP': latticeDist = sdf.sdSuperSchwarzP(p, scale, data.thickness); break;
            case 'superDiamond': latticeDist = sdf.sdSuperDiamond(p, scale, data.thickness); break;
            case 'gyroidSchwarzHybrid': latticeDist = sdf.sdGyroidSchwarzHybrid(p, scale, data.thickness); break;
            case 'gyroidDiamondHybrid': latticeDist = sdf.sdGyroidDiamondHybrid(p, scale, data.thickness); break;
            case 'schwarzDiamondHybrid': latticeDist = sdf.sdSchwarzDiamondHybrid(p, scale, data.thickness); break;
            case 'helicoid': latticeDist = sdf.sdHelicoid(p, scale, data.thickness); break;
            case 'doubleHelicoid': latticeDist = sdf.sdDoubleHelicoid(p, scale, data.thickness); break;
            case 'triangularHoneycomb': latticeDist = sdf.sdTriangularHoneycomb(p, scale, data.thickness); break;
            case 'kagome3D': latticeDist = sdf.sdKagome3D(p, scale, data.thickness); break;
            case 'boricAcidLayer': latticeDist = sdf.sdBoricAcidLayer(p, scale, data.thickness); break;
            case 'poreNetwork': latticeDist = sdf.sdPoreNetwork(p, scale, data.thickness); break;
            case 'saddle': latticeDist = sdf.sdSaddle(p, scale, data.thickness); break;
            case 'doubleSaddle': latticeDist = sdf.sdDoubleSaddle(p, scale, data.thickness); break;
            case 'complementaryFRD': latticeDist = sdf.sdComplementaryFRD(p, scale, data.thickness); break;
            case 'staircaseGyroid': latticeDist = sdf.sdStaircaseGyroid(p, scale, data.thickness); break;
            case 'twistedGyroid': latticeDist = sdf.sdTwistedGyroid(p, scale, data.thickness); break;
            case 'chiralDiamond': latticeDist = sdf.sdChiralDiamond(p, scale, data.thickness); break;
            case 'octetTrussVariant': latticeDist = sdf.sdOctetTrussVariant(p, scale, data.thickness); break;
            case 'kelvinFoam': latticeDist = sdf.sdKelvinFoam(p, scale, data.thickness); break;
            case 'schwarzHPrime': latticeDist = sdf.sdSchwarzHPrime(p, scale, data.thickness); break;
            case 'gyroidVariant': latticeDist = sdf.sdGyroidVariant(p, scale, data.thickness); break;
            case 'schwarzPVariant': latticeDist = sdf.sdSchwarzPVariant(p, scale, data.thickness); break;
            case 'diamondVariant': latticeDist = sdf.sdDiamondVariant(p, scale, data.thickness); break;
            case 'neoviusVariant': latticeDist = sdf.sdNeoviusVariant(p, scale, data.thickness); break;
            case 'lidinoidVariant': latticeDist = sdf.sdLidinoidVariant(p, scale, data.thickness); break;
            case 'gyroid':
            default: latticeDist = sdf.sdGyroid(p, scale, data.thickness); break;
          }
          // Infill the base with lattice
          const finalDist = sdf.opIntersect(rBase.dist, latticeDist);
          const finalColor = rBase.color.clone();
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
          switch(data.deformType) {
            case 'twist': deformedP = sdf.opTwist(deformedP, data.strength || 0); break;
            case 'taper': deformedP = sdf.opTaper(deformedP, data.strength || 0); break;
            case 'bend': deformedP = sdf.opBend(deformedP, data.strength || 0); break;
            case 'quantize': deformedP = sdf.opQuantize(deformedP, data.strength || 0); break;
            case 'ripple': deformedP = sdf.opRipple(deformedP, (data.strength || 0) * 2, Math.abs(data.strength || 0) * 0.5); break;
            case 'elongateX': deformedP = sdf.opElongateX(deformedP, Math.abs(data.strength || 0)); break;
            case 'elongateY': deformedP = sdf.opElongateY(deformedP, Math.abs(data.strength || 0)); break;
            case 'bulge': deformedP = sdf.opBulge(deformedP, data.strength || 0); break;
            case 'pinch': deformedP = sdf.opPinch(deformedP, data.strength || 0); break;
          }
          return baseFunc(deformedP);
        };
      }

      case 'symmetry': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        return (p: THREE.Vector3) => {
          let symP = p.clone();
          switch(data.symType) {
            case 'symX': symP = sdf.opSymX(symP); break;
            case 'symY': symP = sdf.opSymY(symP); break;
            case 'symZ': symP = sdf.opSymZ(symP); break;
            case 'radial': symP = sdf.opSymRadial(symP, data.slices || 6); break;
          }
          return baseFunc(symP);
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
