"""Retarget an animation FBX onto the CHARACTER's own armature, so the exported
clip shares the character bind/rest pose and can't explode on playback.

Method: import the character GLB (canonical rig) + the animation FBX (source).
Constrain each character bone to copy its same-named source bone in world space,
bake, strip everything but the character armature + baked action, export GLB.

Usage: blender -b -P retarget.py -- <char.glb> <anim.fbx> <out.glb> <clip> <fps>
"""
import bpy, sys

a = sys.argv[sys.argv.index("--") + 1:]
char_glb, anim_fbx, out_glb, clip_name = a[0], a[1], a[2], a[3]
fps = int(a[4]) if len(a) > 4 else 24

bpy.ops.wm.read_factory_settings(use_empty=True)

# 1. Character rig (target).
bpy.ops.import_scene.gltf(filepath=char_glb)
char_arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if not char_arm:
    raise SystemExit("no armature in character glb")
char_arm.name = "CHAR"

# 2. Animation rig (source).
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=anim_fbx)
src_objs = set(bpy.data.objects) - before
src_arm = next((o for o in src_objs if o.type == "ARMATURE"), None)
if not src_arm:
    raise SystemExit("no armature in animation fbx")
src_arm.name = "SRC"

# Frame range from the source's actions.
fmin, fmax = 1e9, -1e9
for act in bpy.data.actions:
    try:
        r = act.frame_range; fmin = min(fmin, r[0]); fmax = max(fmax, r[1])
    except Exception:
        pass
if fmin > fmax:
    fmin, fmax = 1, 60
fmin, fmax = int(fmin), int(fmax)
sc = bpy.context.scene
sc.frame_start, sc.frame_end = fmin, fmax
sc.render.fps = fps

src_bones = {b.name for b in src_arm.pose.bones}

# 3. Constrain each character bone to its same-named source bone (world space).
bpy.context.view_layer.objects.active = char_arm
char_arm.select_set(True)
bpy.ops.object.mode_set(mode="POSE")
matched = 0
for pb in char_arm.pose.bones:
    if pb.name not in src_bones:
        continue
    c = pb.constraints.new("COPY_TRANSFORMS")
    c.target = src_arm
    c.subtarget = pb.name
    matched += 1
print("MATCHED_BONES", matched, "of", len(char_arm.pose.bones))

# 4. Bake the character armature's visual pose into one action.
bpy.ops.pose.select_all(action="SELECT")
bpy.ops.nla.bake(
    frame_start=fmin, frame_end=fmax, step=1,
    only_selected=True, visual_keying=True,
    clear_constraints=True, clear_parents=False,
    use_current_action=True, bake_types={"POSE"},
)
bpy.ops.object.mode_set(mode="OBJECT")

# 5. Strip everything but the character armature.
for o in list(bpy.data.objects):
    if o is not char_arm:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=out_glb, export_format="GLB",
    export_animations=True, export_animation_mode="SCENE",
    export_force_sampling=True, export_frame_range=True,
)
print("EXPORTED", out_glb)
