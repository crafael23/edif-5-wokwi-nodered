import { Mesh, MeshStandardMaterial, Vector2, Vector4, type Object3D } from 'three'
import { levels, rooms } from './rooms'

export const corridorSwitchXs = [341.3, 360, 379, 392, 414]
export const corridorLamp = { firstX: 338.8, spacing: 5.65, z: -507.62, perSwitch: 3 }

export const classroomLamp = { columns: [0.19, 0.5, 0.81], rows: [-517.35, -512.7] }

const switchesPerLevel = corridorSwitchXs.length
const lampsPerLevel = switchesPerLevel * corridorLamp.perSwitch
const levelHeights = levels.map(({ floor, corridorCeiling, ceiling }) =>
  new Vector4(floor, corridorCeiling, ceiling, rooms.filter(room => room.floor === floor).length),
)
const roomBounds = rooms.map(({ minX, maxX }) => new Vector2(minX, maxX))

// Evaluate the fixed fixtures at each surface instead of moving lights with the player.
const lightingFragment = `
  varying vec3 buildingPosition;
  uniform float corridorSwitches[${levels.length * switchesPerLevel}];
  uniform vec4 buildingHeights[${levels.length}];
  uniform vec2 classroomBounds[${rooms.length}];
  uniform float classroomSwitches[${rooms.length}];

  float classroomLight(vec3 point, vec3 worldNormal) {
    if (point.z < -519.30 || point.z > -510.52 || point.x < 335.60 || point.x > 424.39) return 0.0;

    int first = 0;
    int count = 0;
    float ceiling = 0.0;
    for (int i = 0; i < ${levels.length}; i++) {
      vec4 heights = buildingHeights[i];
      if (point.y >= heights.x - 0.025 && point.y <= heights.z + 0.025) {
        count = int(heights.w);
        ceiling = heights.z;
        break;
      }
      first += int(heights.w);
    }

    for (int offset = 0; offset < count; offset++) {
      int room = first + offset;
      vec2 bounds = classroomBounds[room];
      if (point.x < bounds.x - 0.12 || point.x > bounds.y + 0.12) continue;
      // Only the side of a shared wall facing this room belongs to its circuit.
      if (point.x < bounds.x + 0.035 && worldNormal.x < -0.25 || point.x > bounds.y - 0.035 && worldNormal.x > 0.25) continue;
      if (classroomSwitches[room] < 0.5) return 0.0;

      float contribution = 0.0;
      const float columns[3] = float[3](${classroomLamp.columns.join(', ')});
      const float rows[2] = float[2](${classroomLamp.rows.join(', ')});
      for (int x = 0; x < 3; x++) {
        for (int z = 0; z < 2; z++) {
          vec3 toLamp = vec3(mix(bounds.x, bounds.y, columns[x]), ceiling - 0.28, rows[z]) - point;
          float squareDistance = max(dot(toLamp, toLamp), 0.0001);
          vec3 direction = toLamp * inversesqrt(squareDistance);
          float facing = max(dot(worldNormal, direction), 0.0);
          float falloff = 1.0 - smoothstep(55.0, 130.0, squareDistance);
          contribution += (0.24 + 0.76 * facing) * 6.3 * falloff / (2.7 + squareDistance);
        }
      }
      return min(contribution, 1.7);
    }
    return 0.0;
  }

  float corridorLight(vec3 point, vec3 surfaceNormal) {
    if (point.x < 335.4 || point.x > 424.7 || point.z < -510.48 || point.z > -504.85) return 0.0;

    int level = -1;
    for (int i = 0; i < ${levels.length}; i++) {
      vec2 heights = buildingHeights[i].xy;
      if (point.y >= heights.x - 0.025 && point.y <= heights.y + 0.025) {
        level = i;
        break;
      }
    }
    if (level < 0) return 0.0;

    int closest = int(floor((point.x - ${corridorLamp.firstX}) / ${corridorLamp.spacing} + 0.5));
    float contribution = 0.0;
    for (int offset = -1; offset <= 1; offset++) {
      int lamp = closest + offset;
      if (lamp < 0 || lamp >= ${lampsPerLevel}) continue;
      int circuit = level * ${switchesPerLevel} + lamp / ${corridorLamp.perSwitch};
      if (corridorSwitches[circuit] < 0.5) continue;
      vec3 toLamp = vec3(${corridorLamp.firstX} + float(lamp) * ${corridorLamp.spacing}, buildingHeights[level].y - 0.32, ${corridorLamp.z}) - point;
      float squareDistance = max(dot(toLamp, toLamp), 0.0001);
      float falloff = 1.0 - smoothstep(28.0, 72.0, squareDistance);
      vec3 direction = toLamp * inversesqrt(squareDistance);
      float facing = max(dot(surfaceNormal, direction), 0.0);
      contribution += (0.19 + 0.81 * facing) * 8.5 * falloff / (2.4 + squareDistance);
    }
    return contribution * (1.0 - smoothstep(-505.65, -504.85, point.z));
  }
`

export function applyBuildingLighting(model: Object3D, furnishings: Object3D, corridorSwitches: Float32Array, classroomSwitches: Float32Array) {
  const patched = new Set<MeshStandardMaterial>()
  function patch(material: MeshStandardMaterial) {
    if (patched.has(material)) return
    patched.add(material)
    const compile = material.onBeforeCompile.bind(material)
    const cacheKey = material.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer)
      shader.uniforms.corridorSwitches = { value: corridorSwitches }
      shader.uniforms.classroomSwitches = { value: classroomSwitches }
      shader.uniforms.buildingHeights = { value: levelHeights }
      shader.uniforms.classroomBounds = { value: roomBounds }
      shader.vertexShader = 'varying vec3 buildingPosition;\n' + shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 buildingVertex = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          buildingVertex = instanceMatrix * buildingVertex;
        #endif
        buildingPosition = (modelMatrix * buildingVertex).xyz;`,
      )
      shader.fragmentShader = lightingFragment + shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `vec3 buildingNormal = transpose(mat3(viewMatrix)) * normal;
        float fixedLight = buildingPosition.z > -510.5
          ? corridorLight(buildingPosition, buildingNormal)
          : classroomLight(buildingPosition, buildingNormal);
        outgoingLight += diffuseColor.rgb * vec3(0.88, 0.94, 1.0) * fixedLight;
        #include <opaque_fragment>`,
      )
    }
    material.customProgramCacheKey = () => cacheKey + ':building-lighting'
  }

  model.traverse(object => {
    if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) patch(object.material)
  })

  const copies = new Map<MeshStandardMaterial, MeshStandardMaterial>()
  furnishings.traverse(object => {
    if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
    // The fixtures already emit. Their switches update the original materials.
    const source = object.material
    if (source.emissive.getHex() !== 0) return
    let material = copies.get(source)
    if (!material) {
      material = source.clone()
      patch(material)
      copies.set(source, material)
    }
    object.material = material
  })
}
