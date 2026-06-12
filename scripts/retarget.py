"""Retarget an animation FBX onto the CHARACTER's own armature so the exported
clip shares the character rest pose (can't explode), capturing motion via a
MANUAL per-frame matrix copy (the nla.bake operator silently no-ops the
constraint follow in headless Blender → 2 identical keyframes).

Usage: blender -b -P retarget2.py -- <char.glb> <anim.fbx> <out.glb> <clip> <fps>
"""
import bpy, sys

a = sys.argv[sys.argv.index("--") + 1:]
char_glb, anim_fbx, out_glb, clip_name = a[0], a[1], a[2], a[3]
fps = int(a[4]) if len(a) > 4 else 24

bpy.ops.wm.read_factory_settings(use_empty=True)

bpy.ops.import_scene.gltf(filepath=char_glb)
char_arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
char_arm.name = "CHAR"

before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=anim_fbx)
src_arm = next((o for o in (set(bpy.data.objects) - before) if o.type == "ARMATURE"), None)
src_arm.name = "SRC"

# Source animation frame range (ignore the character's own idle action).
fmin, fmax = 1e9, -1e9
ad = src_arm.animation_data
if ad and ad.action:
    r = ad.action.frame_range
    fmin, fmax = int(r[0]), int(r[1])
if fmin > fmax:
    fmin, fmax = 1, 60
sc = bpy.context.scene
sc.frame_start, sc.frame_end = fmin, fmax
sc.render.fps = fps

# Bones present in both rigs (match by name).
src_names = {b.name for b in src_arm.pose.bones}
pairs = [(char_arm.pose.bones[n], src_arm.pose.bones[n])
         for n in (pb.name for pb in char_arm.pose.bones) if n in src_names]
print("MATCHED_BONES", len(pairs), "of", len(char_arm.pose.bones))

# New action on the character armature.
char_arm.animation_data_create()
act = bpy.data.actions.new(clip_name)
char_arm.animation_data.action = act

src_name_by_char = {c.name: s.name for c, s in pairs}
sample_name = pairs[0][0].name
sample_first = sample_last = None

for frame in range(fmin, fmax + 1):
    sc.frame_set(frame)
    # Read the source pose from the EVALUATED object — the original object's
    # pose.bones[].matrix does NOT reflect the animation, which is why earlier
    # bakes captured identical (rest) poses.
    dg = bpy.context.evaluated_depsgraph_get()
    src_eval = src_arm.evaluated_get(dg)
    mats = {cn: src_eval.pose.bones[sn].matrix.copy() for cn, sn in src_name_by_char.items()}
    for cbone, _ in pairs:
        cbone.matrix = mats[cbone.name]
        bpy.context.view_layer.update()  # pose parents before children
    for cbone, _ in pairs:
        cbone.keyframe_insert("location", frame=frame)
        cbone.keyframe_insert("rotation_quaternion", frame=frame)
        cbone.keyframe_insert("scale", frame=frame)
    loc = mats[sample_name].to_translation()
    if sample_first is None: sample_first = loc.copy()
    sample_last = loc.copy()

print("SAMPLE_DELTA", sample_name, (sample_last - sample_first).length)

# Verify the CHAR action actually varies frame-to-frame (decompose check).
sc.frame_set(fmin); bpy.context.view_layer.update()
cb = char_arm.pose.bones[sample_name]
loc0 = cb.location.copy(); rot0 = cb.rotation_quaternion.copy()
sc.frame_set(fmax); bpy.context.view_layer.update()
print("CHAR_DELTA loc", (cb.location - loc0).length, "rot", (cb.rotation_quaternion - rot0).magnitude if hasattr((cb.rotation_quaternion - rot0),'magnitude') else 'n/a')
print("ACTION frame_range", tuple(act.frame_range))

# Strip everything but the character armature.
for o in list(bpy.data.objects):
    if o is not char_arm:
        bpy.data.objects.remove(o, do_unlink=True)

try:
    bpy.ops.export_scene.gltf(
        filepath=out_glb, export_format="GLB",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False,
        export_optimize_animation_size=False,
    )
except TypeError:
    bpy.ops.export_scene.gltf(
        filepath=out_glb, export_format="GLB",
        export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False,
    )
print("EXPORTED", out_glb)
