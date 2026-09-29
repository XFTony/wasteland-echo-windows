"""Build an editable ranger silhouette study with split coat and arm IK.

This graybox is a motion production source, not approved final character art.
"""

from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / "art/animation/ranger/ranger-rig-graybox-v1.blend"
out = root / "output/animation/ranger/silhouette-v2"
target = root / "art/animation/ranger/ranger-silhouette-v2.blend"
out.mkdir(parents=True, exist_ok=True)
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
rig = bpy.data.objects["ranger_rig"]


def marker(name, position, size=0.1):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = size
    obj.location = position
    return obj


def bone_parent(obj, bone):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


def panel(side, suffix):
    inner, outer = side * 0.22, side * 0.36
    vertices = [
        (inner, -0.18, 1.10),
        (outer, -0.18, 1.10),
        (inner, 0.14, 1.10),
        (outer, 0.14, 1.10),
        (side * 0.21, -0.23, 0.92),
        (side * 0.40, -0.23, 0.92),
        (side * 0.15, 0.30, 0.52),
        (side * 0.46, 0.30, 0.52),
    ]
    faces = [
        (0, 1, 5, 4),
        (2, 6, 7, 3),
        (0, 4, 6, 2),
        (1, 3, 7, 5),
        (0, 2, 3, 1),
        (4, 5, 7, 6),
    ]
    mesh = bpy.data.meshes.new(f"coat_flap_mesh.{suffix}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"coat_flap.{suffix}", mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(bpy.data.materials["graybox_coat"])
    bone_parent(obj, f"coat_flap.{suffix}")
    return obj


def cloth_surface(name, vertices, faces, material, bone):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(bpy.data.materials[material])
    bone_parent(obj, bone)
    return obj


bpy.data.objects["coat_torso_volume"].hide_render = True
bpy.ops.mesh.primitive_uv_sphere_add(
    segments=20, ring_count=12, location=(0, 0.015, 1.32)
)
inner_body = bpy.context.object
inner_body.name = "undercoat_torso"
inner_body.scale = (0.275, 0.20, 0.36)
inner_body.data.materials.append(bpy.data.materials["graybox_trousers"])
bone_parent(inner_body, "spine")
cloth_surface(
    "coat_back",
    [
        (-0.37, 0.16, 1.61),
        (0.37, 0.16, 1.61),
        (-0.31, 0.27, 1.06),
        (0.31, 0.27, 1.06),
    ],
    [(0, 1, 3, 2)],
    "graybox_coat",
    "spine",
)
for side, suffix in ((-1, "L"), (1, "R")):
    cloth_surface(
        f"coat_lapel.{suffix}",
        [
            (side * 0.17, -0.205, 1.52),
            (side * 0.36, -0.14, 1.55),
            (side * 0.17, -0.23, 1.08),
            (side * 0.31, -0.14, 1.09),
        ],
        [(0, 1, 3, 2)],
        "graybox_coat",
        "spine",
    )

for side, suffix in ((-1, "L"), (1, "R")):
    bpy.data.objects[f'coat_tail_{"left" if side<0 else "right"}'].hide_render = True

bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for side, suffix in ((-1, "L"), (1, "R")):
    bone = rig.data.edit_bones.new(f"coat_flap.{suffix}")
    bone.head = (side * 0.24, 0.08, 1.04)
    bone.tail = (side * 0.30, 0.18, 0.52)
    bone.parent = rig.data.edit_bones["pelvis"]
    bone.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")

for side, suffix in ((-1, "L"), (1, "R")):
    panel(side, suffix)
    # The ankle target also carries the boot mesh. Keeping the boot level is
    # deliberate here; toe/heel roll can be authored on this control later.
    boot = bpy.data.objects[f'{"left" if side<0 else "right"}_boot']
    bpy.context.view_layer.update()
    boot_world = boot.matrix_world.copy()
    boot.parent = bpy.data.objects[f"foot_ik.{suffix}"]
    boot.parent_type = "OBJECT"
    boot.parent_bone = ""
    boot.matrix_world = boot_world
    grip = bpy.data.objects[f"hand_grip.{suffix}"]
    grip.location = (side * 0.31, -0.06, 1.01)
    pole = marker(f"elbow_pole.{suffix}", (side * 0.56, 0.02, 1.27))
    ik = rig.pose.bones[f"forearm.{suffix}"].constraints.new("IK")
    ik.name = f"place_hand.{suffix}"
    ik.target = grip
    ik.chain_count = 2
    ik.pole_target = pole
    ik.pole_angle = 0

scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(target))
scene.render.filepath = str(out / "neutral.png")
bpy.ops.render.render(write_still=True)
print("SILHOUETTE_V2", target, len(rig.data.bones))
for suffix in ("L", "R"):
    hand = rig.matrix_world @ rig.pose.bones[f"forearm.{suffix}"].tail
    grip = bpy.data.objects[f"hand_grip.{suffix}"].location
    print(
        "HAND",
        suffix,
        tuple(round(v, 3) for v in hand),
        tuple(round(v, 3) for v in grip),
    )
