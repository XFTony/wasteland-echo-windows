"""Direction controls for a sidearm study built on the accepted ranger gait.

Load ranger-run-ik-v3.blend before constructing RangerDirectionController.
This is an offline Blender source tool. It is never loaded by the game.
"""

from __future__ import annotations

import math
import bpy
from mathutils import Matrix, Quaternion, Vector
from bpy_extras.object_utils import world_to_camera_view


def wrap_angle(value: float) -> float:
    return (value + math.pi) % math.tau - math.pi


def facing_policy(
    aim_yaw: float, move_yaw: float, standing: bool
) -> tuple[float, float]:
    delta = wrap_angle(aim_yaw - move_yaw)
    waist = 0 if standing else math.pi / 4 * math.sin(delta)
    return aim_yaw - waist, waist


class RangerDirectionController:
    def __init__(self):
        self.scene = bpy.context.scene
        self.rig = bpy.data.objects["ranger_rig"]
        self.spine = self.rig.pose.bones["spine"]
        self.baseline = {}
        for frame in range(1, 26):
            self.scene.frame_set(frame)
            self.baseline[frame] = {
                "location": self.rig.location.copy(),
                "yaw": self.rig.rotation_euler.z,
                "foot": {},
                "pole": {},
                "roll": {},
                "coat": {},
            }
            for side in ("L", "R"):
                self.baseline[frame]["foot"][side] = bpy.data.objects[
                    f"foot_ik.{side}"
                ].location.copy()
                self.baseline[frame]["pole"][side] = bpy.data.objects[
                    f"knee_pole.{side}"
                ].location.copy()
                self.baseline[frame]["roll"][side] = bpy.data.objects[
                    f"foot_ik.{side}"
                ].rotation_euler.x
                self.baseline[frame]["coat"][side] = self.rig.pose.bones[
                    f"coat_flap.{side}"
                ].rotation_euler.copy()
        self.scene.frame_set(1)
        # Rendering re-evaluates animation. Preserve the approved gait samples,
        # then remove the old actions so they cannot overwrite posed directions.
        self.rig.animation_data_clear()
        for side in ("L", "R"):
            for stem in ("foot_ik", "knee_pole", "hand_grip", "elbow_pole"):
                bpy.data.objects[f"{stem}.{side}"].animation_data_clear()
        self.rig.rotation_euler.z = 0
        self.spine.rotation_mode = "QUATERNION"
        self.spine.rotation_quaternion = Quaternion()
        bpy.context.view_layer.update()
        self.rest = self.rig.data.bones["spine"].matrix_local.copy()
        self.root_local = self.rest.inverted() @ Vector((0, -0.28, 1.50))
        self.pole_local = {
            side: self.rest.inverted() @ Vector((sign * 0.56, 0.02, 1.27))
            for side, sign in (("L", -1), ("R", 1))
        }
        self.weapon = bpy.data.objects.new("weapon_aim", None)
        self.scene.collection.objects.link(self.weapon)
        self.weapon.empty_display_type = "ARROWS"
        self.weapon.empty_display_size = 0.2
        self.weapon.parent = self.rig
        self.weapon.parent_type = "BONE"
        self.weapon.parent_bone = "spine"
        self.right = self.child("socket.sidearm.right_grip", (0.09, -0.17, -0.07))
        self.left = self.child("socket.sidearm.left_support", (0.01, -0.22, -0.06))
        self.breech = self.child("socket.sidearm.breech", (0.06, -0.28, 0))
        self.muzzle = self.child("socket.sidearm.muzzle", (0.06, -0.48, 0))
        self.child("sidearm_proxy_frame", (0.04, -0.28, -0.025), (0.14, 0.26, 0.09))
        self.slide = self.child(
            "sidearm_proxy_slide", (0.06, -0.35, 0.015), (0.08, 0.20, 0.055)
        )
        self.child("sidearm_proxy_grip", (0.09, -0.17, -0.10), (0.09, 0.12, 0.16))
        self.child(
            "sidearm_proxy_rear_sight", (0.06, -0.26, 0.055), (0.04, 0.025, 0.025)
        )
        self.child(
            "sidearm_proxy_front_sight", (0.06, -0.42, 0.055), (0.025, 0.018, 0.025)
        )
        self.flash = self.child(
            "sidearm_proxy_flash", (0.06, -0.56, 0), (0.10, 0.15, 0.08)
        )
        self.flash.data.materials.clear()
        flash_material = bpy.data.materials.new("aim_review_muzzle_flash")
        flash_material.diffuse_color = (1, 0.48, 0.05, 1)
        flash_material.use_nodes = True
        shader = flash_material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (1, 0.48, 0.05, 1)
        shader.inputs["Emission Color"].default_value = (1, 0.25, 0.02, 1)
        shader.inputs["Emission Strength"].default_value = 2
        self.flash.data.materials.append(flash_material)
        self.shell = self.child(
            "sidearm_proxy_shell", (0.14, -0.30, 0.035), (0.025, 0.06, 0.025)
        )
        self.shell.data.materials.clear()
        brass = bpy.data.materials.new("aim_review_brass")
        brass.diffuse_color = (0.68, 0.42, 0.15, 1)
        self.shell.data.materials.append(brass)

    def child(self, name, offset, dims=None):
        if dims is not None:
            bpy.ops.mesh.primitive_cube_add(size=1)
            obj = bpy.context.object
            obj.dimensions = dims
            obj.data.materials.append(bpy.data.materials["graybox_weapon"])
        else:
            obj = bpy.data.objects.new(name, None)
            self.scene.collection.objects.link(obj)
            obj.empty_display_type = "SPHERE"
            obj.empty_display_size = 0.045
        obj.name = name
        obj.parent = self.weapon
        obj.location = offset
        return obj

    def apply(self, frame, aim_yaw, move_yaw=0, standing=False, shot_age=None):
        self.scene.frame_set(frame)
        data = self.baseline[frame]
        delta = wrap_angle(aim_yaw - move_yaw)
        hip_yaw, waist = facing_policy(aim_yaw, move_yaw, standing)
        side_mix = 0 if standing else abs(math.sin(hip_yaw - move_yaw))
        stance_width = 0.19 + 0.14 * side_mix
        stride_scale = 1 - 0.60 * side_mix
        ground_rotation = Matrix.Rotation(hip_yaw, 4, "Z")
        travel_rotation = Matrix.Rotation(move_yaw, 4, "Z")
        sway = 0 if standing else data["location"].x
        self.rig.location = ground_rotation @ Vector(
            (sway, 0, 0 if standing else data["location"].z)
        )
        self.rig.rotation_euler.z = hip_yaw
        rest_q = self.rest.to_quaternion()
        self.spine.rotation_quaternion = (
            rest_q.inverted()
            @ Quaternion((0, 0, 1), aim_yaw - self.rig.rotation_euler.z)
            @ rest_q
        )
        for side, sign in (("L", -1), ("R", 1)):
            foot = bpy.data.objects[f"foot_ik.{side}"]
            original = data["foot"][side]
            lateral = ground_rotation @ Vector((sign * stance_width, 0, 0))
            stride = travel_rotation @ Vector(
                (
                    0,
                    -0.03 if standing else original.y * stride_scale,
                    0.15 if standing else original.z,
                )
            )
            foot.location = lateral + stride
            roll = (
                0
                if standing
                else data["roll"][side] * (0.225 + 0.775 * math.cos(delta))
            )
            foot.rotation_euler = (roll, 0, hip_yaw)
            bpy.data.objects[f"knee_pole.{side}"].location = (
                ground_rotation @ data["pole"][side]
            )
            self.rig.pose.bones[f"coat_flap.{side}"].rotation_euler = data["coat"][side]
        bpy.context.view_layer.update()
        chest = self.rig.matrix_world @ self.spine.matrix
        recoil_values = (0, 1, 0.82, 0.55, 0.29, 0.13, 0.04, 0, 0, 0, 0, 0)
        recoil = recoil_values[shot_age] if shot_age is not None else 0
        position = chest @ self.root_local
        position += Matrix.Rotation(aim_yaw, 4, "Z") @ Vector((0, 0.028 * recoil, 0))
        self.weapon.matrix_world = (
            Matrix.Translation(position)
            @ Matrix.Rotation(aim_yaw, 4, "Z")
            @ Matrix.Rotation(-0.055 * recoil, 4, "X")
        )
        self.slide.location.y = -0.35 + 0.012 * recoil
        self.flash.hide_render = shot_age not in (1, 2)
        self.shell.hide_render = shot_age is None or not 2 <= shot_age <= 6
        if shot_age is not None:
            self.shell.location = (
                0.14 + 0.03 * shot_age,
                -0.30 + 0.012 * shot_age,
                0.035 + 0.012 * shot_age,
            )
            self.shell.rotation_euler = (
                0.2 * shot_age,
                0.15 * shot_age,
                0.3 * shot_age,
            )
        bpy.context.view_layer.update()
        for side, anchor in (("L", self.left), ("R", self.right)):
            bpy.data.objects[f"hand_grip.{side}"].location = (
                anchor.matrix_world.translation
            )
            bpy.data.objects[f"elbow_pole.{side}"].location = (
                chest @ self.pole_local[side]
            )
        bpy.context.view_layer.update()
        result = self.measure(frame, aim_yaw, waist, hip_yaw, standing, recoil)
        result["strideScale"] = stride_scale
        return result

    def measure(self, frame, aim_yaw, waist, hip_yaw, standing, recoil):
        errors, elbow_angles, soles = {}, {}, {}
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for side, label in (("L", "left"), ("R", "right")):
            for bone, control in (("forearm", "hand_grip"), ("shin", "foot_ik")):
                endpoint = (
                    self.rig.matrix_world @ self.rig.pose.bones[f"{bone}.{side}"].tail
                )
                errors[f"{bone}.{side}"] = (
                    endpoint - bpy.data.objects[f"{control}.{side}"].location
                ).length
            upper = self.rig.pose.bones[f"upper_arm.{side}"]
            lower = self.rig.pose.bones[f"forearm.{side}"]
            elbow_angles[side] = math.degrees(
                (upper.tail - upper.head).angle(lower.tail - lower.head)
            )
            boot = bpy.data.objects[f"{label}_boot"].evaluated_get(depsgraph)
            soles[side] = min(
                (boot.matrix_world @ vertex.co).z for vertex in boot.data.vertices
            )
        face = (
            bpy.data.objects["hood_face_recess"].matrix_world.translation
            - bpy.data.objects["hood_outer_volume"].matrix_world.translation
        )
        bore = (
            self.muzzle.matrix_world.translation - self.breech.matrix_world.translation
        )
        face_error = abs(wrap_angle(math.atan2(face.x, -face.y) - aim_yaw))
        bore_error = abs(wrap_angle(math.atan2(bore.x, -bore.y) - aim_yaw))
        ankles = [bpy.data.objects[f"foot_ik.{side}"].location for side in ("L", "R")]
        return {
            "frame": frame,
            "aimDegrees": math.degrees(aim_yaw),
            "standing": standing,
            "waistDegrees": math.degrees(waist),
            "hipDegrees": math.degrees(hip_yaw),
            "errors": errors,
            "elbowDegrees": elbow_angles,
            "bootSole": soles,
            "faceErrorDegrees": math.degrees(face_error),
            "boreErrorDegrees": math.degrees(bore_error),
            "ankleSeparation": (ankles[0] - ankles[1]).length,
            "recoil": recoil,
        }

    def image_metadata(self):
        root = world_to_camera_view(self.scene, self.scene.camera, Vector((0, 0, 0)))
        top = world_to_camera_view(self.scene, self.scene.camera, Vector((0, 0, 2.13)))
        floor_x = world_to_camera_view(self.scene, self.scene.camera, Vector((1, 0, 0)))
        floor_y = world_to_camera_view(self.scene, self.scene.camera, Vector((0, 1, 0)))
        w, h = self.scene.render.resolution_x, self.scene.render.resolution_y
        return {
            "width": w,
            "height": h,
            "rootPixels": [root.x * w, (1 - root.y) * h],
            "referenceHeightPixels": abs(top.y - root.y) * h,
            "nominalHeightWorld": 2.13,
            "floorBasisPixels": [
                [(floor_x.x - root.x) * w, -(floor_x.y - root.y) * h],
                [(floor_y.x - root.x) * w, -(floor_y.y - root.y) * h],
            ],
        }

    def keyframe_controls(self, frame):
        self.rig.keyframe_insert(data_path="location", frame=frame)
        self.rig.keyframe_insert(data_path="rotation_euler", frame=frame)
        self.spine.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        for side in ("L", "R"):
            self.rig.pose.bones[f"coat_flap.{side}"].keyframe_insert(
                data_path="rotation_euler", frame=frame
            )
            for stem in ("foot_ik", "knee_pole", "hand_grip", "elbow_pole"):
                obj = bpy.data.objects[f"{stem}.{side}"]
                obj.keyframe_insert(data_path="location", frame=frame)
                if stem == "foot_ik":
                    obj.keyframe_insert(data_path="rotation_euler", frame=frame)
        self.weapon.rotation_mode = "QUATERNION"
        self.weapon.keyframe_insert(data_path="location", frame=frame)
        self.weapon.keyframe_insert(data_path="rotation_quaternion", frame=frame)
