"""Retarget an animation source (FBX or GLB) onto the CHARACTER's armature.
Handles two source shapes:
 - armature source (Blender FBX import): read evaluated pose-bone matrices
 - object source (assimp GLB: no skin, bones are animated plain objects):
   read evaluated object world matrices by node name
Both transfer world-space per frame with source scale stripped.

Usage: blender -b -P retarget3.py -- <char.glb> <anim.(fbx|glb)> <out.glb> <clip> <fps>
"""
import bpy, sys
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:]
char_glb, anim_src, out_glb, clip_name = a[0], a[1], a[2], a[3]
fps = int(a[4]) if len(a) > 4 else 25

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=char_glb)
char_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
char_arm.name = "CHAR"

before = set(bpy.data.objects)
if anim_src.lower().endswith((".glb", ".gltf")):
    bpy.ops.import_scene.gltf(filepath=anim_src)
else:
    bpy.ops.import_scene.fbx(filepath=anim_src)
imported = [o for o in bpy.data.objects if o not in before]
src_arm = next((o for o in imported if o.type == "ARMATURE"), None)

# Frame range across imported actions.
fmin, fmax = 1e9, -1e9
for act in bpy.data.actions:
    try:
        r = act.frame_range; fmin = min(fmin, r[0]); fmax = max(fmax, r[1])
    except Exception:
        pass
if fmin > fmax: fmin, fmax = 1, 60
fmin, fmax = int(fmin), int(fmax)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = fmin, fmax
sc.render.fps = fps

# Build per-char-bone source getters.
if src_arm:
    src_names = {b.name for b in src_arm.pose.bones}
    pairs = [pb for pb in char_arm.pose.bones if pb.name in src_names]
    def src_world(dg, name):
        ev = src_arm.evaluated_get(dg)
        return ev.matrix_world @ ev.pose.bones[name].matrix
    print("MODE armature MATCHED", len(pairs), "of", len(char_arm.pose.bones))
else:
    by_name = {o.name: o for o in imported}
    # glTF importers may suffix duplicate names (.001) — also map base names.
    for o in imported:
        base = o.name.split(".")[0]
        by_name.setdefault(base, o)
    pairs = [pb for pb in char_arm.pose.bones if pb.name in by_name]
    def src_world(dg, name):
        return by_name[name].evaluated_get(dg).matrix_world
    print("MODE objects MATCHED", len(pairs), "of", len(char_arm.pose.bones))

char_arm.animation_data_create()
act = bpy.data.actions.new(clip_name)
char_arm.animation_data.action = act

for pb in pairs:
    pb.rotation_mode = "QUATERNION"
cw_inv = char_arm.matrix_world.inverted()

# Unit calibration at the first frame: assimp GLBs keep the FBX's native
# units (cm) with no unit-scale node, so translations come out ~25-100x.
# Scale by the rig-height ratio and recenter on the root node.
sc.frame_set(fmin)
dg0 = bpy.context.evaluated_depsgraph_get()
src_pos0 = {pb.name: (cw_inv @ src_world(dg0, pb.name)).to_translation() for pb in pairs}
char_pos0 = {pb.name: (pb.bone.matrix_local).to_translation() for pb in pairs}
def spanz(d):
    zs = [v.z for v in d.values()]; ys = [v.y for v in d.values()]
    return max(max(zs)-min(zs), max(ys)-min(ys), 1e-9)
ratio = spanz(char_pos0) / spanz(src_pos0)
root_name = "Fin_Root" if any(pb.name == "Fin_Root" for pb in pairs) else pairs[0].name
src_root0 = src_pos0[root_name]
char_root0 = char_pos0[root_name]
print("CALIB ratio", round(ratio, 4), "root", root_name)

for frame in range(fmin, fmax + 1):
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    for pb in pairs:
        target = cw_inv @ src_world(dg, pb.name)
        loc, rot, _s = target.decompose()
        loc = (loc - src_root0) * ratio + char_root0
        pb.matrix = Matrix.LocRotScale(loc, rot, Vector((1, 1, 1)))
        bpy.context.view_layer.update()
    for pb in pairs:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        pb.keyframe_insert("location", frame=frame)

# Strip everything but the character armature.
for o in list(bpy.data.objects):
    if o is not char_arm:
        bpy.data.objects.remove(o, do_unlink=True)

try:
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False,
        export_optimize_animation_size=False)
except TypeError:
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False)
print("EXPORTED", out_glb)
