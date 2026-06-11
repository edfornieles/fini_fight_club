"""Convert a Fin mood-idle FBX to an armature-only GLB animation clip.
The FBX importer splits the take across several actions / objects; we bake the
whole thing into ONE action via the scene timeline so the GLB carries a single
clip named <clip_name>.
Usage: blender -b -P fbx2glb.py -- <src.fbx> <dst.glb> <clip_name>
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst, clip_name = argv

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

# Find the armature.
arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if arm is None:
    raise SystemExit("no armature in " + src)

# Frame range across every imported action.
fmin, fmax = 1e9, -1e9
for act in bpy.data.actions:
    a, b = act.frame_range
    fmin, fmax = min(fmin, a), max(fmax, b)
if fmin > fmax:
    fmin, fmax = 1, 60
fmin, fmax = int(fmin), int(fmax)

bpy.context.scene.frame_start = fmin
bpy.context.scene.frame_end = fmax

# Bake the armature's evaluated pose into one clean action.
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.select_all(action="SELECT")
bpy.ops.nla.bake(
    frame_start=fmin, frame_end=fmax, step=1,
    only_selected=True, visual_keying=True,
    clear_constraints=True, clear_parents=False,
    use_current_action=True, bake_types={"POSE"},
)
bpy.ops.object.mode_set(mode="OBJECT")

if arm.animation_data and arm.animation_data.action:
    arm.animation_data.action.name = clip_name

# Drop meshes — the app retargets clips onto each character's own skeleton.
for obj in list(bpy.data.objects):
    if obj.type == "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_animations=True,
    export_force_sampling=True,
)
print("EXPORTED", dst)
