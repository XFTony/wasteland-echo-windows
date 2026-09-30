"""Render non-runtime material color studies based on the approved ranger art.

The palette helps judge motion at game scale; it is not painted final artwork.
"""

from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
source = Path(bpy.data.filepath).stem
folders = {"ranger-run-ik-v3": "unarmed", "ranger-run-sidearm-v1": "sidearm"}
if source not in folders:
    raise RuntimeError(f"Unsupported color study source: {source}")
folder = folders[source]
out = root / "output/animation/ranger/color-study" / folder
out.mkdir(parents=True, exist_ok=True)
(out / "loop").mkdir(parents=True, exist_ok=True)


def color(material, rgb):
    item = bpy.data.materials[material]
    item.diffuse_color = (*rgb, 1)
    shader = item.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = 0.95


color("graybox_coat", (0.46, 0.35, 0.24))
color("graybox_trousers", (0.16, 0.15, 0.13))
color("graybox_trim", (0.29, 0.23, 0.18))
color("graybox_mask", (0.065, 0.065, 0.06))
color("graybox_weapon", (0.085, 0.09, 0.10))


def unique(name, source_material, rgb):
    item = bpy.data.materials[source_material].copy()
    item.name = name
    item.diffuse_color = (*rgb, 1)
    shader = item.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    bpy.data.objects[name].data.materials.clear()
    bpy.data.objects[name].data.materials.append(item)


unique("scarf_band", "graybox_trim", (0.33, 0.14, 0.09))
for obj in ("goggle_left", "goggle_right"):
    unique(obj, "graybox_trim", (0.50, 0.25, 0.07))
for obj in ("left_boot", "right_boot"):
    unique(obj, "graybox_trim", (0.22, 0.18, 0.13))

scene = bpy.context.scene
for name, frame, side in (
    ("contact", 1, "left"),
    ("down", 4, "left"),
    ("passing", 7, "left"),
    ("flight", 10, "left"),
    ("contact", 13, "right"),
    ("down", 16, "right"),
    ("passing", 19, "right"),
    ("flight", 22, "right"),
):
    scene.frame_set(frame)
    scene.render.filepath = str(out / f"pose_{frame:02d}_{name}_{side}.png")
    bpy.ops.render.render(write_still=True)
for frame in range(1, 25):
    scene.frame_set(frame)
    scene.render.filepath = str(out / "loop" / f"frame_{frame:02d}.png")
    bpy.ops.render.render(write_still=True)
print("COLOR_STUDY", out)
